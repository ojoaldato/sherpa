import { z } from "zod";
import { getSecret } from "./keychain.ts";

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

export async function loadEnv(): Promise<Env> {
  if (_env) return _env;

  const keychainKey = await getSecret("ANTHROPIC_API_KEY");

  _env = envSchema.parse({
    ...process.env,
    ...(keychainKey ? { ANTHROPIC_API_KEY: keychainKey } : {}),
  });

  if (keychainKey) {
    process.env.ANTHROPIC_API_KEY = keychainKey;
  }

  return _env;
}

/**
 * Synchronous accessor — returns cached env.
 * Call loadEnv() at least once before using this.
 */
export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
