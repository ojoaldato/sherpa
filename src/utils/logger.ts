import chalk from "chalk";

const prefix = chalk.bold.hex("#7C5CFC")("⛰ sherpa");

export const log = {
  info: (...args: unknown[]) => console.log(prefix, chalk.blue("ℹ"), ...args),
  success: (...args: unknown[]) => console.log(prefix, chalk.green("✓"), ...args),
  warn: (...args: unknown[]) => console.log(prefix, chalk.yellow("⚠"), ...args),
  error: (...args: unknown[]) => console.error(prefix, chalk.red("✗"), ...args),
  dim: (...args: unknown[]) => console.log(prefix, chalk.dim(...args)),
  raw: (...args: unknown[]) => console.log(...args),
};
