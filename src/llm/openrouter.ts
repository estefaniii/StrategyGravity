import { env } from "../config/env.js";
import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Ordered by cost: free tier first, then paid models as fallback.
// Free models change frequently — check https://openrouter.ai/models/?q=free
const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free", // Free 120B MoE, only 12B active per token
  "stepfun/step-3.5-flash:free",            // Free 196B MoE, 11B active per token
  "nvidia/nemotron-3-nano-30b-a3b:free",    // Free 30B nano model
  "google/gemini-2.0-flash-001",            // Very cheap (~$0.10/M tokens)
  "meta-llama/llama-3.3-70b-instruct",      // Cheap
];

export class OpenRouterProvider implements LLMProviderInterface {
  name = "openrouter";
  private preferredModelIndex = 0;

  isAvailable(): boolean {
    return !!env.OPENROUTER_API_KEY;
  }

  async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
    if (!env.OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    // Try models starting from the preferred (cheapest working) model
    for (let i = this.preferredModelIndex; i < OPENROUTER_MODELS.length; i++) {
      const model = OPENROUTER_MODELS[i];
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "X-Title": "StrategyGravity",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: options?.maxTokens ?? 8192,
            temperature: options?.temperature ?? 0.7,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          const msg = body.toLowerCase();

          // If it's a credit/model issue, try next cheaper model
          if (response.status === 402 || msg.includes("insufficient") || msg.includes("afford")) {
            console.log(`  [OpenRouter] ${model}: sin creditos suficientes, probando siguiente modelo...`);
            continue;
          }

          // Rate limit: wait 5s and retry once, then try next model
          if (response.status === 429) {
            console.log(`  [OpenRouter] ${model}: rate limit, esperando 5s...`);
            await sleep(5000);
            try {
              const retryResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json",
                  "X-Title": "StrategyGravity",
                },
                body: JSON.stringify({ model, messages, max_tokens: options?.maxTokens ?? 8192, temperature: options?.temperature ?? 0.7 }),
              });
              if (retryResponse.ok) {
                const retryData = (await retryResponse.json()) as {
                  choices: Array<{ message: { content: string } }>;
                  model: string;
                  usage?: { prompt_tokens: number; completion_tokens: number };
                };
                return {
                  text: retryData.choices[0]?.message?.content ?? "",
                  model: retryData.model || model,
                  usage: retryData.usage ? { inputTokens: retryData.usage.prompt_tokens, outputTokens: retryData.usage.completion_tokens } : undefined,
                };
              }
            } catch { /* retry failed, fall through to next model */ }
            console.log(`  [OpenRouter] ${model}: rate limit persistente, probando siguiente modelo...`);
            continue;
          }

          const err = new Error(`OpenRouter API error: ${response.status} ${body.slice(0, 200)}`);
          (err as any).status = response.status;
          throw err;
        }

        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
          model: string;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        // Remember this model works for future calls
        if (i !== this.preferredModelIndex) {
          this.preferredModelIndex = i;
          console.log(`  [OpenRouter] Modelo preferido actualizado: ${model}`);
        }

        return {
          text: data.choices[0]?.message?.content ?? "",
          model: data.model || model,
          usage: data.usage
            ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
            : undefined,
        };
      } catch (err: any) {
        // If it's specifically a credit issue with this model, try next
        const msg = err?.message?.toLowerCase() || "";
        if ((err?.status === 402 || msg.includes("insufficient") || msg.includes("afford")) && i < OPENROUTER_MODELS.length - 1) {
          console.log(`  [OpenRouter] ${model}: creditos insuficientes, probando siguiente...`);
          continue;
        }
        throw err;
      }
    }

    throw new Error("OpenRouter: todos los modelos fallaron (sin creditos)");
  }
}
