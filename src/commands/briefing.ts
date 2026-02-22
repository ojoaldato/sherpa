import { defineCommand } from "@bunli/core";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { runAgent, BRIEFING_SYSTEM } from "../agent/index.ts";
import { getEventsForDay } from "../integrations/calendar/index.ts";
import { getActiveTasks } from "../integrations/todoist/index.ts";
import { searchEmails, type EmailMessage } from "../integrations/gmail/index.ts";
import { formatDate, sectionHeader } from "../utils/index.ts";
import { log } from "../utils/index.ts";
import { connectConfiguredServers } from "./shared.ts";

export default defineCommand({
  name: "briefing",
  description: "Get a synthesized daily briefing: calendar, tasks, and inbox",
  handler: async () => {
    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa briefing"));

    const s = clack.spinner();
    s.start("Gathering today's data...");

    try {
      await connectConfiguredServers();
    } catch {
      s.stop("Partial connection — some data may be missing.");
    }

    const today = new Date();

    const [events, tasks, inbox] = await Promise.allSettled([
      getEventsForDay(today),
      getActiveTasks(),
      searchEmails("in:inbox is:unread", 15),
    ]);

    const calendarData = events.status === "fulfilled" ? events.value : [];
    const taskData = tasks.status === "fulfilled" ? tasks.value : [];
    const emailData: EmailMessage[] = inbox.status === "fulfilled" ? inbox.value : [];

    s.message("Synthesizing briefing...");

    const contextParts: string[] = [];

    if (calendarData.length > 0) {
      contextParts.push(
        `## Today's Calendar\n` +
          calendarData.map((e) => `- ${formatDate(e.start)} — ${e.summary}`).join("\n")
      );
    } else {
      contextParts.push("## Today's Calendar\nNo events scheduled.");
    }

    if (taskData.length > 0) {
      contextParts.push(
        `## Active Tasks (today/overdue)\n` +
          taskData
            .map((t) => `- [P${t.priority}] ${t.content}${t.due ? ` (${t.due.string})` : ""}`)
            .join("\n")
      );
    } else {
      contextParts.push("## Active Tasks\nNo tasks due today.");
    }

    if (emailData.length > 0) {
      contextParts.push(
        `## Recent Inbox (${emailData.length})\n` +
          emailData
            .slice(0, 10)
            .map((m) => `- From: ${m.from} | ${m.subject}`)
            .join("\n")
      );
    }

    const briefing = await runAgent(
      [{ role: "user", content: `Generate my morning briefing.\n\n${contextParts.join("\n\n")}` }],
      { system: BRIEFING_SYSTEM }
    );

    s.stop("Briefing ready.");
    log.raw("");
    log.raw(sectionHeader(`Daily Briefing — ${formatDate(today)}`));
    log.raw("");
    log.raw(briefing);
    log.raw("");

    clack.outro(chalk.dim("Go get it."));
  },
});
