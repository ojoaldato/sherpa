import { getMcpManager } from "../mcp/index.ts";
import { loadSettings, loadEnv } from "../config/index.ts";

export async function connectConfiguredServers(): Promise<void> {
  await loadEnv();
  const settings = await loadSettings();
  const manager = getMcpManager();

  const entries = Object.entries(settings.mcpServers).filter(
    ([_, config]) => config.command.length > 0
  );

  await Promise.allSettled(
    entries.map(([name, config]) => manager.connect(name, config))
  );
}
