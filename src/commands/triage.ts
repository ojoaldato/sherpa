import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { runAgent, TRIAGE_SYSTEM } from "../agent/index.ts";
import { listInboxMessages, archiveMessages, createDraft, getMessage } from "../integrations/gmail/index.ts";
import { truncate, formatRelativeTime } from "../utils/index.ts";
import { log } from "../utils/index.ts";
import { connectConfiguredServers } from "./shared.ts";

export default defineCommand({
  name: "triage",
  description: "Triage your Gmail inbox with AI-powered categorization",
  options: {
    count: option(z.coerce.number().default(25), {
      description: "Number of emails to process",
      short: "c",
    }),
    auto: option(z.coerce.boolean().default(false), {
      description: "Auto-archive without confirmation",
      short: "a",
    }),
  },
  handler: async ({ flags }) => {
    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa triage"));

    const s = clack.spinner();
    s.start("Connecting to Gmail...");

    try {
      await connectConfiguredServers();
    } catch (e) {
      s.stop("Failed to connect");
      log.error("Could not connect to Gmail MCP server. Run `sherpa setup` first.");
      return;
    }

    s.message("Fetching inbox...");
    const batch = await listInboxMessages(flags.count);

    if (batch.messages.length === 0) {
      s.stop("Inbox zero — nothing to triage.");
      clack.outro("You're all clear.");
      return;
    }

    s.message(`Analyzing ${batch.messages.length} messages...`);

    const emailSummary = batch.messages
      .map(
        (m, i) =>
          `[${i + 1}] From: ${m.from} | Subject: ${m.subject} | ${formatRelativeTime(m.date)}\n    ${truncate(m.snippet, 120)}`
      )
      .join("\n\n");

    const analysis = await runAgent(
      [{ role: "user", content: `Here are my ${batch.messages.length} most recent inbox messages. Triage them.\n\n${emailSummary}` }],
      { system: TRIAGE_SYSTEM }
    );

    s.stop("Triage complete.");
    log.raw("");
    log.raw(analysis);
    log.raw("");

    if (flags.auto) {
      return;
    }

    const action = await clack.select({
      message: "What would you like to do?",
      options: [
        { value: "review", label: "Review individual emails" },
        { value: "archive-suggested", label: "Archive all ARCHIVE-tagged emails" },
        { value: "done", label: "Done for now" },
      ],
    });

    if (clack.isCancel(action)) {
      clack.cancel("Cancelled.");
      return;
    }

    if (action === "archive-suggested") {
      s.start("Archiving low-value messages...");
      const archiveIds = batch.messages
        .filter((_, i) => analysis.toLowerCase().includes(`[${i + 1}]`) && analysis.toLowerCase().includes("archive"))
        .map((m) => m.id);

      if (archiveIds.length > 0) {
        await archiveMessages(archiveIds);
        s.stop(`Archived ${archiveIds.length} messages.`);
      } else {
        s.stop("No messages matched for archiving.");
      }
    }

    clack.outro(chalk.dim("Inbox duty done."));
  },
});
