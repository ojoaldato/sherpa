import { getMcpManager } from "../../mcp/index.ts";

const SERVER = "google-calendar";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  status: string;
}

export async function listUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const mcp = getMcpManager();
  const now = new Date();
  const until = new Date(now.getTime() + days * 86400000);

  const result = await mcp.callTool(SERVER, "calendar_list_events", {
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    maxResults: 100,
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "[]";
  return JSON.parse(text);
}

export async function getEventsForDay(date: Date): Promise<CalendarEvent[]> {
  const mcp = getMcpManager();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const result = await mcp.callTool(SERVER, "calendar_list_events", {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "[]";
  return JSON.parse(text);
}

export async function createEvent(
  summary: string,
  start: string,
  end: string,
  description?: string
): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "calendar_create_event", {
    summary,
    start,
    end,
    description,
  });
}
