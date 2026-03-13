import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class GeminiProvider implements LLMProviderInterface {
  name = "gemini";
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    }
  }

  isAvailable(): boolean {
    return !!env.GEMINI_API_KEY && !!this.client;
  }

  async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!this.client) throw new Error("Gemini API key not configured");

    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = this.client.getGenerativeModel({
          model: "gemini-2.0-flash",
          ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options?.maxTokens ?? 8192,
            temperature: options?.temperature ?? 0.7,
          },
        });

        const text = result.response.text();
        return { text, model: "gemini-2.0-flash" };
      } catch (err: any) {
        const msg = err?.message?.toLowerCase() || "";
        const isRateLimit = err?.status === 429 || msg.includes("429") || msg.includes("rate") || msg.includes("resource") || msg.includes("quota");

        if (isRateLimit && attempt < maxRetries) {
          const waitMs = 15000 * (attempt + 1);
          console.log(`  [Gemini] Rate limit, esperando ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})...`);
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }

    throw new Error("Max retries exceeded for Gemini API");
  }
}
