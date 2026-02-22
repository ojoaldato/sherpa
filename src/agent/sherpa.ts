import { generateText, stepCountIs, type Tool } from "ai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { loadSettings, createModel, loadProviderApiKey } from "../config/index.ts";

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
  await loadProviderApiKey(settings.llm.provider);

  const result = await generateText({
    model: createModel(settings.llm.provider, settings.llm.model),
    system: options.system,
    messages,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps ?? 5),
    maxOutputTokens: settings.llm.maxTokens,
  });

  return result.text;
}
