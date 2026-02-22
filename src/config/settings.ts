import { z } from "zod";
import { getEnv } from "./env.ts";

const mcpServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  transport: z.enum(["stdio", "sse", "http"]).default("stdio"),
});

const settingsSchema = z.object({
  llm: z.object({
    provider: z.enum(["anthropic", "openai", "google"]).default("anthropic"),
    model: z.string().default("claude-sonnet-4-20250514"),
    maxTokens: z.number().default(4096),
  }).default(() => ({ provider: "anthropic" as const, model: "claude-sonnet-4-20250514", maxTokens: 4096 })),
  mcpServers: z.record(z.string(), mcpServerSchema).default({}),
  obsidian: z.object({
    vaultPath: z.string().optional(),
    planDirs: z.array(z.string()).default(["plans", "goals"]),
  }).default(() => ({ planDirs: ["plans", "goals"] })),
  gmail: z.object({
    maxResults: z.number().default(50),
    triageLabels: z.array(z.string()).default(["INBOX"]),
  }).default(() => ({ maxResults: 50, triageLabels: ["INBOX"] })),
  calendar: z.object({
    lookaheadDays: z.number().default(7),
  }).default(() => ({ lookaheadDays: 7 })),
  todoist: z.object({
    projectFilter: z.array(z.string()).default([]),
  }).default(() => ({ projectFilter: [] })),
});

export type Settings = z.infer<typeof settingsSchema>;
export type McpServerConfig = z.infer<typeof mcpServerSchema>;

export async function loadSettings(): Promise<Settings> {
  const env = getEnv();
  const configPath = `${env.SHERPA_CONFIG_DIR}/settings.json`;

  const file = Bun.file(configPath);
  if (await file.exists()) {
    const raw = await file.json();
    return settingsSchema.parse(raw);
  }

  return settingsSchema.parse({});
}

export async function saveSettings(settings: Settings): Promise<void> {
  const env = getEnv();
  const configDir = env.SHERPA_CONFIG_DIR;

  await Bun.$`mkdir -p ${configDir}`.quiet();
  await Bun.write(`${configDir}/settings.json`, JSON.stringify(settings, null, 2));
}
