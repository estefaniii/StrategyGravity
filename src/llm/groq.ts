import Groq from "groq-sdk";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Only 8B model — 70B has 6,000 TPM on free tier and ALWAYS rate-limits, wasting 6+ seconds per attempt
const GROQ_MODELS = [
  "llama-3.1-8b-instant",      // 131,072 TPM — only reliable model on free tier
];

export class GroqProvider implements LLMProviderInterface {
  name = "groq";
  private client: Groq | null = null;

  constructor() {
    if (env.GROQ_API_KEY) {
      this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    }
  }

  isAvailable(): boolean {
    return !!env.GROQ_API_KEY && !!this.client;
  }

  async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.client) throw new Error("Groq API key not configured");

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    let lastError: any;

    for (const model of GROQ_MODELS) {
      const maxRetries = 0; // No retries — rate limits don't clear in 3s; cascade to next provider immediately
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.client.chat.completions.create({
            model,
            messages,
            max_tokens: options?.maxTokens ?? 8192,
            temperature: options?.temperature ?? 0.7,
          });

          const text = response.choices[0]?.message?.content ?? "";
          return {
            text,
            model,
            usage: response.usage
              ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
              : undefined,
          };
        } catch (err: any) {
          lastError = err;
          const isRateLimit = err?.status === 429 || err?.message?.includes("rate_limit") || err?.message?.includes("Rate limit");
          if (isRateLimit && attempt < maxRetries) {
            const waitMs = 3000 * (attempt + 1);
            console.log(`  [Groq] Rate limit (${model}), esperando ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})...`);
            await sleep(waitMs);
            continue;
          }
          // On rate limit after max retries, break to try next model
          if (isRateLimit) {
            console.log(`  [Groq] ${model} agotado por rate limit, probando modelo alternativo...`);
            break;
          }
          throw err; // Non-rate-limit errors throw immediately
        }
      }
    }

    throw lastError || new Error("Max retries exceeded for Groq API");
  }
}
