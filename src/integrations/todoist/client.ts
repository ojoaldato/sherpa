import { getMcpManager } from "../../mcp/index.ts";

const SERVER = "todoist";

export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  project?: string;
  due?: { date: string; string: string; recurring: boolean };
  priority: number;
  labels: string[];
  completed: boolean;
}

export async function getActiveTasks(): Promise<TodoistTask[]> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "todoist_get_tasks", {
    filter: "today | overdue",
  });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "[]";
  return JSON.parse(text);
}

export async function getTasksByFilter(filter: string): Promise<TodoistTask[]> {
  const mcp = getMcpManager();
  const result = await mcp.callTool(SERVER, "todoist_get_tasks", { filter });

  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "[]";
  return JSON.parse(text);
}

export async function createTask(
  content: string,
  options: { dueString?: string; priority?: number; project?: string; labels?: string[] } = {}
): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "todoist_create_task", {
    content,
    ...options,
  });
}

export async function completeTask(taskId: string): Promise<void> {
  const mcp = getMcpManager();
  await mcp.callTool(SERVER, "todoist_complete_task", { taskId });
}
