import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

export class OpenRouterProvider implements LLMProviderInterface {
  name = "openrouter";

  isAvailable(): boolean {
    return !!env.OPENROUTER_API_KEY;
  }

  async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "StrategyGravity",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        messages,
        max_tokens: options?.maxTokens ?? 8192,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const err = new Error(`OpenRouter API error: ${response.status} ${body.slice(0, 200)}`);
      (err as any).status = response.status;
      throw err;
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? "",
      model: data.model,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
    };
  }
}
