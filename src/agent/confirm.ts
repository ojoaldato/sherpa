import * as clack from "@clack/prompts";
import chalk from "chalk";

/**
 * Ask the user to confirm a destructive action.
 * Returns true if confirmed, false if rejected.
 */
export async function confirmAction(description: string): Promise<boolean> {
  const result = await clack.confirm({
    message: chalk.yellow(`⚠ ${description}`),
  });

  if (clack.isCancel(result)) return false;
  return result;
}
