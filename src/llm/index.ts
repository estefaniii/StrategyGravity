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
export interface ProviderStatus {
  available: boolean;
  working: boolean;
  error?: string;
  suggestion?: string;
  dashboardUrl?: string;
}

const PROVIDER_DASHBOARDS: Record<string, string> = {
  claude: "https://console.anthropic.com/settings/billing",
  gemini: "https://aistudio.google.com/apikey",
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/settings/credits",
};

function getSuggestion(name: string, error: string): string {
  const msg = error.toLowerCase();

  if (msg.includes("credit balance is too low") || msg.includes("purchase credits")) {
    return "Tu cuenta no tiene créditos. Agrega un método de pago o compra créditos.";
  }
  if (msg.includes("invalid") && msg.includes("key")) {
    return "Key inválida o revocada. Genera una nueva en el dashboard.";
  }
  if (msg.includes("401")) {
    return "Autenticación fallida. Verifica que tu API key sea correcta.";
  }
  if (msg.includes("402") || msg.includes("insufficient")) {
    return "Sin créditos suficientes. Agrega créditos en tu dashboard.";
  }
  if (msg.includes("403") || msg.includes("permission")) {
    return "Acceso denegado. Verifica los permisos de tu API key.";
  }
  if (msg.includes("429") || msg.includes("rate")) {
    return "Rate limit activo. La key funciona pero hay que espaciar las requests.";
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("enotfound")) {
    return "Error de red. Verifica tu conexión a internet.";
  }
  return "Error inesperado. Revisa tu API key en el dashboard del proveedor.";
}

export async function diagnoseProviders(): Promise<Record<string, ProviderStatus>> {
  if (Object.keys(providers).length === 0) initProviders();

  const results: Record<string, ProviderStatus> = {};

  for (const [name, provider] of Object.entries(providers)) {
    try {
      await provider.generate("Responde solo: OK", "Responde exactamente lo pedido.", { maxTokens: 10 });
      results[name] = { available: true, working: true, dashboardUrl: PROVIDER_DASHBOARDS[name] };
      console.log(`  [Diagnostics] ${name}: OK`);
    } catch (err) {
      const fullMsg = (err as Error).message || "unknown";
      const status = (err as any)?.status;

      // Rate limit = working but limited (not fatal)
      const isRateLimit = status === 429 || fullMsg.toLowerCase().includes("rate limit") || fullMsg.toLowerCase().includes("rate_limit");
      if (isRateLimit) {
        results[name] = {
          available: true,
          working: true,
          suggestion: "Rate limit activo. Funciona pero con limites de velocidad.",
          dashboardUrl: PROVIDER_DASHBOARDS[name],
        };
        console.log(`  [Diagnostics] ${name}: OK (rate limited)`);
      } else {
        const suggestion = getSuggestion(name, fullMsg);
        results[name] = {
          available: true,
          working: false,
          error: fullMsg,
          suggestion,
          dashboardUrl: PROVIDER_DASHBOARDS[name],
        };
        console.log(`  [Diagnostics] ${name}: FALLO - ${fullMsg.slice(0, 80)}`);
        if (suggestion) console.log(`    → ${suggestion}`);
      }

      // Auto-detect OpenRouter token limits
      const tokenMatch = fullMsg.toLowerCase().match(/can only afford (\d+)/);
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
      results[name] = {
        available: false,
        working: false,
        error: "API key no configurada",
        suggestion: `Agrega ${name.toUpperCase()}_API_KEY en tu archivo .env`,
        dashboardUrl: PROVIDER_DASHBOARDS[name],
      };
      console.log(`  [Diagnostics] ${name}: No configurado`);
    }
  }

  return results;
}
