import { streamText, stepCountIs } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import chalk from "chalk";
import { loadSettings, createModel, loadProviderApiKey } from "../config/index.ts";
import { createSherpaTools } from "./tools.ts";
import { log } from "../utils/index.ts";
import * as readline from "node:readline";

const REPL_SYSTEM = `You are Sherpa, a command-line guide for Engineering Managers. You run as an interactive CLI — the user types natural language and you take action.

You have tools to access:
- **Gmail**: search, read, archive, create filters, draft replies
- **Google Calendar**: view today/upcoming events, create events
- **Todoist**: view/create/complete tasks
- **Local docs**: search Obsidian vault, read markdown files, list plans/goals

## How to behave

1. **Be proactive.** Don't just answer — suggest next steps. If the user says "what's my day look like", pull calendar + tasks + inbox count and synthesize.
2. **Be concise.** This is a terminal. Use bullet points, short sentences, no fluff. Format for 80-column width.
3. **Be opinionated.** You're a guide, not a search engine. Recommend actions: "You should archive these 8", "Block 2-4pm for deep work", "This follow-up is overdue."
4. **Batch tool calls.** When you need multiple data sources (calendar + tasks + inbox), call all tools at once, then synthesize.
5. **Confirm destructive actions.** Archiving, filtering, creating events/tasks — the tools will ask the user for confirmation. Don't ask again yourself.
6. **Track context.** The conversation is stateful. Remember what was discussed, what was archived, what tasks were created.
7. **Use structure.** Headers, bullet points, numbered lists. Make output scannable.

## Common workflows

- "what's my day" → calendar_today + todoist_active + gmail_search(in:inbox is:unread) → synthesized briefing
- "triage inbox" → gmail_search → analyze → propose actions per email → execute with confirmation
- "plan my week" → calendar_upcoming(7) + todoist_search(due before: +7 days) + docs_list_plans → weekly battle plan
- "find notes about X" → docs_search → show results
- "block deep work" → find gaps in calendar → calendar_create_event

## Formatting

- Use plain text, no markdown rendering (this is a terminal)
- Use unicode symbols sparingly: ✓ ✗ ☐ → ⚠ 📅 ✉
- Numbers for ordered lists, dashes for unordered
- Keep responses under 40 lines when possible`;

export async function startRepl(): Promise<void> {
  const settings = await loadSettings();
  await loadProviderApiKey(settings.llm.provider);
  const tools = createSherpaTools();
  const history: ModelMessage[] = [];

  const purple = chalk.hex("#7C5CFC");
  const dim = chalk.dim;
  const white = chalk.white;

  log.raw("");
  log.raw(purple("              /\\"));
  log.raw(purple("             /  \\"));
  log.raw(purple("            / ") + white("⛰") + purple("  \\"));
  log.raw(purple("           /      \\"));
  log.raw(purple("          / ") + dim("~~~~~~") + purple(" \\"));
  log.raw(purple("         /  ") + dim("~~~~~~") + purple("  \\"));
  log.raw(purple("        /          \\"));
  log.raw(purple("       /    ") + white("____") + purple("    \\"));
  log.raw(purple("      /    ") + white("|    |") + purple("    \\"));
  log.raw(purple("     /     ") + white("|    |") + purple("     \\"));
  log.raw(purple("    /______") + white("|____|") + purple("______\\"));
  log.raw("");
  log.raw(purple.bold("         S H E R P A"));
  log.raw(dim("   The Command-Line Guide for"));
  log.raw(dim("   the Sociotechnical Leader"));
  log.raw("");
  log.raw(dim("   Type anything to get started."));
  log.raw(dim("   'exit' to quit · 'clear' to reset"));
  log.raw("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex("#7C5CFC")("you> "),
  });

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(chalk.hex("#7C5CFC")("you> "), (answer) => {
        resolve(answer.trim());
      });
    });
  };

  while (true) {
    const input = await askQuestion();

    if (!input) continue;
    if (input === "exit" || input === "quit" || input === "q") {
      log.raw("");
      log.raw(chalk.dim("  Until next time. Go get it."));
      log.raw("");
      break;
    }

    if (input === "clear") {
      history.length = 0;
      log.raw(chalk.dim("  Context cleared."));
      continue;
    }

    history.push({ role: "user", content: input });

    process.stdout.write(chalk.dim("\n  "));

    try {
      const result = streamText({
        model: createModel(settings.llm.provider, settings.llm.model),
        system: REPL_SYSTEM,
        messages: history,
        tools,
        stopWhen: stepCountIs(10),
        maxOutputTokens: settings.llm.maxTokens,
      });

      let fullText = "";

      for await (const chunk of result.textStream) {
        const formatted = chunk.replace(/\n/g, "\n  ");
        process.stdout.write(formatted);
        fullText += chunk;
      }

      process.stdout.write("\n\n");

      if (fullText) {
        history.push({ role: "assistant", content: fullText });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("API key") || msg.includes("ANTHROPIC")) {
        log.error("Anthropic API key not set. Run `sherpa setup` or set ANTHROPIC_API_KEY.");
      } else if (msg.includes("not connected") || msg.includes("MCP")) {
        log.warn("Some integrations are unavailable. Run `sherpa setup` to configure.");
        log.dim(`  Error: ${msg}`);
      } else {
        log.error(`Agent error: ${msg}`);
      }
    }
  }

  rl.close();
}
