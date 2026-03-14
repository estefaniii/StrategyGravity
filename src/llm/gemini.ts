import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Models ordered by preference: newest first, fallback to older with different rate limit buckets
const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

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

    let lastError: any;

    for (const modelName of GEMINI_MODELS) {
      const maxRetries = 1;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const model = this.client.getGenerativeModel({
            model: modelName,
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
          return { text, model: modelName };
        } catch (err: any) {
          lastError = err;
          const msg = err?.message?.toLowerCase() || "";
          const isRateLimit = err?.status === 429 || msg.includes("429") || msg.includes("rate") || msg.includes("resource") || msg.includes("quota");

          if (isRateLimit && attempt < maxRetries) {
            const waitMs = 3000 * (attempt + 1);
            console.log(`  [Gemini] Rate limit (${modelName}), esperando ${Math.round(waitMs / 1000)}s (intento ${attempt + 1}/${maxRetries})...`);
            await sleep(waitMs);
            continue;
          }
          // On rate limit after max retries, try next model
          if (isRateLimit) {
            console.log(`  [Gemini] ${modelName} agotado por rate limit, probando modelo alternativo...`);
            break;
          }
          throw err;
        }
      }
    }

    throw lastError || new Error("Max retries exceeded for Gemini API");
  }
}
