import { google, type gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

type Gmail = gmail_v1.Gmail;

function getGmail(auth: OAuth2Client): Gmail {
  return google.gmail({ version: "v1", auth });
}

export async function searchEmails(
  auth: OAuth2Client,
  query: string,
  maxResults: number
): Promise<object[]> {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messageIds = res.data.messages ?? [];
  const messages = await Promise.all(
    messageIds.map((m) => getEmailSummary(gmail, m.id!))
  );

  return messages;
}

export async function readEmail(
  auth: OAuth2Client,
  messageId: string
): Promise<string> {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers ?? [];
  const from = headers.find((h) => h.name === "From")?.value ?? "";
  const to = headers.find((h) => h.name === "To")?.value ?? "";
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
  const date = headers.find((h) => h.name === "Date")?.value ?? "";
  const body = extractBody(res.data.payload);

  return `From: ${from}\nTo: ${to}\nSubject: ${subject}\nDate: ${date}\n\n${body}`;
}

export async function modifyEmail(
  auth: OAuth2Client,
  messageId: string,
  addLabels: string[] = [],
  removeLabels: string[] = []
): Promise<void> {
  const gmail = getGmail(auth);
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: addLabels,
      removeLabelIds: removeLabels,
    },
  });
}

export async function createDraft(
  auth: OAuth2Client,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const gmail = getGmail(auth);
  const raw = buildRawEmail(to, subject, body);

  await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: { raw },
    },
  });
}

export async function createFilter(
  auth: OAuth2Client,
  criteria: { from?: string; to?: string; subject?: string; query?: string },
  action: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<void> {
  const gmail = getGmail(auth);
  await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: { criteria, action },
  });
}

export async function listLabels(auth: OAuth2Client): Promise<object[]> {
  const gmail = getGmail(auth);
  const res = await gmail.users.labels.list({ userId: "me" });
  return res.data.labels ?? [];
}

// ── Helpers ────────────────────────────────────────────

async function getEmailSummary(gmail: Gmail, messageId: string): Promise<object> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Subject", "Date"],
  });

  const headers = res.data.payload?.headers ?? [];

  return {
    id: res.data.id,
    threadId: res.data.threadId,
    from: headers.find((h) => h.name === "From")?.value ?? "",
    to: headers.find((h) => h.name === "To")?.value ?? "",
    subject: headers.find((h) => h.name === "Subject")?.value ?? "",
    date: headers.find((h) => h.name === "Date")?.value ?? "",
    snippet: res.data.snippet ?? "",
    labels: res.data.labelIds ?? [],
  };
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return Buffer.from(htmlPart.body.data, "base64url").toString("utf-8")
        .replace(/<[^>]+>/g, "");
    }

    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

function buildRawEmail(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    body,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}
