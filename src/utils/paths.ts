import path from "node:path";
import { getEnv } from "../config/env.ts";
import { loadSettings } from "../config/settings.ts";

/**
 * Validates that a given path is within an allowed directory.
 * Prevents path traversal attacks where the LLM could be
 * tricked into reading arbitrary files on the filesystem.
 */
export async function assertPathAllowed(filePath: string): Promise<void> {
  const resolved = path.resolve(filePath);
  const allowed = await getAllowedRoots();

  const isAllowed = allowed.some((root) => resolved.startsWith(root));
  if (!isAllowed) {
    throw new Error(
      `Access denied: "${resolved}" is outside allowed directories. ` +
      `Allowed roots: ${allowed.join(", ")}`
    );
  }
}

export async function assertDirsAllowed(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    await assertPathAllowed(dir);
  }
}

async function getAllowedRoots(): Promise<string[]> {
  const env = getEnv();
  const settings = await loadSettings();
  const roots: string[] = [];

  if (settings.obsidian.vaultPath) {
    roots.push(path.resolve(settings.obsidian.vaultPath));
  }

  for (const d of settings.obsidian.planDirs) {
    const resolved = settings.obsidian.vaultPath
      ? path.resolve(`${settings.obsidian.vaultPath}/${d}`)
      : path.resolve(d);
    roots.push(resolved);
  }

  if (env.OBSIDIAN_VAULT_PATH) {
    roots.push(path.resolve(env.OBSIDIAN_VAULT_PATH));
  }

  if (roots.length === 0) {
    roots.push(path.resolve(env.SHERPA_CONFIG_DIR));
  }

  return roots;
}
