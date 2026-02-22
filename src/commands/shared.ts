import path from "node:path";
import { getMcpManager } from "../mcp/index.ts";
import { loadSettings, loadEnv, type McpServerConfig } from "../config/index.ts";

const SHERPA_ROOT = path.resolve(import.meta.dir, "../..");

export const BUILTIN_GMAIL_SERVER: McpServerConfig = {
  command: "bun",
  args: [path.join(SHERPA_ROOT, "mcp", "gmail", "server.ts")],
  env: {},
  transport: "stdio",
};

export async function connectConfiguredServers(): Promise<void> {
  await loadEnv();
  const settings = await loadSettings();
  const manager = getMcpManager();

  const servers: Record<string, McpServerConfig> = { ...settings.mcpServers };

  if (!servers["gmail"] || !servers["gmail"].command) {
    servers["gmail"] = BUILTIN_GMAIL_SERVER;
  }

  const entries = Object.entries(servers).filter(
    ([_, config]) => config.command.length > 0
  );

  await Promise.allSettled(
    entries.map(([name, config]) => manager.connect(name, config))
  );
}
