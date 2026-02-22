import { defineCommand } from "@bunli/core";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { loadSettings, saveSettings, setSecret, hasSecret, type Settings, type McpServerConfig } from "../config/index.ts";
import { log } from "../utils/index.ts";

function parseMcpCommand(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/);
  return { command: parts[0]!, args: parts.slice(1) };
}

export default defineCommand({
  name: "setup",
  description: "Configure Sherpa: MCP servers, vault paths, and API keys",
  handler: async () => {
    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa setup"));

    const existing = await loadSettings();
    const hasKey = await hasSecret("ANTHROPIC_API_KEY");

    const anthropicKey = await clack.text({
      message: hasKey ? "Anthropic API key (stored in Keychain — leave blank to keep)" : "Anthropic API key",
      placeholder: "sk-ant-...",
      initialValue: "",
      validate: (v) => {
        if (!hasKey && (!v || v.length === 0)) return "Required for AI features";
      },
    });

    if (clack.isCancel(anthropicKey)) {
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

    const gmailInput = await clack.text({
      message: "Gmail MCP server (command + args)",
      placeholder: "npx @gongrzhe/server-gmail-autoauth-mcp",
      initialValue: formatMcpCommand(existing.mcpServers["gmail"]) || "npx @gongrzhe/server-gmail-autoauth-mcp",
    });

    if (clack.isCancel(gmailInput)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const calendarInput = await clack.text({
      message: "Google Calendar MCP server (leave empty to skip)",
      placeholder: "npx @gongrzhe/server-google-calendar-mcp",
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
    if (anthropicKey && (anthropicKey as string).length > 0) {
      await setSecret("ANTHROPIC_API_KEY", anthropicKey as string);
      log.success("API key stored in macOS Keychain.");
    }

    const newServers: Record<string, McpServerConfig> = { ...existing.mcpServers };

    if (gmailInput) {
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
      obsidian: {
        ...existing.obsidian,
        vaultPath: (vaultPath as string) || undefined,
      },
      mcpServers: newServers,
    };

    await saveSettings(settings);

    log.success("Configuration saved.");
    log.dim(`  Settings:  ~/.config/sherpa/settings.json`);
    log.dim(`  API keys:  macOS Keychain (com.sherpa.cli)`);
    log.raw("");
    log.info("Gmail auth: run `npx @gongrzhe/server-gmail-autoauth-mcp auth` to authenticate with Google.");

    clack.outro(chalk.dim("Ready to guide. Run `sherpa triage` to start."));
  },
});

function formatMcpCommand(config?: McpServerConfig): string {
  if (!config || !config.command) return "";
  return [config.command, ...config.args].join(" ");
}
