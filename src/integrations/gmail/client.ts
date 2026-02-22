import { getMcpManager } from "../../mcp/index.ts";
import { log } from "../../utils/index.ts";

const SERVER = "gmail";

export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  labels?: string[];
}

function extractText(result: unknown): string {
  const content = result as { content?: Array<{ type: string; text?: string }> };
  return content.content?.find((c) => c.type === "text")?.text ?? "{}";
}

export async function searchEmails(query: string, maxResults = 50): Promise<EmailMessage[]> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "search_emails", { query, maxResults });
  const text = extractText(result);

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.messages ?? [];
  } catch {
    return [];
  }
}

export async function readEmail(messageId: string): Promise<string> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "read_email", { messageId });
  return extractText(result);
}

export async function archiveEmail(messageId: string): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "archive_email", { messageIds: [messageId] });
}

export async function batchArchive(messageIds: string[]): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "archive_email", { messageIds });
  log.success(`Archived ${messageIds.length} messages`);
}

export async function createFilter(
  criteria: { from?: string; to?: string; subject?: string; query?: string },
  action: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "create_filter", {
    from: criteria.from,
    to: criteria.to,
    subject: criteria.subject,
    query: criteria.query,
    addLabels: action.addLabelIds,
    removeLabels: action.removeLabelIds,
  });
}

export async function createDraft(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "draft_email", { to, subject, body });
  log.success(`Draft created → ${to}`);
}
