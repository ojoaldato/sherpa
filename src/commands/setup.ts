import { defineCommand } from "@bunli/core";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { loadSettings, saveSettings, type Settings, type McpServerConfig } from "../config/index.ts";
import { log } from "../utils/index.ts";

export default defineCommand({
  name: "setup",
  description: "Configure Sherpa: MCP servers, vault paths, and API keys",
  handler: async () => {
    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa setup"));

    const existing = await loadSettings();

    const anthropicKey = await clack.text({
      message: "Anthropic API key",
      placeholder: "sk-ant-...",
      initialValue: process.env.ANTHROPIC_API_KEY ?? "",
      validate: (v) => {
        if (!v || v.length === 0) return "Required for AI features";
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

    const gmailMcp = await clack.text({
      message: "Gmail MCP server command (e.g. npx @anthropic/gmail-mcp)",
      placeholder: "npx @anthropic/gmail-mcp",
      initialValue: existing.mcpServers["gmail"]?.command ?? "",
    });

    if (clack.isCancel(gmailMcp)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const calendarMcp = await clack.text({
      message: "Google Calendar MCP server command",
      placeholder: "npx @anthropic/google-calendar-mcp",
      initialValue: existing.mcpServers["google-calendar"]?.command ?? "",
    });

    if (clack.isCancel(calendarMcp)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const todoistMcp = await clack.text({
      message: "Todoist MCP server command",
      placeholder: "npx @anthropic/todoist-mcp",
      initialValue: existing.mcpServers["todoist"]?.command ?? "",
    });

    if (clack.isCancel(todoistMcp)) {
      clack.cancel("Setup cancelled.");
      return;
    }

    const newServers: Record<string, McpServerConfig> = { ...existing.mcpServers };

    if (gmailMcp) {
      newServers["gmail"] = { command: gmailMcp as string, args: [], env: {}, transport: "stdio" };
    }
    if (calendarMcp) {
      newServers["google-calendar"] = { command: calendarMcp as string, args: [], env: {}, transport: "stdio" };
    }
    if (todoistMcp) {
      newServers["todoist"] = { command: todoistMcp as string, args: [], env: {}, transport: "stdio" };
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

    const envPath = `${process.env.HOME}/.config/sherpa/.env`;
    const envContent = `ANTHROPIC_API_KEY=${anthropicKey}\n`;
    await Bun.write(envPath, envContent);

    log.success("Configuration saved.");
    log.dim(`  Settings: ~/.config/sherpa/settings.json`);
    log.dim(`  Env:      ~/.config/sherpa/.env`);

    clack.outro(chalk.dim("Ready to guide. Run `sherpa triage` to start."));
  },
});
