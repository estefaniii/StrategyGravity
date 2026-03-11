import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
    const maxRetries = 5;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
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
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.message?.includes("rate_limit");

        if (isRateLimit && attempt < maxRetries) {
          // Extract retry-after header or use exponential backoff
          const retryAfter = err?.headers?.["retry-after"];
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(15000 * (attempt + 1), 90000);
          console.log(`  [Claude] Rate limit hit, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(waitMs);
          continue;
        }

        throw err;
      }
    }

    throw new Error("Max retries exceeded for Claude API");
  }
}
