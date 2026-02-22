import { createCLI } from "@bunli/core";
import triage from "./commands/triage.ts";
import plan from "./commands/plan.ts";
import briefing from "./commands/briefing.ts";
import setup from "./commands/setup.ts";
import chat from "./commands/chat.ts";

const args = process.argv.slice(2);
const knownCommands = ["triage", "plan", "briefing", "setup", "chat", "--help", "-h", "--version", "-v"];
const hasSubcommand = args.length > 0 && knownCommands.some((c) => args[0] === c);

if (!hasSubcommand && args.length === 0) {
  // No subcommand → enter conversational mode
  const { connectConfiguredServers } = await import("./commands/shared.ts");
  const { log } = await import("./utils/index.ts");
  const { startRepl } = await import("./agent/index.ts");

  try {
    await connectConfiguredServers();
  } catch {
    log.warn("Some integrations unavailable. Sherpa will work with what's connected.");
  }

  await startRepl();
} else {
  const cli = await createCLI({
    name: "sherpa",
    version: "0.1.0",
  });

  cli.command(chat);
  cli.command(triage);
  cli.command(plan);
  cli.command(briefing);
  cli.command(setup);

  await cli.run();
}
