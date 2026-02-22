# Sherpa — Roadmap

> The Command-Line Guide for the Sociotechnical Leader

A high-performance, local-first CLI that acts as an Agentic Guide for Engineering Managers. Sherpa consolidates fragmented data streams (Gmail, Google Calendar, Jira, Obsidian, Confluence, Slack, Todoist) into a single terminal experience, enabling a 100x Force Multiplier through radical automation and superior systems thinking.

---

## Tech Stack

| Layer            | Choice                                     |
| ---------------- | ------------------------------------------ |
| Runtime          | Bun                                        |
| Language         | TypeScript (strict)                        |
| CLI Framework    | bunli (`@bunli/core`)                      |
| AI Orchestration | Vercel AI SDK (`ai` + `@ai-sdk/anthropic` / `openai` / `google`) |
| MCP              | Model Context Protocol client/server mesh  |
| CLI UX           | `@clack/prompts` for interactive flows     |
| Auth             | OAuth 2.1 + PKCE, macOS Keychain, `.env`   |
| Build            | Bun single-file compile (`bun build`)      |

## MCP Integration Map

| Integration      | Transport    | Mechanism                                            | Status     |
| ---------------- | ------------ | ---------------------------------------------------- | ---------- |
| Gmail            | `stdio`      | Built-in `mcp/gmail/` via `googleapis` (own server)  | ✓ Built    |
| Google Calendar  | `stdio`/`sse`| Google Workspace MCP or local implementations        | ✓ Built    |
| Todoist          | `stdio`      | MCP server via setup wizard                          | ✓ Built    |
| Obsidian / Local | filesystem   | Direct `Bun.file()` + `Bun.Glob` — no MCP needed    | ✓ Built    |
| Jira / Confluence| `http`/`sse` | Atlassian Rovo Remote MCP for cloud services         | Phase 2    |
| Slack            | `sse`        | Hosted MCP servers with OAuth 2.0 integration        | Phase 2    |
| WhatsApp         | TBD          | Business API, Baileys, or hosted bridge              | Phase 1.7  |

---

## Phase 1 — Cognitive De-cluttering (Personal Basecamp)

Goal: Transform passive data repos (inbox, calendar, notes) into an active, managed stream of work.

### 1.1 Project Scaffold — DONE

- [x] Bun + TypeScript strict config
- [x] Project structure: `src/{commands,agent,mcp,integrations,config,utils}`
- [x] Core deps: `ai`, `@ai-sdk/anthropic`, `@bunli/core`, `@clack/prompts`, `@modelcontextprotocol/sdk`, `zod`, `chalk`
- [x] Entry point: `src/cli.ts` — no-arg defaults to REPL, subcommands via bunli
- [x] `bunli.config.ts` for build/dev

### 1.2 Config & Auth Wizard — DONE

- [x] Interactive setup wizard (`sherpa setup`) using `@clack/prompts`
- [x] `.env` management — Bun auto-loads, no dotenv
- [x] `~/.config/sherpa/settings.json` for MCP server configs, preferences
- [x] Zod-validated env and settings schemas
- [x] macOS Keychain integration for sensitive credentials
- [x] OAuth 2.0 flow for Gmail via built-in MCP server
- [ ] OAuth 2.1 + PKCE flow for Calendar, Todoist, Atlassian, Slack

### 1.3 MCP Client Mesh — DONE

- [x] Generic `McpClientManager` that spawns/connects to multiple servers
- [x] stdio transport via `@modelcontextprotocol/sdk`
- [x] Per-command connection bootstrapping (`connectConfiguredServers()`)
- [ ] SSE and HTTP transport adapters
- [ ] Dynamic tool discovery from connected servers

### 1.4 Obsidian / Local Docs Integration — DONE

- [x] `searchLocalDocs(query, dirs)` — deep search over local vault
- [x] `readDocument(path)` — read any markdown file
- [x] `listPlans(planDirs)` — list plans/goals from configured directories
- [x] Direct filesystem access via `Bun.file()` + `Bun.Glob` for privacy
- [ ] 1-on-1 contextual retrieval: link meeting notes to people
- [ ] Surface historical follow-ups, career growth notes, promises

### 1.5 Gmail Semantic Triage — DONE

- [x] Gmail MCP integration via built-in `mcp/gmail/` server (replaced third-party `@gongrzhe/server-gmail-autoauth-mcp`)
- [x] `sherpa triage` — guided inbox triage with AI analysis
- [x] 4 actions per email: ignore (archive), filter forever, create Todoist task, draft reply
- [x] Interactive per-email walkthrough or bulk archive mode
- [x] AI-powered reply drafting with edit-before-save flow
- [x] Gmail filter creation (by sender or entire domain)
- [x] Session tracking + boxed summary at end of triage
- [ ] Tone matching for auto-drafted replies (learn user's writing style)

### 1.6 Anticipatory Scheduling — SCAFFOLDED

- [x] Google Calendar MCP: list events, get today's events, create events
- [x] Todoist MCP: list active tasks, filter search, create tasks, complete tasks
- [ ] `sherpa day` — morning prep: today's calendar + tasks + inbox triage + plan
- [ ] `sherpa week` — weekly reset: full week overview + goals check-in + battle plan
- [ ] Auto-create meeting prep tasks for upcoming calendar events
- [ ] Detect fragmented time gaps → suggest quick low-effort tasks
- [ ] Deep work block suggestions based on calendar density

### 1.7 WhatsApp Notifications — PLANNED

- [ ] WhatsApp integration via Business API or bridge (Baileys, whatsapp-web.js, or hosted API)
- [ ] `sherpa digest` — send daily/weekly digest summary to self or team via WhatsApp
- [ ] Follow-up nudges: after triage or planning, send actionable reminders
- [ ] Configurable recipients: self, direct reports, stakeholders
- [ ] Mobile-friendly message formatting
- [x] `--notify` flag infrastructure on triage command
- [x] Pluggable notification system (`src/utils/notify.ts`) with terminal + WhatsApp stubs
- [ ] Evaluate MCP server options vs. direct API integration for transport

### 1.8 Conversational REPL — DONE

- [x] `sherpa` (no subcommand) or `sherpa chat` enters interactive mode
- [x] `streamText` from Vercel AI SDK with all tools available
- [x] 14 AI SDK tools wrapping all integrations (gmail, calendar, todoist, local docs)
- [x] Confirmation prompts baked into destructive tool `execute` functions
- [x] Stateful conversation history within session (`clear` to reset, `exit` to quit)
- [x] Opinionated system prompt: proactive, concise, batches tool calls
- [ ] Streaming tool call status indicators (show which tools are being called)
- [ ] Session persistence across invocations (save/load conversation)
- [ ] `/slash` commands in REPL (e.g. `/triage`, `/day`, `/week` as shortcuts)

---

## Phase 2 — Operational Alignment (Charting the Route)

Goal: Provide a God's-eye view of team execution and system health.

### 2.1 Jira / Confluence Integration

- [ ] Atlassian Rovo MCP connection (remote, cloud)
- [ ] JQL query execution from CLI
- [ ] Sprint audit: cross-reference Jira sprint issues against Confluence roadmaps
- [ ] Detect strategic drift between planned roadmap and actual execution

### 2.2 Slack Trend Spotting

- [ ] Slack MCP connection (SSE, OAuth)
- [ ] Scan key channels for emerging signals: tech debt, recurring bugs, team friction
- [ ] Basic sentiment analysis on channel activity
- [ ] Surface early-warning indicators to the EM

### 2.3 Proactive Reliability — "Reparo"

- [ ] Correlate Slack sentiment + Jira bug rates to anticipate escalations
- [ ] Suggest CDO (Cognitive Defense Operation) tickets in Jira
- [ ] Auto-draft ticket descriptions with root-cause hypotheses

---

## Phase 3 — End-to-End SDLC Orchestration (Summit Management)

Goal: Full-spectrum SDLC automation from conception to production monitoring.

### 3.1 Autonomous Triage & Assignment

- [ ] Incoming bug triage via multi-step tool loop reasoning
- [ ] Cross-reference with Obsidian vault for similar historical issues
- [ ] Identify best-suited engineer based on calendar availability + workload
- [ ] Auto-assign and notify via Slack

### 3.2 CI/CD & Production Alerting

- [ ] Monitor deployment health via cloud provider MCPs
- [ ] Auto-retrieve error logs on regression detection
- [ ] Search Confluence for potential fixes
- [ ] Alert on-call engineer with synthesized context package

### 3.3 Synthesized Leadership Briefing

- [ ] Aggregate signals across all integrations into a narrative summary
- [ ] Actionable recommendations with one-command execution
- [ ] Example: "Two critical bugs in payment service; roadmap says highest priority; sprint tasks reassigned; triage meeting scheduled at 2 PM"

---

## Architecture Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| CLI-first vs. CLI+backend | CLI-first | All Phase 1 commands are pull-based. Daemon deferred to Phase 2 when reactive features (Slack watch, alerts) need it. |
| MCP vs. direct API | MCP where possible | Standardized tool interface, swappable servers, aligns with ecosystem. Local docs are the exception (direct fs for privacy). |
| Build vs. buy for MCP servers | Build for sensitive integrations | Third-party MCP servers for email/calendar are opaque and can exfiltrate tokens. We own `mcp/gmail/` using `googleapis` directly. |
| Roadmap location | `ROADMAP.md` + GitHub Issues | `ROADMAP.md` for narrative vision, Issues for trackable tasks. |
| LLM provider | Configurable via AI SDK | Supports Anthropic, OpenAI, Google. User chooses in `sherpa setup`. |

---

## Security Principles

- **Local-first**: all credentials in macOS Keychain + local OAuth tokens, never in VCS
- **Build over buy**: own MCP servers for sensitive integrations (email, calendar) — third-party servers are opaque attack surface
- **Challenge every dependency**: 5-question audit before adding any package (see `CLAUDE.md`)
- **Minimal trust**: prefer local MCP servers for sensitive data (Obsidian, local files)
- **OAuth 2.0**: for all cloud service auth (Google, Atlassian, Slack)
- **Token exchange on-device only**: no intermediary servers
- **Path traversal protection**: filesystem access restricted to configured roots
- **Audit trail**: log all agent actions locally for transparency

---

## Distribution

- Single precompiled binary via `bun build --compile`
- Install: `curl -fsSL https://sherpa.ai/install.sh | bash`
- First-run wizard handles all config and OAuth flows
- Zero external runtime dependencies

---

## Open Questions

- [ ] Local LLM fallback for offline/air-gapped use?
- [ ] Plugin system for community MCP server contributions?
- [ ] Telemetry opt-in for usage analytics?
- [ ] License choice (MIT, Apache 2.0, etc.)?
