import { defineCommand } from "@bunli/core";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { loadSettings, saveSettings, setSecret, hasSecret, PROVIDERS, type Settings, type McpServerConfig, type ProviderName } from "../config/index.ts";
import { log } from "../utils/index.ts";
import { BUILTIN_GMAIL_SERVER } from "./shared.ts";

function parseMcpCommand(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/);
  return { command: parts[0]!, args: parts.slice(1) };
}

export default defineCommand({
  name: "setup",
  description: "Configure Sherpa: LLM provider, MCP servers, vault paths",
  handler: async () => {
    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa setup"));

    const existing = await loadSettings();

    // LLM provider selection
    const provider = await clack.select({
      message: "LLM provider",
      options: Object.entries(PROVIDERS).map(([key, val]) => ({
        value: key,
        label: val.label,
        hint: key === existing.llm.provider ? "current" : undefined,
      })),
      initialValue: existing.llm.provider,
    });

    if (clack.isCancel(provider)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const selectedProvider = provider as ProviderName;
    const providerInfo = PROVIDERS[selectedProvider];
    const keyExists = await hasSecret(providerInfo.envKey);

    const apiKey = await clack.text({
      message: keyExists
        ? `${providerInfo.label} API key (in Keychain — leave blank to keep)`
        : `${providerInfo.label} API key`,
      placeholder: selectedProvider === "anthropic" ? "sk-ant-..." : "sk-...",
      initialValue: "",
      validate: (v) => {
        if (!keyExists && (!v || v.length === 0)) return `Required for ${providerInfo.label}`;
      },
    });

    if (clack.isCancel(apiKey)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const model = await clack.text({
      message: "Model name",
      placeholder: providerInfo.defaultModel,
      initialValue: existing.llm.provider === selectedProvider ? existing.llm.model : providerInfo.defaultModel,
    });

    if (clack.isCancel(model)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const vaultPath = await clack.text({
      message: "Obsidian vault path (or local markdown directory)",
      placeholder: "~/Documents/vault",
      initialValue: existing.obsidian.vaultPath ?? "",
    });

    if (clack.isCancel(vaultPath)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const builtinGmailCmd = formatMcpCommand(BUILTIN_GMAIL_SERVER);
    const gmailChoice = await clack.select({
      message: "Gmail integration",
      options: [
        { value: "builtin", label: "Built-in Sherpa Gmail server (recommended)", hint: "uses googleapis directly" },
        { value: "custom", label: "Custom MCP server command" },
        { value: "skip", label: "Skip Gmail" },
      ],
      initialValue: "builtin",
    });

    if (clack.isCancel(gmailChoice)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    let gmailInput: string | symbol = "";
    if (gmailChoice === "builtin") {
      gmailInput = builtinGmailCmd;
    } else if (gmailChoice === "custom") {
      gmailInput = await clack.text({
        message: "Gmail MCP server (command + args)",
        placeholder: "bun path/to/server.ts",
        initialValue: formatMcpCommand(existing.mcpServers["gmail"]) || "",
      });
      if (clack.isCancel(gmailInput)) {
        clack.cancel("Setup cancelled.");
        return;
      }
    }

    const calendarInput = await clack.text({
      message: "Google Calendar MCP server (leave empty to skip)",
      placeholder: "npx @modelcontextprotocol/server-google-calendar",
      initialValue: formatMcpCommand(existing.mcpServers["google-calendar"]) || "",
    });

    if (clack.isCancel(calendarInput)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const todoistInput = await clack.text({
      message: "Todoist MCP server (leave empty to skip)",
      placeholder: "npx @abhiz123/todoist-mcp-server",
      initialValue: formatMcpCommand(existing.mcpServers["todoist"]) || "",
    });

    if (clack.isCancel(todoistInput)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    // Store API key in macOS Keychain
    if (apiKey && (apiKey as string).length > 0) {
      await setSecret(providerInfo.envKey, apiKey as string);
      log.success(`${providerInfo.label} API key stored in macOS Keychain.`);
    }

    const newServers: Record<string, McpServerConfig> = { ...existing.mcpServers };

    if (gmailChoice === "builtin") {
      newServers["gmail"] = BUILTIN_GMAIL_SERVER;
    } else if (gmailInput && (gmailInput as string).length > 0) {
      const { command, args } = parseMcpCommand(gmailInput as string);
      newServers["gmail"] = { command, args, env: {}, transport: "stdio" };
    }
    if (calendarInput) {
      const { command, args } = parseMcpCommand(calendarInput as string);
      newServers["google-calendar"] = { command, args, env: {}, transport: "stdio" };
    }
    if (todoistInput) {
      const { command, args } = parseMcpCommand(todoistInput as string);
      newServers["todoist"] = { command, args, env: {}, transport: "stdio" };
    }

    const settings: Settings = {
      ...existing,
      llm: {
        provider: selectedProvider,
        model: (model as string) || providerInfo.defaultModel,
        maxTokens: existing.llm.maxTokens,
      },
      obsidian: {
        ...existing.obsidian,
        vaultPath: (vaultPath as string) || undefined,
      },
      mcpServers: newServers,
    };

    await saveSettings(settings);

    log.success("Configuration saved.");
    log.dim(`  Provider:  ${providerInfo.label} (${settings.llm.model})`);
    log.dim(`  Settings:  ~/.config/sherpa/settings.json`);
    log.dim(`  API keys:  macOS Keychain (com.sherpa.cli)`);
    log.raw("");
    if (gmailChoice === "builtin" || gmailChoice === "custom") {
      log.info("Gmail auth: run `bun mcp/gmail/server.ts auth` to authenticate with Google.");
      log.dim("  Place your OAuth keys at ~/.sherpa/gmail/oauth-keys.json first.");
    }

    clack.outro(chalk.dim("Ready to guide. Run `sherpa triage` to start."));
  },
});

function formatMcpCommand(config?: McpServerConfig): string {
  if (!config || !config.command) return "";
  return [config.command, ...config.args].join(" ");
}
