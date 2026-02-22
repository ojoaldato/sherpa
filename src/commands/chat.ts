import { defineCommand } from "@bunli/core";
import { startRepl } from "../agent/index.ts";
import { connectConfiguredServers } from "./shared.ts";
import { log } from "../utils/index.ts";

export default defineCommand({
  name: "chat",
  description: "Interactive conversational mode — talk to Sherpa naturally",
  handler: async () => {
    try {
      await connectConfiguredServers();
    } catch {
      log.warn("Some integrations unavailable. Sherpa will work with what's connected.");
    }

    await startRepl();
  },
});
