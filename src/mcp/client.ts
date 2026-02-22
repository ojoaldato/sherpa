import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpServerConfig } from "../config/index.ts";
import { log } from "../utils/index.ts";

export interface McpConnection {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

export class McpClientManager {
  private connections: Map<string, McpConnection> = new Map();

  async connect(name: string, config: McpServerConfig): Promise<McpConnection> {
    if (this.connections.has(name)) {
      return this.connections.get(name)!;
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env } as Record<string, string>,
    });

    const client = new Client({ name: `sherpa-${name}`, version: "0.1.0" });

    await client.connect(transport);
    log.success(`Connected to MCP server: ${name}`);

    const conn: McpConnection = { name, client, transport };
    this.connections.set(name, conn);
    return conn;
  }

  async listTools(name: string): Promise<string[]> {
    const conn = this.connections.get(name);
    if (!conn) throw new Error(`MCP server "${name}" not connected`);

    const result = await conn.client.listTools();
    return result.tools.map((t) => t.name);
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown> = {}) {
    const conn = this.connections.get(serverName);
    if (!conn) throw new Error(`MCP server "${serverName}" not connected`);

    return conn.client.callTool({ name: toolName, arguments: args });
  }

  getConnection(name: string): McpConnection | undefined {
    return this.connections.get(name);
  }

  get connectedServers(): string[] {
    return [...this.connections.keys()];
  }

  async disconnectAll(): Promise<void> {
    for (const [name, conn] of this.connections) {
      try {
        await conn.transport.close();
        log.dim(`Disconnected: ${name}`);
      } catch {
        log.warn(`Failed to disconnect: ${name}`);
      }
    }
    this.connections.clear();
  }
}

let _manager: McpClientManager | null = null;

export function getMcpManager(): McpClientManager {
  if (!_manager) _manager = new McpClientManager();
  return _manager;
}
