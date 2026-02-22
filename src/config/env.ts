import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  GMAIL_MCP_PATH: z.string().optional(),
  GOOGLE_CALENDAR_MCP_PATH: z.string().optional(),
  TODOIST_API_TOKEN: z.string().optional(),
  TODOIST_MCP_PATH: z.string().optional(),
  OBSIDIAN_VAULT_PATH: z.string().optional(),
  OBSIDIAN_MCP_PATH: z.string().optional(),
  SHERPA_CONFIG_DIR: z.string().default(
    `${process.env.HOME}/.config/sherpa`
  ),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
