import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

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
  }
}
