import { getMcpManager } from "../../mcp/index.ts";
import { log } from "../../utils/index.ts";

const SERVER = "gmail";

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labels: string[];
  body?: string;
}

export interface EmailBatch {
  messages: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export async function listInboxMessages(maxResults = 50): Promise<EmailBatch> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "gmail_list_messages", {
    query: "in:inbox",
    maxResults,
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

export async function getMessage(messageId: string): Promise<EmailMessage> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "gmail_get_message", {
    messageId,
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

export async function archiveMessages(messageIds: string[]): Promise<void> {
  const mcp = getMcpManager();
  for (const id of messageIds) {
    await mcp.callTool(SERVER, "gmail_modify_message", {
      messageId: id,
      removeLabelIds: ["INBOX"],
    });
  }
  log.success(`Archived ${messageIds.length} messages`);
}

export async function batchModifyLabels(
  messageIds: string[],
  addLabels: string[] = [],
  removeLabels: string[] = []
): Promise<void> {
  const mcp = getMcpManager();
  for (const id of messageIds) {
    await mcp.callTool(SERVER, "gmail_modify_message", {
      messageId: id,
      addLabelIds: addLabels,
      removeLabelIds: removeLabels,
    });
  }
}

export async function createDraft(to: string, subject: string, body: string): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "gmail_create_draft", { to, subject, body });
  log.success(`Draft created → ${to}`);
}

export async function searchMessages(query: string, maxResults = 20): Promise<EmailBatch> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "gmail_list_messages", {
    query,
    maxResults,
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}
