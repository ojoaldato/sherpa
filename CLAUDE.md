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
  cli.ts              # Entry point — no-arg → REPL, subcommand → bunli router
  commands/
    chat.ts           # Conversational REPL command (also default mode)
    triage.ts         # Guided Gmail inbox triage with 4 actions + summary
    plan.ts           # Weekly planner (calendar + todoist + local plans)
    briefing.ts       # Daily briefing (calendar + tasks + inbox)
    setup.ts          # Interactive config wizard
    shared.ts         # Shared helpers (MCP connection bootstrap)
  agent/
    repl.ts           # Conversational REPL loop — streamText + all tools
    tools.ts          # AI SDK tool definitions wrapping all integrations
    sherpa.ts         # runAgent() — Vercel AI SDK generateText wrapper
    prompts.ts        # System prompts per command mode
    confirm.ts        # Confirmation prompts for destructive tool actions
  mcp/
    client.ts         # McpClientManager — connects to stdio/sse/http MCP servers
  integrations/
    gmail/            # search, read, archive, filter, draft via MCP
    calendar/         # list events, create events via MCP
    todoist/          # tasks list, create, complete via MCP
    obsidian/         # Local markdown search, read, plans (direct filesystem, no MCP)
  config/
    env.ts            # Zod-validated env vars (Bun auto-loads .env)
    settings.ts       # ~/.config/sherpa/settings.json management
  utils/
    logger.ts         # Branded terminal logger (log.info, log.success, etc.)
    format.ts         # Date formatting, truncation, section headers
    notify.ts         # Notification system — summary builder + channel dispatch
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

### Conversational REPL (default mode)
- `sherpa` (no subcommand) or `sherpa chat` enters the interactive REPL.
- The REPL uses `streamText` from Vercel AI SDK with all tools available.
- The AI decides which tools to call based on natural language input.
- Destructive actions (archive, filter, create task/event) trigger a confirmation prompt inside the tool's `execute` function — the agent doesn't need to ask separately.
- Conversation history is stateful within a session. Type `clear` to reset, `exit` to quit.
- The system prompt is in `src/agent/repl.ts` — it instructs the agent to be proactive, concise, and opinionated.

### Notification System
- `src/utils/notify.ts` provides `notifySummary()` with pluggable channels.
- Currently supports `terminal`. WhatsApp channel is stubbed for future implementation.
- Triage command tracks all actions in a session and outputs a boxed summary at the end.
- `--notify terminal,whatsapp` flag on triage controls delivery channels.

## Running Locally

```bash
bun install
bun src/cli.ts               # Interactive REPL (default)
bun run dev -- chat           # Same, via bunli dev
bun run dev -- triage         # Guided inbox triage
bun run dev -- plan           # Weekly planner
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

## Roadmap Maintenance — CRITICAL

The project roadmap lives in `ROADMAP.md` at the repo root. **You MUST keep it in sync after every iteration.**

### After completing work, always:

1. **Update `ROADMAP.md`** — check off completed items, add new items discovered during implementation, move things between phases if scope changed. If `ROADMAP.md` doesn't exist yet, create it from `.cursor/plan.md`.
2. **Update the Project Structure section above** if you added new files, directories, or changed the architecture.
3. **Update this file (`CLAUDE.md`)** if you introduced new conventions, patterns, tools, or dependencies that future contributors need to know about.

### Rules:

- Never leave a completed feature unchecked in the roadmap.
- If you build something not on the roadmap, add it and mark it done.
- If you discover work that needs doing, add it as a new item in the appropriate phase.
- If a planned item turns out to be unnecessary, mark it as cancelled with a brief reason.
- Keep `ROADMAP.md` as the single source of truth for what's built, what's next, and what's deferred.
- `CLAUDE.md` is for *how to work on the code*. `ROADMAP.md` is for *what to build*.
- `.cursor/plan.md` is a private scratchpad — it may be out of date. Always trust `ROADMAP.md`.

## Current Phase: 1 — Cognitive De-cluttering

Priority order:
1. **Gmail triage** — semantic inbox cleanup via AI (interactive + REPL)
2. **Conversational REPL** — Claude Code-style natural language interface with tool calling
3. **Weekly planning** — calendar + todoist + local goals/plans
4. **Daily briefing** — synthesized morning readout
5. **Notification summaries** — terminal now, WhatsApp next

Future phases will add Jira, Confluence, Slack, and full SDLC orchestration.
See `ROADMAP.md` for the full plan.
