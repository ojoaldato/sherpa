import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { runAgent, TRIAGE_SYSTEM } from "../agent/index.ts";
import {
  searchEmails,
  readEmail,
  archiveEmail,
  createFilter,
  createDraft,
  type EmailMessage,
} from "../integrations/gmail/index.ts";
import { createTask } from "../integrations/todoist/index.ts";
import { truncate, formatRelativeTime } from "../utils/index.ts";
import { log, notifySummary, type TriageAction, type TriageSummary } from "../utils/index.ts";
import { connectConfiguredServers } from "./shared.ts";

const session: TriageAction[] = [];

function track(email: EmailMessage, action: TriageAction["action"], detail?: string) {
  session.push({ email: { from: email.from, subject: email.subject }, action, detail });
}

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1]! : from;
}

function extractSenderDomain(from: string): string {
  const email = extractSenderEmail(from);
  return email.split("@")[1] ?? email;
}

function emailLine(i: number, m: EmailMessage): string {
  const idx = chalk.dim(`[${String(i + 1).padStart(2)}]`);
  const from = chalk.cyan(truncate(m.from, 30));
  const subj = chalk.white(truncate(m.subject, 50));
  const time = chalk.dim(formatRelativeTime(m.date));
  return `${idx} ${from}  ${subj}  ${time}`;
}

export default defineCommand({
  name: "triage",
  description: "Triage your Gmail inbox — ignore, filter, follow-up, or reply",
  options: {
    count: option(z.coerce.number().default(25), {
      description: "Number of emails to fetch",
      short: "c",
    }),
    query: option(z.string().default("in:inbox is:unread"), {
      description: "Gmail search query",
      short: "q",
    }),
    notify: option(z.string().default("terminal"), {
      description: "Notification channels: terminal, whatsapp (comma-separated)",
      short: "n",
    }),
  },
  handler: async ({ flags }) => {
    session.length = 0;

    clack.intro(chalk.hex("#7C5CFC")("⛰ sherpa triage"));

    const s = clack.spinner();
    s.start("Connecting to Gmail...");

    try {
      await connectConfiguredServers();
    } catch {
      s.stop("Connection failed.");
      log.error("Could not connect to Gmail MCP server. Run `sherpa setup` first.");
      return;
    }

    s.message("Fetching inbox...");
    const messages = await searchEmails(flags.query, flags.count);

    if (messages.length === 0) {
      s.stop("Inbox zero — nothing to triage.");
      clack.outro("You're all clear.");
      return;
    }

    s.stop(`Found ${messages.length} messages.`);
    log.raw("");

    for (let i = 0; i < messages.length; i++) {
      log.raw(emailLine(i, messages[i]!));
    }
    log.raw("");

    // AI pre-analysis
    s.start("Analyzing with AI...");

    const emailSummary = messages
      .map(
        (m, i) =>
          `[${i + 1}] From: ${m.from}\n    Subject: ${m.subject}\n    Date: ${m.date}\n    Preview: ${truncate(m.snippet, 150)}`
      )
      .join("\n\n");

    const analysis = await runAgent(
      [
        {
          role: "user",
          content: `Triage these ${messages.length} inbox messages. For each one, recommend ONE action:
- IGNORE — safe to archive, low value
- FILTER — ignore AND create a Gmail filter to auto-archive future emails from this sender forever
- TODOIST — create a follow-up task (suggest the task title and due date)
- REPLY — needs a response (suggest a brief reply)

Be opinionated and concise. Group by action type.

${emailSummary}`,
        },
      ],
      { system: TRIAGE_SYSTEM }
    );

    s.stop("Analysis ready.");
    log.raw("");
    log.raw(chalk.bold("AI Recommendations:"));
    log.raw("");
    log.raw(analysis);
    log.raw("");

    // Interactive processing
    const mode = await clack.select({
      message: "How do you want to proceed?",
      options: [
        { value: "interactive", label: "Walk through emails one by one" },
        { value: "bulk-ignore", label: "Archive all IGNORE-recommended emails" },
        { value: "done", label: "Done — I'll handle it myself" },
      ],
    });

    if (clack.isCancel(mode) || mode === "done") {
      await sendSummary(messages.length, flags.notify);
      clack.outro(chalk.dim("Inbox reviewed."));
      return;
    }

    if (mode === "bulk-ignore") {
      await bulkIgnore(messages, analysis);
      await sendSummary(messages.length, flags.notify);
      clack.outro(chalk.dim("Bulk archive done."));
      return;
    }

    // Interactive mode
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;
      log.raw("");
      log.raw(chalk.bold(`── Email ${i + 1}/${messages.length} ──`));
      log.raw(emailLine(i, msg));

      const action = await clack.select({
        message: `Action for this email?`,
        options: [
          { value: "skip", label: "Skip — decide later" },
          { value: "ignore", label: "Ignore — archive it" },
          { value: "filter", label: "Filter — archive + never see this sender again" },
          { value: "todoist", label: "Todoist — create a follow-up task" },
          { value: "reply", label: "Reply — draft a follow-up" },
          { value: "read", label: "Read — show full email body first" },
          { value: "quit", label: "Quit triage" },
        ],
      });

      if (clack.isCancel(action) || action === "quit") {
        for (let j = i; j < messages.length; j++) {
          track(messages[j]!, "skipped");
        }
        break;
      }

      if (action === "skip") {
        track(msg, "skipped");
        continue;
      }

      if (action === "read") {
        const sp = clack.spinner();
        sp.start("Fetching email body...");
        const body = await readEmail(msg.id);
        sp.stop("Email body:");
        log.raw(chalk.dim("─".repeat(60)));
        log.raw(body);
        log.raw(chalk.dim("─".repeat(60)));
        i--;
        continue;
      }

      await executeAction(action as "ignore" | "filter" | "todoist" | "reply", msg);
    }

    await sendSummary(messages.length, flags.notify);
    clack.outro(chalk.dim("Triage complete."));
  },
});

async function sendSummary(totalEmails: number, notifyFlag: string): Promise<void> {
  if (session.length === 0) return;

  const channels = notifyFlag.split(",").map((c) => c.trim()) as ("terminal" | "whatsapp")[];
  const processed = session.filter((a) => a.action !== "skipped").length;

  const summary: TriageSummary = {
    total: totalEmails,
    processed,
    actions: session,
    timestamp: new Date(),
  };

  await notifySummary(summary, channels);
}

async function executeAction(
  action: "ignore" | "filter" | "todoist" | "reply",
  msg: EmailMessage
): Promise<void> {
  const s = clack.spinner();

  switch (action) {
    case "ignore": {
      s.start("Archiving...");
      await archiveEmail(msg.id);
      s.stop(chalk.green("Archived."));
      track(msg, "ignored");
      break;
    }

    case "filter": {
      const senderEmail = extractSenderEmail(msg.from);
      const domain = extractSenderDomain(msg.from);

      const filterBy = await clack.select({
        message: `Filter by sender or entire domain?`,
        options: [
          { value: "sender", label: `Sender: ${senderEmail}` },
          { value: "domain", label: `Domain: *@${domain}` },
        ],
      });

      if (clack.isCancel(filterBy)) return;

      s.start("Creating filter + archiving...");

      const filterTarget = filterBy === "domain" ? `*@${domain}` : senderEmail;
      const criteria =
        filterBy === "domain" ? { from: `@${domain}` } : { from: senderEmail };

      await createFilter(criteria, { removeLabelIds: ["INBOX"] });
      await archiveEmail(msg.id);
      s.stop(chalk.green(`Filtered ${filterTarget} → auto-archive forever.`));
      track(msg, "filtered", `Filter: ${filterTarget}`);
      break;
    }

    case "todoist": {
      const taskTitle = await clack.text({
        message: "Task title",
        initialValue: `Follow up: ${msg.subject}`,
      });

      if (clack.isCancel(taskTitle)) return;

      const dueDate = await clack.text({
        message: "Due date",
        placeholder: "tomorrow, next monday, 2026-03-01...",
        initialValue: "tomorrow",
      });

      if (clack.isCancel(dueDate)) return;

      s.start("Creating Todoist task...");
      try {
        await createTask(taskTitle as string, {
          dueString: dueDate as string,
          priority: 3,
        });
        s.stop(chalk.green(`Task created: ${taskTitle}`));
        track(msg, "todoist", `${taskTitle} (due: ${dueDate})`);
      } catch {
        s.stop(chalk.yellow("Todoist not connected — task not created."));
        track(msg, "skipped", "Todoist unavailable");
      }

      await archiveEmail(msg.id);
      break;
    }

    case "reply": {
      s.start("Drafting reply...");

      const draft = await runAgent(
        [
          {
            role: "user",
            content: `Draft a brief, professional reply to this email.
From: ${msg.from}
Subject: ${msg.subject}
Preview: ${msg.snippet}

Keep it concise — 2-4 sentences max. Match a warm but professional tone.`,
          },
        ],
        { system: "You draft email replies. Be concise, professional, and warm. Output only the reply body, no metadata." }
      );

      s.stop("Draft ready:");
      log.raw(chalk.dim("─".repeat(60)));
      log.raw(draft);
      log.raw(chalk.dim("─".repeat(60)));

      const confirm = await clack.select({
        message: "What to do with this draft?",
        options: [
          { value: "save", label: "Save as Gmail draft" },
          { value: "edit", label: "Edit before saving" },
          { value: "discard", label: "Discard" },
        ],
      });

      if (clack.isCancel(confirm) || confirm === "discard") {
        track(msg, "skipped", "Draft discarded");
        return;
      }

      let finalBody = draft;

      if (confirm === "edit") {
        const edited = await clack.text({
          message: "Edit your reply",
          initialValue: draft,
        });
        if (clack.isCancel(edited)) return;
        finalBody = edited as string;
      }

      const senderEmail = extractSenderEmail(msg.from);
      const reSubject = msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`;

      s.start("Saving draft in Gmail...");
      await createDraft(senderEmail, reSubject, finalBody);
      s.stop(chalk.green("Draft saved in Gmail."));
      track(msg, "drafted", `Reply to ${senderEmail}: ${msg.subject}`);
      break;
    }
  }
}

async function bulkIgnore(messages: EmailMessage[], analysis: string): Promise<void> {
  const s = clack.spinner();

  const ignoreIds: { id: string; msg: EmailMessage }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const marker = `[${i + 1}]`;
    const section = analysis.toLowerCase();
    const markerIdx = section.indexOf(marker.toLowerCase());
    if (markerIdx === -1) {
      track(messages[i]!, "skipped");
      continue;
    }

    const surrounding = section.slice(markerIdx, markerIdx + 200);
    if (surrounding.includes("ignore") || surrounding.includes("archive") || surrounding.includes("filter")) {
      ignoreIds.push({ id: messages[i]!.id, msg: messages[i]! });
    } else {
      track(messages[i]!, "skipped");
    }
  }

  if (ignoreIds.length === 0) {
    log.info("No emails were recommended for archiving.");
    return;
  }

  const confirm = await clack.confirm({
    message: `Archive ${ignoreIds.length} emails?`,
  });

  if (!confirm || clack.isCancel(confirm)) return;

  s.start(`Archiving ${ignoreIds.length} emails...`);
  for (const { id, msg } of ignoreIds) {
    await archiveEmail(id);
    track(msg, "ignored");
  }
  s.stop(chalk.green(`Archived ${ignoreIds.length} messages.`));
}
