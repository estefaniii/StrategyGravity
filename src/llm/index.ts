import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";
import { ClaudeProvider } from "./claude.js";
import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";
import { OpenRouterProvider } from "./openrouter.js";

export type { LLMProviderInterface, LLMResponse, GenerateOptions };

const providers: Record<string, LLMProviderInterface> = {};

function initProviders() {
  const claude = new ClaudeProvider();
  const gemini = new GeminiProvider();
  const groq = new GroqProvider();
  const openrouter = new OpenRouterProvider();

  if (claude.isAvailable()) providers.claude = claude;
  if (gemini.isAvailable()) providers.gemini = gemini;
  if (groq.isAvailable()) providers.groq = groq;
  if (openrouter.isAvailable()) providers.openrouter = openrouter;
}

export function getProvider(name?: string): LLMProviderInterface {
  if (Object.keys(providers).length === 0) initProviders();

  if (name && providers[name]) return providers[name];

  // Priority: claude > gemini > groq > openrouter
  for (const key of ["claude", "gemini", "groq", "openrouter"]) {
    if (providers[key]) return providers[key];
  }

  throw new Error("No LLM provider available. Check your API keys in .env");
}

export function getFastProvider(): LLMProviderInterface {
  if (Object.keys(providers).length === 0) initProviders();
  // Groq is fastest, then gemini, then fallback
  for (const key of ["groq", "gemini", "claude", "openrouter"]) {
    if (providers[key]) return providers[key];
  }
  throw new Error("No LLM provider available");
}

export function getResearchProvider(): LLMProviderInterface {
  if (Object.keys(providers).length === 0) initProviders();
  // Gemini for research, then Claude
  for (const key of ["gemini", "claude", "openrouter"]) {
    if (providers[key]) return providers[key];
  }
  throw new Error("No research LLM provider available");
}

export function listAvailableProviders(): string[] {
  if (Object.keys(providers).length === 0) initProviders();
  return Object.keys(providers);
}

export async function generate(
  prompt: string,
  systemPrompt?: string,
  options?: GenerateOptions & { provider?: string }
): Promise<LLMResponse> {
  const provider = getProvider(options?.provider);
  return provider.generate(prompt, systemPrompt, options);
}
