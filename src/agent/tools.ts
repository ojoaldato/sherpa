import { tool } from "ai";
import { z } from "zod";
import { confirmAction } from "./confirm.ts";
import {
  searchEmails,
  readEmail,
  archiveEmail,
  createFilter,
  createDraft,
} from "../integrations/gmail/index.ts";
import {
  listUpcomingEvents,
  getEventsForDay,
  createEvent,
} from "../integrations/calendar/index.ts";
import {
  getActiveTasks,
  getTasksByFilter,
  createTask,
  completeTask,
} from "../integrations/todoist/index.ts";
import {
  searchLocalDocs,
  readDocument,
  listPlans,
} from "../integrations/obsidian/index.ts";
import { loadSettings } from "../config/index.ts";

export function createSherpaTools() {
  return {

    // ── Gmail ──────────────────────────────────────────────

    gmail_search: tool({
      description: "Search Gmail inbox. Use Gmail search syntax (from:, subject:, is:unread, has:attachment, after:, before:, label:, etc). Returns a list of emails with id, from, subject, date, snippet.",
      inputSchema: z.object({
        query: z.string().describe("Gmail search query, e.g. 'in:inbox is:unread' or 'from:boss@company.com'"),
        maxResults: z.number().default(25).describe("Max emails to return"),
      }),
      execute: async ({ query, maxResults }) => {
        const messages = await searchEmails(query, maxResults);
        return { count: messages.length, messages };
      },
    }),

    gmail_read: tool({
      description: "Read the full body of a specific email by its message ID. Use after searching to get details.",
      inputSchema: z.object({
        messageId: z.string().describe("The email message ID"),
      }),
      execute: async ({ messageId }) => {
        const body = await readEmail(messageId);
        return { body };
      },
    }),

    gmail_archive: tool({
      description: "Archive one or more emails (remove from inbox). This is a destructive action — use when the user agrees to archive.",
      inputSchema: z.object({
        messageIds: z.array(z.string()).describe("Email message IDs to archive"),
        reason: z.string().describe("Brief reason for archiving, shown to user for confirmation"),
      }),
      execute: async ({ messageIds, reason }) => {
        const confirmed = await confirmAction(
          `Archive ${messageIds.length} email${messageIds.length > 1 ? "s" : ""}? (${reason})`
        );
        if (!confirmed) return { success: false, reason: "User declined" };

        for (const id of messageIds) {
          await archiveEmail(id);
        }
        return { success: true, archived: messageIds.length };
      },
    }),

    gmail_create_filter: tool({
      description: "Create a Gmail filter to auto-archive future emails from a sender or domain. Destructive — this permanently filters. Use when user wants to never see emails from a sender again.",
      inputSchema: z.object({
        from: z.string().describe("Sender email or @domain to filter"),
        description: z.string().describe("Human-readable description of what this filter does"),
      }),
      execute: async ({ from, description }) => {
        const confirmed = await confirmAction(
          `Create filter: ${description}`
        );
        if (!confirmed) return { success: false, reason: "User declined" };

        await createFilter({ from }, { removeLabelIds: ["INBOX"] });
        return { success: true, filter: from };
      },
    }),

    gmail_draft: tool({
      description: "Create a draft email reply in Gmail. Does NOT send — saves as draft for the user to review and send manually.",
      inputSchema: z.object({
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Email body text"),
      }),
      execute: async ({ to, subject, body }) => {
        const confirmed = await confirmAction(
          `Save draft reply to ${to}?`
        );
        if (!confirmed) return { success: false, reason: "User declined" };

        await createDraft(to, subject, body);
        return { success: true, to, subject };
      },
    }),

    // ── Calendar ───────────────────────────────────────────

    calendar_upcoming: tool({
      description: "List upcoming calendar events for the next N days. Shows meeting titles, times, attendees.",
      inputSchema: z.object({
        days: z.number().default(7).describe("Number of days to look ahead"),
      }),
      execute: async ({ days }) => {
        const events = await listUpcomingEvents(days);
        return { count: events.length, events };
      },
    }),

    calendar_today: tool({
      description: "Get today's calendar events.",
      inputSchema: z.object({}),
      execute: async () => {
        const events = await getEventsForDay(new Date());
        return { count: events.length, events };
      },
    }),

    calendar_create_event: tool({
      description: "Create a new calendar event (e.g. block deep work time, schedule a meeting).",
      inputSchema: z.object({
        summary: z.string().describe("Event title"),
        start: z.string().describe("Start time as ISO 8601 string"),
        end: z.string().describe("End time as ISO 8601 string"),
        description: z.string().optional().describe("Event description"),
      }),
      execute: async ({ summary, start, end, description }) => {
        const confirmed = await confirmAction(
          `Create event: "${summary}" (${start} → ${end})?`
        );
        if (!confirmed) return { success: false, reason: "User declined" };

        await createEvent(summary, start, end, description);
        return { success: true, summary, start, end };
      },
    }),

    // ── Todoist ────────────────────────────────────────────

    todoist_active: tool({
      description: "Get active tasks from Todoist (today + overdue).",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await getActiveTasks();
        return { count: tasks.length, tasks };
      },
    }),

    todoist_search: tool({
      description: "Search Todoist tasks with a filter query. Supports Todoist filter syntax like 'due before: +7 days', 'priority 1', 'assigned to: me', '#ProjectName'.",
      inputSchema: z.object({
        filter: z.string().describe("Todoist filter query"),
      }),
      execute: async ({ filter }) => {
        const tasks = await getTasksByFilter(filter);
        return { count: tasks.length, tasks };
      },
    }),

    todoist_create: tool({
      description: "Create a new task in Todoist.",
      inputSchema: z.object({
        content: z.string().describe("Task title/content"),
        dueString: z.string().optional().describe("Due date in natural language: 'tomorrow', 'next monday', '2026-03-01'"),
        priority: z.number().min(1).max(4).default(3).describe("Priority: 1=urgent, 2=high, 3=medium, 4=low"),
        project: z.string().optional().describe("Project name"),
      }),
      execute: async ({ content, dueString, priority, project }) => {
        const confirmed = await confirmAction(
          `Create task: "${content}"${dueString ? ` (due: ${dueString})` : ""}?`
        );
        if (!confirmed) return { success: false, reason: "User declined" };

        await createTask(content, { dueString, priority, project });
        return { success: true, content, dueString, priority };
      },
    }),

    todoist_complete: tool({
      description: "Mark a Todoist task as complete.",
      inputSchema: z.object({
        taskId: z.string().describe("The task ID to complete"),
      }),
      execute: async ({ taskId }) => {
        const confirmed = await confirmAction(`Complete task ${taskId}?`);
        if (!confirmed) return { success: false, reason: "User declined" };

        await completeTask(taskId);
        return { success: true, taskId };
      },
    }),

    // ── Obsidian / Local Docs ──────────────────────────────

    docs_search: tool({
      description: "Search local markdown documents (Obsidian vault, plans, goals, notes). Returns matching files with content previews. Use to find meeting notes, project plans, goals, personal references.",
      inputSchema: z.object({
        query: z.string().describe("Search query — matches filenames and content"),
        dirs: z.array(z.string()).optional().describe("Specific directories to search (defaults to configured vault)"),
      }),
      execute: async ({ query, dirs }) => {
        const results = await searchLocalDocs(query, dirs);
        return {
          count: results.length,
          documents: results.slice(0, 10).map((d) => ({
            path: d.path,
            filename: d.filename,
            preview: d.content.slice(0, 500),
            modified: d.modified.toISOString(),
          })),
        };
      },
    }),

    docs_read: tool({
      description: "Read the full content of a local markdown document by path.",
      inputSchema: z.object({
        path: z.string().describe("Absolute path to the document"),
      }),
      execute: async ({ path }) => {
        const content = await readDocument(path);
        return { path, content };
      },
    }),

    docs_list_plans: tool({
      description: "List all plan/goal documents from configured plan directories. Use to review current goals, OKRs, project plans.",
      inputSchema: z.object({}),
      execute: async () => {
        const settings = await loadSettings();
        const planDirs = settings.obsidian.planDirs.map((d) =>
          settings.obsidian.vaultPath ? `${settings.obsidian.vaultPath}/${d}` : d
        );
        const docs = await listPlans(planDirs);
        return {
          count: docs.length,
          plans: docs.map((d) => ({
            filename: d.filename,
            path: d.path,
            preview: d.content.slice(0, 300),
            modified: d.modified.toISOString(),
          })),
        };
      },
    }),
  };
}
