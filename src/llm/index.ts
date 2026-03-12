import type { LLMProviderInterface, LLMResponse, GenerateOptions } from "./provider.js";
import { ClaudeProvider } from "./claude.js";
import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";
import { OpenRouterProvider } from "./openrouter.js";

export type { LLMProviderInterface, LLMResponse, GenerateOptions };

const providers: Record<string, LLMProviderInterface> = {};

// Known token limits for budget-constrained providers (auto-detected)
const PROVIDER_MAX_TOKENS: Record<string, number> = {};

export function setProviderMaxTokens(providerName: string, maxTokens: number) {
  PROVIDER_MAX_TOKENS[providerName] = maxTokens;
}

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

// ─── Detect fatal (non-retryable) errors that should trigger provider fallback ───
function isFatalProviderError(err: unknown): boolean {
  const msg = (err as any)?.message?.toLowerCase() || "";
  const status = (err as any)?.status;
  // Credit/billing/credential issues (400 + "cred" catches both "credit" and "credentials")
  if (status === 400 && (msg.includes("cred") || msg.includes("billing") || msg.includes("invalid_request"))) return true;
  if (status === 401) return true;   // Invalid API key
  if (status === 402) return true;   // Payment required (OpenRouter insufficient credits)
  if (status === 403) return true;   // Forbidden / suspended
  if (msg.includes("credit balance")) return true;
  if (msg.includes("billing")) return true;
  if (msg.includes("insufficient")) return true;
  if (msg.includes("quota")) return true;
  if (msg.includes("exceeded") && !msg.includes("rate")) return true;
  // Gemini fetch errors indicate fundamental issues
  if (msg.includes("error fetching") || msg.includes("failed to fetch")) return true;
  return false;
}

// ─── Fallback provider: wraps multiple providers, tries next on fatal errors ───
class FallbackProvider implements LLMProviderInterface {
  name: string;
  private chain: LLMProviderInterface[];

  constructor(chain: LLMProviderInterface[]) {
    this.chain = chain;
    this.name = chain.map((p) => p.name).join(" > ");
  }

  isAvailable(): boolean {
    return this.chain.length > 0;
  }

  async generate(prompt: string, systemPrompt?: string, options?: GenerateOptions): Promise<LLMResponse> {
    let lastError: unknown;

    for (const provider of this.chain) {
      try {
        // Adapt maxTokens to provider limits (auto-detected)
        let adaptedOptions = options;
        const providerLimit = PROVIDER_MAX_TOKENS[provider.name];
        if (providerLimit && options?.maxTokens && options.maxTokens > providerLimit) {
          adaptedOptions = { ...options, maxTokens: providerLimit };
          console.log(`  [LLM] ${provider.name}: reduciendo max_tokens de ${options.maxTokens} a ${providerLimit}`);
        }
        return await provider.generate(prompt, systemPrompt, adaptedOptions);
      } catch (err) {
        lastError = err;
        const msg = (err as any)?.message?.toLowerCase() || "";

        // If error is about insufficient tokens, dynamically update limit and retry
        if (msg.includes("afford") && msg.includes("token")) {
          const tokenMatch = msg.match(/can only afford (\d+)/);
          if (tokenMatch) {
            const available = parseInt(tokenMatch[1]);
            const newLimit = Math.max(available - 200, 512);
            // Always update — credits deplete over time
            if (!PROVIDER_MAX_TOKENS[provider.name] || newLimit < PROVIDER_MAX_TOKENS[provider.name]) {
              PROVIDER_MAX_TOKENS[provider.name] = newLimit;
              console.log(`  [LLM] ${provider.name}: limite de tokens actualizado (${available} disponibles → max ${newLimit}), reintentando...`);
              try {
                return await provider.generate(prompt, systemPrompt, {
                  ...options,
                  maxTokens: newLimit,
                });
              } catch (retryErr) {
                lastError = retryErr;
                // Update again if credits depleted further
                const retryMsg = (retryErr as any)?.message?.toLowerCase() || "";
                const retryMatch = retryMsg.match(/can only afford (\d+)/);
                if (retryMatch) {
                  const retryAvailable = parseInt(retryMatch[1]);
                  PROVIDER_MAX_TOKENS[provider.name] = Math.max(retryAvailable - 200, 512);
                }
              }
            }
          }
        }

        // Always try next provider on any error — providers already handle their own retries
        // (e.g. Groq retries rate limits 3 times internally before throwing)
        console.log(`  [LLM] ${provider.name} fallo (${(err as Error).message?.slice(0, 60)}), intentando siguiente proveedor...`);
        continue;
      }
    }

    throw lastError || new Error("Todos los proveedores LLM fallaron");
  }
}

function buildFallbackChain(priorityKeys: string[]): LLMProviderInterface {
  if (Object.keys(providers).length === 0) initProviders();

  const chain: LLMProviderInterface[] = [];
  for (const key of priorityKeys) {
    if (providers[key]) chain.push(providers[key]);
  }

  if (chain.length === 0) {
    throw new Error("No hay proveedores LLM disponibles. Revisa tus API keys en .env");
  }

  // If only one provider, return directly (no wrapper overhead)
  if (chain.length === 1) return chain[0];
  return new FallbackProvider(chain);
}

export function getProvider(name?: string): LLMProviderInterface {
  if (Object.keys(providers).length === 0) initProviders();
  if (name && providers[name]) return providers[name];
  return buildFallbackChain(["claude", "gemini", "groq", "openrouter"]);
}

export function getFastProvider(): LLMProviderInterface {
  return buildFallbackChain(["groq", "gemini", "claude", "openrouter"]);
}

export function getResearchProvider(): LLMProviderInterface {
  return buildFallbackChain(["claude", "gemini", "groq", "openrouter"]);
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

// ─── Provider Diagnostics ───
export async function diagnoseProviders(): Promise<Record<string, { available: boolean; working: boolean; error?: string }>> {
  if (Object.keys(providers).length === 0) initProviders();

  const results: Record<string, { available: boolean; working: boolean; error?: string }> = {};

  for (const [name, provider] of Object.entries(providers)) {
    try {
      await provider.generate("Responde solo: OK", "Responde exactamente lo pedido.", { maxTokens: 10 });
      results[name] = { available: true, working: true };
      console.log(`  [Diagnostics] ${name}: OK`);
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 100) || "unknown";
      results[name] = { available: true, working: false, error: msg };
      console.log(`  [Diagnostics] ${name}: FALLO - ${msg.slice(0, 60)}`);

      // Auto-detect OpenRouter token limits
      const tokenMatch = msg.toLowerCase().match(/can only afford (\d+)/);
      if (tokenMatch) {
        const available = parseInt(tokenMatch[1]);
        PROVIDER_MAX_TOKENS[name] = Math.max(available - 200, 512);
        console.log(`  [Diagnostics] ${name}: limite de tokens = ${PROVIDER_MAX_TOKENS[name]}`);
      }
    }
  }

  // Log unconfigured providers
  for (const name of ["claude", "gemini", "groq", "openrouter"]) {
    if (!providers[name]) {
      results[name] = { available: false, working: false, error: "No API key" };
      console.log(`  [Diagnostics] ${name}: No configurado`);
    }
  }

  return results;
}
