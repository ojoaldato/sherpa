import { generateText, stepCountIs, type Tool } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { anthropic } from "@ai-sdk/anthropic";
import { loadSettings } from "../config/index.ts";

export interface AgentOptions {
  system: string;
  tools?: Record<string, Tool>;
  maxSteps?: number;
}

export async function runAgent(
  messages: ModelMessage[],
  options: AgentOptions
): Promise<string> {
  const settings = await loadSettings();

  const result = await generateText({
    model: anthropic(settings.llm.model),
    system: options.system,
    messages,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps ?? 5),
    maxOutputTokens: settings.llm.maxTokens,
  });

  return result.text;
}
