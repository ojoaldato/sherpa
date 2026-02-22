import type { LanguageModelV3 } from "@ai-sdk/provider";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { getSecret } from "./keychain.ts";

export type ProviderName = "anthropic" | "openai" | "google";

export const PROVIDERS: Record<ProviderName, { envKey: string; defaultModel: string; label: string }> = {
  anthropic: { envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-20250514", label: "Anthropic (Claude)" },
  openai:    { envKey: "OPENAI_API_KEY",    defaultModel: "gpt-4o",                   label: "OpenAI (GPT-4o)" },
  google:    { envKey: "GOOGLE_API_KEY",     defaultModel: "gemini-2.0-flash",         label: "Google (Gemini)" },
};

const providerFactories: Record<ProviderName, (model: string) => LanguageModelV3> = {
  anthropic: (model) => anthropic(model) as unknown as LanguageModelV3,
  openai:    (model) => openai(model) as unknown as LanguageModelV3,
  google:    (model) => google(model) as unknown as LanguageModelV3,
};

export function createModel(provider: ProviderName, model: string): LanguageModelV3 {
  return providerFactories[provider](model);
}

export async function loadProviderApiKey(provider: ProviderName): Promise<void> {
  const { envKey } = PROVIDERS[provider];

  if (process.env[envKey]) return;

  const keychainValue = await getSecret(envKey);
  if (keychainValue) {
    process.env[envKey] = keychainValue;
  }
}
