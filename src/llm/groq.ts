import Groq from "groq-sdk";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: options?.maxTokens ?? 8192,
          temperature: options?.temperature ?? 0.7,
        });

        const text = response.choices[0]?.message?.content ?? "";
        return {
          text,
          model: "llama-3.3-70b-versatile",
          usage: response.usage
            ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
            : undefined,
        };
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.message?.includes("rate_limit") || err?.message?.includes("Rate limit");
        if (isRateLimit && attempt < maxRetries) {
          const waitMs = 15000 * (attempt + 1);
          console.log(`  [Groq] Rate limit, esperando ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})...`);
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }

    throw new Error("Max retries exceeded for Groq API");
  }
}
