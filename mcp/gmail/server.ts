#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAuthenticatedClient, runAuthFlow } from "./auth.js";
import {
  searchEmails,
  readEmail,
  modifyEmail,
  createDraft,
  createFilter,
  listLabels,
} from "./tools.js";

if (process.argv.includes("auth")) {
  await runAuthFlow();
  process.exit(0);
}

const server = new McpServer({
  name: "sherpa-gmail",
  version: "1.0.0",
});

let auth = await getAuthenticatedClient();

server.tool(
  "search_emails",
  "Search emails matching a Gmail query (same syntax as Gmail search bar)",
  {
    query: z.string().describe("Gmail search query, e.g. 'is:unread', 'from:foo@bar.com'"),
    maxResults: z.number().default(20).describe("Max results to return"),
  },
  async ({ query, maxResults }) => {
    const results = await searchEmails(auth, query, maxResults);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "read_email",
  "Read the full content of a specific email by its message ID",
  {
    messageId: z.string().describe("The Gmail message ID"),
  },
  async ({ messageId }) => {
    const text = await readEmail(auth, messageId);
    return {
      content: [{ type: "text" as const, text }],
    };
  }
);

server.tool(
  "archive_email",
  "Archive one or more emails (removes INBOX label)",
  {
    messageIds: z.array(z.string()).describe("Array of message IDs to archive"),
  },
  async ({ messageIds }) => {
    for (const id of messageIds) {
      await modifyEmail(auth, id, [], ["INBOX"]);
    }
    return {
      content: [{ type: "text" as const, text: `Archived ${messageIds.length} email(s)` }],
    };
  }
);

server.tool(
  "trash_email",
  "Move one or more emails to trash",
  {
    messageIds: z.array(z.string()).describe("Array of message IDs to trash"),
  },
  async ({ messageIds }) => {
    for (const id of messageIds) {
      await modifyEmail(auth, id, ["TRASH"], ["INBOX"]);
    }
    return {
      content: [{ type: "text" as const, text: `Trashed ${messageIds.length} email(s)` }],
    };
  }
);

server.tool(
  "draft_email",
  "Create a draft reply or new email",
  {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body text"),
  },
  async ({ to, subject, body }) => {
    await createDraft(auth, to, subject, body);
    return {
      content: [{ type: "text" as const, text: `Draft created: "${subject}" → ${to}` }],
    };
  }
);

server.tool(
  "create_filter",
  "Create a Gmail filter to automatically process future emails",
  {
    from: z.string().optional().describe("Filter by sender address"),
    to: z.string().optional().describe("Filter by recipient"),
    subject: z.string().optional().describe("Filter by subject keywords"),
    query: z.string().optional().describe("Freeform Gmail query for matching"),
    addLabels: z.array(z.string()).optional().describe("Label IDs to add"),
    removeLabels: z.array(z.string()).optional().describe("Label IDs to remove (e.g. INBOX for skip-inbox)"),
  },
  async ({ from, to, subject, query, addLabels, removeLabels }) => {
    await createFilter(
      auth,
      { from, to, subject, query },
      { addLabelIds: addLabels, removeLabelIds: removeLabels }
    );
    return {
      content: [{ type: "text" as const, text: "Filter created successfully" }],
    };
  }
);

server.tool(
  "list_labels",
  "List all Gmail labels (useful for creating filters)",
  {},
  async () => {
    const labels = await listLabels(auth);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(labels, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
