import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

export class ClaudeProvider implements LLMProviderInterface {
  name = "claude";
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  isAvailable(): boolean {
    return !!env.ANTHROPIC_API_KEY;
  }

  async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: options?.maxTokens ?? 8192,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
