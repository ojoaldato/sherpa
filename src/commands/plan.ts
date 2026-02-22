import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { runAgent, PLAN_SYSTEM } from "../agent/index.ts";
import { listUpcomingEvents } from "../integrations/calendar/index.ts";
import { getActiveTasks, getTasksByFilter } from "../integrations/todoist/index.ts";
import { searchLocalDocs, listPlans } from "../integrations/obsidian/index.ts";
import { formatDate, sectionHeader } from "../utils/index.ts";
import { log } from "../utils/index.ts";
import { loadSettings } from "../config/index.ts";
import { connectConfiguredServers } from "./shared.ts";

export default defineCommand({
  name: "plan",
  description: "Plan your week using calendar, tasks, and local goals/plans",
  options: {
    days: option(z.coerce.number().default(7), {
      description: "Number of days to look ahead",
      short: "d",
    }),
    goals: option(z.string().optional(), {
      description: "Path to a local goals/plans directory",
      short: "g",
    }),
  },
  handler: async ({ flags }) => {
    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa plan"));

    const s = clack.spinner();
    s.start("Gathering context...");

    try {
      await connectConfiguredServers();
    } catch {
      s.stop("Partial connection — some integrations may be unavailable.");
    }

    const settings = await loadSettings();

    // Gather data in parallel
    const [events, tasks, weekTasks] = await Promise.allSettled([
      listUpcomingEvents(flags.days),
      getActiveTasks(),
      getTasksByFilter(`due before: +${flags.days} days`),
    ]);

    const calendarData = events.status === "fulfilled" ? events.value : [];
    const todayTasks = tasks.status === "fulfilled" ? tasks.value : [];
    const upcomingTasks = weekTasks.status === "fulfilled" ? weekTasks.value : [];

    // Load local plans/goals
    const goalDirs = flags.goals
      ? [flags.goals]
      : settings.obsidian.planDirs.map((d) =>
          settings.obsidian.vaultPath ? `${settings.obsidian.vaultPath}/${d}` : d
        );

    let planDocs: Awaited<ReturnType<typeof listPlans>> = [];
    try {
      planDocs = await listPlans(goalDirs);
    } catch {
      // Plans are optional guidance
    }

    s.message("Building your weekly plan...");

    const contextParts: string[] = [];

    if (calendarData.length > 0) {
      contextParts.push(
        `## Calendar (next ${flags.days} days)\n` +
          calendarData
            .map((e) => `- ${formatDate(e.start)} → ${e.summary}${e.attendees?.length ? ` (${e.attendees.length} attendees)` : ""}`)
            .join("\n")
      );
    }

    if (todayTasks.length > 0 || upcomingTasks.length > 0) {
      const allTasks = [...todayTasks, ...upcomingTasks];
      const unique = [...new Map(allTasks.map((t) => [t.id, t])).values()];
      contextParts.push(
        `## Tasks\n` +
          unique
            .map((t) => `- [P${t.priority}] ${t.content}${t.due ? ` (due: ${t.due.string})` : ""}${t.project ? ` [${t.project}]` : ""}`)
            .join("\n")
      );
    }

    if (planDocs.length > 0) {
      contextParts.push(
        `## Reference Plans & Goals\n` +
          planDocs
            .slice(0, 10)
            .map((d) => `### ${d.filename}\n${d.content.slice(0, 500)}`)
            .join("\n\n")
      );
    }

    const context = contextParts.join("\n\n---\n\n");

    const plan = await runAgent(
      [{ role: "user", content: `Help me plan the next ${flags.days} days. Here's my current context:\n\n${context}` }],
      { system: PLAN_SYSTEM }
    );

    s.stop("Plan ready.");
    log.raw("");
    log.raw(sectionHeader(`Week Plan — next ${flags.days} days`));
    log.raw("");
    log.raw(plan);
    log.raw("");

    clack.outro(chalk.dim("Good luck out there."));
  },
});
