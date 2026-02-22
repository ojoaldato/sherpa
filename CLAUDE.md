# CLAUDE.md — Project Instructions for Sherpa

> This file is for AI assistants (Claude, Cursor, etc.) working on this codebase.
> It is intentionally committed to the repo as part of the open-source project.

## What is Sherpa?

Sherpa is a local-first CLI that acts as an **Agentic Guide for Engineering Managers**. It consolidates Gmail, Google Calendar, Todoist, Obsidian, and local markdown into a single terminal experience, powered by the Model Context Protocol (MCP) and the Vercel AI SDK.

**One-liner:** A terminal command center that triages your inbox, plans your week, and keeps your goals in sight.

## Tech Stack

- **Runtime:** Bun (not Node.js). Use `bun` for everything — running, testing, building, installing.
- **CLI Framework:** bunli (`@bunli/core`). Commands live in `src/commands/` using `defineCommand`.
- **AI:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`). Agent logic lives in `src/agent/`.
- **MCP:** `@modelcontextprotocol/sdk`. Client mesh in `src/mcp/`. Each integration talks through MCP servers via stdio/sse/http transports.
- **Interactive UI:** `@clack/prompts` for spinners, selects, text inputs. Terminal UX matters.
- **Validation:** Zod v4 for schemas and option parsing.
- **Styling:** chalk for terminal colors.

## Project Structure

```
src/
  cli.ts              # Entry point — creates the CLI with bunli
  commands/            # CLI commands (triage, plan, briefing, setup)
    shared.ts          # Shared helpers (MCP connection bootstrap)
  agent/               # AI agent logic and system prompts
    sherpa.ts          # runAgent() — Vercel AI SDK wrapper
    prompts.ts         # System prompts per command
  mcp/                 # MCP client manager
    client.ts          # McpClientManager class, transport handling
  integrations/        # Per-platform data access
    gmail/             # Inbox list, archive, draft, search
    calendar/          # Events list, create
    todoist/           # Tasks list, create, complete
    obsidian/          # Local markdown search, plans, goals (no MCP needed)
  config/              # Settings, env loading
    env.ts             # Zod-validated env vars (Bun auto-loads .env)
    settings.ts        # ~/.config/sherpa/settings.json management
  utils/               # Logger, formatters
```

## Key Conventions

### Bun, not Node
- Use `Bun.file()`, `Bun.write()`, `Bun.$` for file/shell ops. Never use `fs` or `child_process`.
- Bun auto-loads `.env` — do not install or use dotenv.
- Use `bun test` for testing. Import from `bun:test`.
- Use `.ts` extensions in all imports.

### Commands
- Every command is a `defineCommand()` from `@bunli/core`.
- Commands use `@clack/prompts` for interactive UX (spinners, selects, confirms).
- Commands call `connectConfiguredServers()` from `shared.ts` to bootstrap MCP connections.
- Command files export `default`.

### MCP Integration Pattern
- All external service calls go through `McpClientManager` in `src/mcp/client.ts`.
- Integration modules in `src/integrations/` wrap MCP tool calls with typed interfaces.
- Obsidian/local markdown is the exception — direct filesystem access via `Bun.file()` and `Bun.Glob` for privacy.

### AI Agent Pattern
- `runAgent()` in `src/agent/sherpa.ts` is the single entry point for LLM calls.
- System prompts are defined in `src/agent/prompts.ts` — one per use case.
- All LLM calls use Vercel AI SDK's `generateText` with Anthropic models.
- Keep prompts tight and opinionated. This is a terminal tool, not a chatbot.

### Configuration
- User config lives at `~/.config/sherpa/settings.json`.
- API keys go in `~/.config/sherpa/.env` or the project `.env`.
- `sherpa setup` runs an interactive wizard to configure everything.
- Schema validation via Zod on all config/env.

### Code Style
- TypeScript strict mode. No `any` unless absolutely necessary.
- Prefer `async/await` over `.then()` chains.
- Use `Promise.allSettled()` for parallel data fetching (graceful partial failures).
- Keep functions small. One integration module per service.
- No comments that just restate what the code does.

## Running Locally

```bash
bun install
bun run dev -- triage        # Run triage in dev mode
bun run dev -- plan           # Run weekly planner
bun run dev -- briefing       # Daily briefing
bun run dev -- setup          # Configure integrations
```

## Building

```bash
bun run build                          # JS bundle
bunli build --targets native           # Standalone binary for current platform
```

## What NOT to Do

- Do not add Express, Fastify, or any HTTP server framework.
- Do not use dotenv — Bun handles `.env` natively.
- Do not store secrets in code or commit `.env` files.
- Do not add React, Vue, or any frontend framework — this is a CLI.
- Do not use `console.log` directly for user output — use `log` from `src/utils/logger.ts` or `@clack/prompts`.
- Do not create MCP servers — Sherpa is a client that connects to external MCP servers.

## Current Phase: 1 — Cognitive De-cluttering

Priority order:
1. **Gmail triage** — semantic inbox cleanup via AI
2. **Weekly planning** — calendar + todoist + local goals/plans
3. **Daily briefing** — synthesized morning readout

Future phases will add Jira, Confluence, Slack, and full SDLC orchestration.
