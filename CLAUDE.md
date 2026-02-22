# CLAUDE.md — Project Instructions for Sherpa

> This file is for AI assistants (Claude, Cursor, etc.) working on this codebase.
> It is intentionally committed to the repo as part of the open-source project.

## What is Sherpa?

Sherpa is a local-first CLI that acts as an **Agentic Guide for Engineering Managers**. It consolidates Gmail, Google Calendar, Todoist, Obsidian, and local markdown into a single terminal experience, powered by the Model Context Protocol (MCP) and the Vercel AI SDK.

**One-liner:** A terminal command center that triages your inbox, plans your week, and keeps your goals in sight.

## Tech Stack

- **Runtime:** Bun (not Node.js). Use `bun` for everything — running, testing, building, installing.
- **CLI Framework:** bunli (`@bunli/core`). Commands live in `src/commands/` using `defineCommand`.
- **AI:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic` / `@ai-sdk/openai` / `@ai-sdk/google`). Agent logic lives in `src/agent/`.
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
    shared.ts         # Shared helpers (MCP connection bootstrap, built-in server paths)
  agent/
    repl.ts           # Conversational REPL loop — streamText + all tools
    tools.ts          # AI SDK tool definitions wrapping all integrations
    sherpa.ts         # runAgent() — Vercel AI SDK generateText wrapper
    prompts.ts        # System prompts per command mode
    confirm.ts        # Confirmation prompts for destructive tool actions
  mcp/
    client.ts         # McpClientManager — connects to stdio/sse/http MCP servers
  integrations/
    gmail/            # search, read, archive, filter, draft via built-in MCP server
    calendar/         # list events, create events via MCP
    todoist/          # tasks list, create, complete via MCP
    obsidian/         # Local markdown search, read, plans (direct filesystem, no MCP)
  config/
    env.ts            # Zod-validated env vars (Bun auto-loads .env)
    settings.ts       # ~/.config/sherpa/settings.json management
    keychain.ts       # macOS Keychain integration for API keys
    provider.ts       # LLM provider factory (Anthropic, OpenAI, Google)
  utils/
    logger.ts         # Branded terminal logger (log.info, log.success, etc.)
    format.ts         # Date formatting, truncation, section headers
    notify.ts         # Notification system — summary builder + channel dispatch
    paths.ts          # Path traversal protection

mcp/
  gmail/
    server.ts         # Built-in Gmail MCP server (sherpa-gmail)
    auth.ts           # OAuth 2.0 flow for Google (macOS Keychain + local creds)
    tools.ts          # Gmail API operations via googleapis
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
- Built-in MCP servers live in `mcp/` — owned and auditable. The Gmail server (`mcp/gmail/`) is the first example.
- Obsidian/local markdown is the exception — direct filesystem access via `Bun.file()` and `Bun.Glob` for privacy.
- `shared.ts` auto-registers the built-in Gmail server if no custom one is configured.

### AI Agent Pattern
- `runAgent()` in `src/agent/sherpa.ts` is the single entry point for LLM calls.
- System prompts are defined in `src/agent/prompts.ts` — one per use case.
- All LLM calls use Vercel AI SDK's `generateText` with Anthropic models.
- Keep prompts tight and opinionated. This is a terminal tool, not a chatbot.

### Configuration
- User config lives at `~/.config/sherpa/settings.json`.
- API keys are stored in macOS Keychain (`com.sherpa.cli`), never in plaintext.
- Gmail OAuth credentials are stored at `~/.sherpa/gmail/`.
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

## Security-First Dependency Principles

Sherpa handles sensitive data — email, calendar, credentials. Every dependency decision must be security-conscious.

### Build over buy for sensitive integrations
- If a third-party MCP server or package touches credentials, email, calendar, or user data, **prefer building our own implementation** using official SDKs (e.g. `googleapis`, `google-auth-library`).
- Third-party MCP servers are opaque binaries that can exfiltrate tokens silently. We can't audit what we don't own.
- Example: Sherpa's Gmail MCP server (`mcp/gmail/`) uses `googleapis` directly instead of depending on a third-party npm package.

### Challenge every new dependency
Before adding any package, ask:
1. **Does it touch secrets or user data?** If yes, strongly prefer a first-party or self-built alternative.
2. **Does it have a public, auditable source repo?** If not, do not use it.
3. **Is it actively maintained with a clear security posture?** Check for recent CVEs, dependency hygiene, and maintainer reputation.
4. **What's the blast radius if compromised?** Packages with filesystem, network, or credential access are high-risk.
5. **Can we replicate the essential functionality in <200 lines?** If yes, build it.

### Dependency audit cadence
- Review all dependencies before every release.
- Pin major versions in `package.json` — use `^` only for patch-level updates.
- Run `bun audit` (or equivalent) as part of CI.

### Built-in MCP servers
Sherpa maintains its own MCP servers in `mcp/` for sensitive integrations:
- `mcp/gmail/` — Gmail via `googleapis` + OAuth 2.0 (replaces `@gongrzhe/server-gmail-autoauth-mcp`)
- Future: `mcp/calendar/`, `mcp/todoist/` when third-party servers don't meet our security bar.

### Token and credential handling
- All API keys in macOS Keychain (`com.sherpa.cli`), never in plaintext files.
- OAuth tokens stored at `~/.sherpa/{service}/credentials.json` — file permissions should be `600`.
- Path traversal protection on all filesystem access (`src/utils/paths.ts`).
- Never log, print, or transmit credentials — even in debug mode.

## What NOT to Do

- Do not add Express, Fastify, or any HTTP server framework.
- Do not use dotenv — Bun handles `.env` natively.
- Do not store secrets in code or commit `.env` files.
- Do not add React, Vue, or any frontend framework — this is a CLI.
- Do not use `console.log` directly for user output — use `log` from `src/utils/logger.ts` or `@clack/prompts`.
- Do not blindly use third-party MCP servers for sensitive integrations — build our own when feasible.
- Do not add dependencies without answering the 5 security questions above.

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
