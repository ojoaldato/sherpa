import chalk from "chalk";
import { log } from "./logger.ts";

export interface TriageAction {
  email: { from: string; subject: string };
  action: "ignored" | "filtered" | "todoist" | "drafted" | "skipped";
  detail?: string;
}

export interface TriageSummary {
  total: number;
  processed: number;
  actions: TriageAction[];
  timestamp: Date;
}

export function buildSummaryText(summary: TriageSummary): string {
  const lines: string[] = [];
  const counts = {
    ignored: 0,
    filtered: 0,
    todoist: 0,
    drafted: 0,
    skipped: 0,
  };

  for (const a of summary.actions) {
    counts[a.action]++;
  }

  lines.push(`Inbox Triage Summary — ${summary.timestamp.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
  lines.push("");
  lines.push(`${summary.total} emails reviewed, ${summary.processed} acted on`);
  lines.push("");

  if (counts.ignored > 0) lines.push(`  Archived:  ${counts.ignored}`);
  if (counts.filtered > 0) lines.push(`  Filtered:  ${counts.filtered}`);
  if (counts.todoist > 0) lines.push(`  Tasks:     ${counts.todoist}`);
  if (counts.drafted > 0) lines.push(`  Drafts:    ${counts.drafted}`);
  if (counts.skipped > 0) lines.push(`  Skipped:   ${counts.skipped}`);

  const actionItems = summary.actions.filter(
    (a) => a.action === "todoist" || a.action === "drafted"
  );

  if (actionItems.length > 0) {
    lines.push("");
    lines.push("Follow-ups:");
    for (const a of actionItems) {
      const icon = a.action === "todoist" ? "☐" : "✉";
      lines.push(`  ${icon} ${a.detail ?? a.email.subject}`);
    }
  }

  const filtered = summary.actions.filter((a) => a.action === "filtered");
  if (filtered.length > 0) {
    lines.push("");
    lines.push("New filters:");
    for (const a of filtered) {
      lines.push(`  ✕ ${a.detail ?? a.email.from}`);
    }
  }

  return lines.join("\n");
}

/**
 * Print triage summary to terminal.
 * This is the current notification sink.
 * Future: add WhatsApp, Slack, etc.
 */
export async function notifySummary(
  summary: TriageSummary,
  channels: ("terminal" | "whatsapp")[] = ["terminal"]
): Promise<void> {
  const text = buildSummaryText(summary);

  for (const channel of channels) {
    switch (channel) {
      case "terminal": {
        log.raw("");
        log.raw(chalk.hex("#7C5CFC").bold("┌─ Triage Summary ─────────────────────────────"));
        for (const line of text.split("\n")) {
          log.raw(chalk.hex("#7C5CFC")("│ ") + line);
        }
        log.raw(chalk.hex("#7C5CFC").bold("└──────────────────────────────────────────────"));
        break;
      }

      case "whatsapp": {
        // TODO: Implement WhatsApp delivery
        // Will use WhatsApp Business API or bridge MCP
        log.dim("WhatsApp notifications coming soon.");
        break;
      }
    }
  }
}
