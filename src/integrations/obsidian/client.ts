import { getEnv } from "../../config/index.ts";
import { log, assertPathAllowed, assertDirsAllowed } from "../../utils/index.ts";
import { Glob } from "bun";

export interface LocalDocument {
  path: string;
  filename: string;
  content: string;
  modified: Date;
}

/**
 * Read markdown files from the Obsidian vault or any local directory.
 * Works without an MCP server — direct filesystem access for local-first privacy.
 */
export async function searchLocalDocs(
  query: string,
  dirs?: string[]
): Promise<LocalDocument[]> {
  const env = getEnv();
  const searchDirs = dirs ?? [env.OBSIDIAN_VAULT_PATH].filter(Boolean) as string[];

  if (searchDirs.length === 0) {
    log.warn("No vault/document paths configured. Set OBSIDIAN_VAULT_PATH or pass dirs.");
    return [];
  }

  await assertDirsAllowed(searchDirs);

  const results: LocalDocument[] = [];
  const queryLower = query.toLowerCase();
  const glob = new Glob("**/*.md");

  for (const dir of searchDirs) {
    for await (const filePath of glob.scan({ cwd: dir })) {
      const fullPath = `${dir}/${filePath}`;
      const file = Bun.file(fullPath);
      const content = await file.text();

      const matchesFilename = filePath.toLowerCase().includes(queryLower);
      const matchesContent = content.toLowerCase().includes(queryLower);

      if (matchesFilename || matchesContent) {
        const stat = await file.stat();
        results.push({
          path: fullPath,
          filename: filePath,
          content,
          modified: stat ? new Date(stat.mtimeMs) : new Date(),
        });
      }
    }
  }

  return results.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

export async function readDocument(filePath: string): Promise<string> {
  await assertPathAllowed(filePath);
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Document not found: ${filePath}`);
  }
  return file.text();
}

export async function listPlans(planDirs: string[]): Promise<LocalDocument[]> {
  const results: LocalDocument[] = [];
  const glob = new Glob("**/*.md");

  for (const dir of planDirs) {
    const dirFile = Bun.file(dir);
    if (!(await Bun.file(`${dir}/.`).exists().catch(() => false))) continue;

    for await (const filePath of glob.scan({ cwd: dir })) {
      const fullPath = `${dir}/${filePath}`;
      const file = Bun.file(fullPath);
      const content = await file.text();
      const stat = await file.stat();

      results.push({
        path: fullPath,
        filename: filePath,
        content,
        modified: stat ? new Date(stat.mtimeMs) : new Date(),
      });
    }
  }

  return results.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}
