import { z } from "zod";

const envSchema = z.object({
  OBSIDIAN_VAULT_PATH: z.string().optional(),
  SHERPA_CONFIG_DIR: z.string().default(
    `${process.env.HOME}/.config/sherpa`
  ),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Load and validate environment variables.
 * API keys are loaded from macOS Keychain via loadProviderApiKey(),
 * not from env vars.
 */
export async function loadEnv(): Promise<Env> {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
