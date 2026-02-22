import { createCLI } from "@bunli/core";
import triage from "./commands/triage.ts";
import plan from "./commands/plan.ts";
import briefing from "./commands/briefing.ts";
import setup from "./commands/setup.ts";

const cli = await createCLI({
  name: "sherpa",
  version: "0.1.0",
});

cli.command(triage);
cli.command(plan);
cli.command(briefing);
cli.command(setup);

await cli.run();
