#!/usr/bin/env npx tsx
/**
 * StrategyGravity — Diagnóstico de API Keys
 *
 * Ejecutar:  npx tsx src/tools/diagnose-keys.ts
 *
 * Prueba cada provider LLM con una llamada mínima y muestra:
 *  - Si la key tiene formato correcto
 *  - Si la API responde
 *  - Error completo si falla
 *  - Instrucciones específicas para arreglar
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const envCandidates = [
  resolve(__dirname, "../../.env"),
  resolve(process.cwd(), ".env"),
];
for (const candidate of envCandidates) {
  if (existsSync(candidate)) {
    config({ path: candidate, override: true });
    console.log(`\n  📄 .env cargado: ${candidate}\n`);
    break;
  }
}

// ─── Types ───
interface DiagnosticResult {
  name: string;
  keyPresent: boolean;
  keyFormatOk: boolean;
  working: boolean;
  model: string;
  error?: string;
  suggestion?: string;
  dashboardUrl?: string;
}

// ─── Color helpers (no chalk dependency) ───
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

// ─── Key format validators ───
function validateKeyFormat(name: string, key: string): { ok: boolean; hint: string } {
  if (!key) return { ok: false, hint: "No configurada" };

  const validators: Record<string, { prefix: string; minLen: number }> = {
    anthropic: { prefix: "sk-ant-", minLen: 40 },
    gemini: { prefix: "AIzaSy", minLen: 30 },
    groq: { prefix: "gsk_", minLen: 30 },
    openrouter: { prefix: "sk-or-", minLen: 40 },
  };

  const v = validators[name];
  if (!v) return { ok: true, hint: "" };

  if (!key.startsWith(v.prefix)) {
    return { ok: false, hint: `Debe empezar con "${v.prefix}" (tiene: "${key.slice(0, 8)}...")` };
  }
  if (key.length < v.minLen) {
    return { ok: false, hint: `Muy corta (${key.length} chars, esperado ${v.minLen}+)` };
  }
  return { ok: true, hint: "" };
}

// ─── Test: Anthropic Claude ───
async function testAnthropic(): Promise<DiagnosticResult> {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const format = validateKeyFormat("anthropic", key);
  const model = "claude-sonnet-4-20250514";

  if (!key) {
    return {
      name: "Claude (Anthropic)",
      keyPresent: false,
      keyFormatOk: false,
      working: false,
      model,
      error: "ANTHROPIC_API_KEY no está en .env",
      suggestion: "Obtén tu key en https://console.anthropic.com/settings/keys",
      dashboardUrl: "https://console.anthropic.com/settings/keys",
    };
  }

  if (!format.ok) {
    return {
      name: "Claude (Anthropic)",
      keyPresent: true,
      keyFormatOk: false,
      working: false,
      model,
      error: `Formato incorrecto: ${format.hint}`,
      suggestion: "Verifica tu key en https://console.anthropic.com/settings/keys",
      dashboardUrl: "https://console.anthropic.com/settings/keys",
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: "user", content: "Responde solo: OK" }],
      }),
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;
      return {
        name: "Claude (Anthropic)",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model: (data as { model?: string }).model || model,
      };
    }

    const body = await response.text();
    let suggestion = "";
    let dashboardUrl = "https://console.anthropic.com/settings/keys";

    if (response.status === 401) {
      suggestion = "Key inválida o revocada. Genera una nueva en el dashboard de Anthropic.";
    } else if (response.status === 400) {
      if (body.includes("credit") || body.includes("billing")) {
        suggestion = "Tu cuenta no tiene créditos. Agrega un método de pago en https://console.anthropic.com/settings/billing";
        dashboardUrl = "https://console.anthropic.com/settings/billing";
      } else if (body.includes("cred")) {
        suggestion = "Problema de credenciales. Verifica tu key o regenera una nueva.";
      } else if (body.includes("model")) {
        suggestion = `El modelo "${model}" podría no estar disponible en tu plan. Prueba cambiando a "claude-3-5-sonnet-20241022".`;
      } else {
        suggestion = "Error de request. Revisa que tu cuenta esté activa y tenga créditos.";
        dashboardUrl = "https://console.anthropic.com/settings/billing";
      }
    } else if (response.status === 403) {
      suggestion = "Acceso denegado. Tu cuenta puede estar suspendida o la key no tiene permisos.";
    } else if (response.status === 429) {
      suggestion = "Rate limit — tu key funciona pero estás haciendo muchas requests. Espera un momento.";
      return {
        name: "Claude (Anthropic)",
        keyPresent: true,
        keyFormatOk: true,
        working: true, // technically works, just rate limited
        model,
        suggestion,
        dashboardUrl,
      };
    }

    return {
      name: "Claude (Anthropic)",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `HTTP ${response.status}: ${body}`,
      suggestion,
      dashboardUrl,
    };
  } catch (err) {
    return {
      name: "Claude (Anthropic)",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `Error de red: ${(err as Error).message}`,
      suggestion: "Verifica tu conexión a internet. La API de Anthropic es api.anthropic.com.",
    };
  }
}

// ─── Test: Google Gemini ───
async function testGemini(): Promise<DiagnosticResult> {
  const key = process.env.GEMINI_API_KEY || "";
  const format = validateKeyFormat("gemini", key);
  const model = "gemini-2.0-flash";

  if (!key) {
    return {
      name: "Gemini (Google)",
      keyPresent: false,
      keyFormatOk: false,
      working: false,
      model,
      error: "GEMINI_API_KEY no está en .env",
      suggestion: "Obtén tu key en https://aistudio.google.com/apikey",
      dashboardUrl: "https://aistudio.google.com/apikey",
    };
  }

  if (!format.ok) {
    return {
      name: "Gemini (Google)",
      keyPresent: true,
      keyFormatOk: false,
      working: false,
      model,
      error: `Formato incorrecto: ${format.hint}`,
      suggestion: "Verifica tu key en https://aistudio.google.com/apikey",
      dashboardUrl: "https://aistudio.google.com/apikey",
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responde solo: OK" }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });

    if (response.ok) {
      return {
        name: "Gemini (Google)",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model,
      };
    }

    const body = await response.text();
    let suggestion = "";
    let dashboardUrl = "https://aistudio.google.com/apikey";

    if (response.status === 400) {
      if (body.includes("API_KEY_INVALID") || body.includes("INVALID_ARGUMENT")) {
        suggestion = "Key inválida. Genera una nueva en Google AI Studio.";
      } else if (body.includes("model")) {
        suggestion = `El modelo "${model}" podría no estar disponible. Prueba "gemini-1.5-flash".`;
      } else {
        suggestion = "Error de request. Verifica tu key en Google AI Studio.";
      }
    } else if (response.status === 403) {
      if (body.includes("PERMISSION_DENIED")) {
        suggestion = "La API Generative Language no está habilitada. Habilitala en: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com";
        dashboardUrl = "https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com";
      } else {
        suggestion = "Acceso denegado. La key puede tener restricciones de dominio/IP.";
      }
    } else if (response.status === 429) {
      suggestion = "Rate limit — funciona pero estás haciendo muchas requests.";
      return {
        name: "Gemini (Google)",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model,
        suggestion,
        dashboardUrl,
      };
    }

    return {
      name: "Gemini (Google)",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `HTTP ${response.status}: ${body.slice(0, 500)}`,
      suggestion,
      dashboardUrl,
    };
  } catch (err) {
    const msg = (err as Error).message || "";
    let suggestion = "Verifica tu conexión a internet.";
    if (msg.includes("fetch") || msg.includes("ENOTFOUND")) {
      suggestion = "No se puede conectar a la API de Google. Verifica tu conexión a internet o si hay un firewall/proxy bloqueando generativelanguage.googleapis.com";
    }
    return {
      name: "Gemini (Google)",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `Error de red: ${msg}`,
      suggestion,
      dashboardUrl: "https://aistudio.google.com/apikey",
    };
  }
}

// ─── Test: Groq ───
async function testGroq(): Promise<DiagnosticResult> {
  const key = process.env.GROQ_API_KEY || "";
  const format = validateKeyFormat("groq", key);
  const model = "llama-3.3-70b-versatile";

  if (!key) {
    return {
      name: "Groq",
      keyPresent: false,
      keyFormatOk: false,
      working: false,
      model,
      error: "GROQ_API_KEY no está en .env",
      suggestion: "Obtén tu key gratis en https://console.groq.com/keys",
      dashboardUrl: "https://console.groq.com/keys",
    };
  }

  if (!format.ok) {
    return {
      name: "Groq",
      keyPresent: true,
      keyFormatOk: false,
      working: false,
      model,
      error: `Formato incorrecto: ${format.hint}`,
      suggestion: "Verifica tu key en https://console.groq.com/keys",
      dashboardUrl: "https://console.groq.com/keys",
    };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Responde solo: OK" }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      return {
        name: "Groq",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model,
        suggestion: "Funciona. Free tier tiene ~30 req/min. Para más, upgrade en https://console.groq.com/settings/billing",
        dashboardUrl: "https://console.groq.com/settings/billing",
      };
    }

    const body = await response.text();
    let suggestion = "";
    const dashboardUrl = "https://console.groq.com/keys";

    if (response.status === 401) {
      suggestion = "Key inválida. Genera una nueva en Groq Console.";
    } else if (response.status === 429) {
      return {
        name: "Groq",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model,
        suggestion: "Rate limit activo (free tier). Funciona pero con límites de ~30 req/min.",
        dashboardUrl: "https://console.groq.com/settings/billing",
      };
    } else {
      suggestion = "Error inesperado. Revisa tu key en Groq Console.";
    }

    return {
      name: "Groq",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `HTTP ${response.status}: ${body.slice(0, 500)}`,
      suggestion,
      dashboardUrl,
    };
  } catch (err) {
    return {
      name: "Groq",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `Error de red: ${(err as Error).message}`,
      suggestion: "Verifica tu conexión a internet.",
      dashboardUrl: "https://console.groq.com/keys",
    };
  }
}

// ─── Test: OpenRouter ───
async function testOpenRouter(): Promise<DiagnosticResult> {
  const key = process.env.OPENROUTER_API_KEY || "";
  const format = validateKeyFormat("openrouter", key);
  const model = "anthropic/claude-sonnet-4";

  if (!key) {
    return {
      name: "OpenRouter",
      keyPresent: false,
      keyFormatOk: false,
      working: false,
      model,
      error: "OPENROUTER_API_KEY no está en .env",
      suggestion: "Obtén tu key en https://openrouter.ai/settings/keys",
      dashboardUrl: "https://openrouter.ai/settings/keys",
    };
  }

  if (!format.ok) {
    return {
      name: "OpenRouter",
      keyPresent: true,
      keyFormatOk: false,
      working: false,
      model,
      error: `Formato incorrecto: ${format.hint}`,
      suggestion: "Verifica tu key en https://openrouter.ai/settings/keys",
      dashboardUrl: "https://openrouter.ai/settings/keys",
    };
  }

  // First check credits
  try {
    const creditsRes = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (creditsRes.ok) {
      const creditsData = await creditsRes.json() as { data?: { limit_remaining?: number; usage?: number; limit?: number } };
      const remaining = creditsData.data?.limit_remaining;
      const usage = creditsData.data?.usage;
      const limit = creditsData.data?.limit;
      console.log(c.dim(`    Créditos: uso=$${((usage || 0) / 100).toFixed(4)}, limite=$${((limit || 0) / 100).toFixed(4)}, restante=$${((remaining || 0) / 100).toFixed(4)}`));
    }
  } catch { /* ignore credit check errors */ }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "StrategyGravity-Diagnostics",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Responde solo: OK" }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      return {
        name: "OpenRouter",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model,
        dashboardUrl: "https://openrouter.ai/settings/credits",
      };
    }

    const body = await response.text();
    let suggestion = "";
    let dashboardUrl = "https://openrouter.ai/settings/keys";

    if (response.status === 401) {
      suggestion = "Key inválida o revocada. Genera una nueva en OpenRouter.";
    } else if (response.status === 402) {
      suggestion = "Sin créditos suficientes. Agrega créditos en https://openrouter.ai/settings/credits";
      dashboardUrl = "https://openrouter.ai/settings/credits";

      // Try cheaper model
      const cheapRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Title": "StrategyGravity-Diagnostics",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [{ role: "user", content: "OK" }],
          max_tokens: 3,
        }),
      });
      if (cheapRes.ok) {
        suggestion += "\n    💡 Modelo alternativo (Llama 3.3 70B) SÍ funciona con tus créditos actuales.";
        suggestion += "\n    Puedes cambiar OPENROUTER_MODEL en .env a 'meta-llama/llama-3.3-70b-instruct' (mucho más barato)";
      }
    } else if (response.status === 429) {
      return {
        name: "OpenRouter",
        keyPresent: true,
        keyFormatOk: true,
        working: true,
        model,
        suggestion: "Rate limit — funciona pero hay que esperar.",
        dashboardUrl,
      };
    }

    return {
      name: "OpenRouter",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `HTTP ${response.status}: ${body.slice(0, 500)}`,
      suggestion,
      dashboardUrl,
    };
  } catch (err) {
    return {
      name: "OpenRouter",
      keyPresent: true,
      keyFormatOk: true,
      working: false,
      model,
      error: `Error de red: ${(err as Error).message}`,
      suggestion: "Verifica tu conexión a internet.",
      dashboardUrl: "https://openrouter.ai/settings/keys",
    };
  }
}

// ─── Main ───
async function main() {
  console.log(c.bold("\n  🔑 StrategyGravity — Diagnóstico de API Keys\n"));
  console.log(c.dim("  Probando cada proveedor LLM con una llamada mínima...\n"));

  const tests = [
    { fn: testAnthropic, label: "Claude (Anthropic)" },
    { fn: testGemini, label: "Gemini (Google)" },
    { fn: testGroq, label: "Groq" },
    { fn: testOpenRouter, label: "OpenRouter" },
  ];

  const results: DiagnosticResult[] = [];

  for (const test of tests) {
    console.log(c.cyan(`  ── ${test.label} ──`));
    const result = await test.fn();
    results.push(result);

    // Key status
    if (!result.keyPresent) {
      console.log(`    Key: ${c.red("✗ No configurada")}`);
    } else if (!result.keyFormatOk) {
      console.log(`    Key: ${c.yellow("⚠ Formato incorrecto")}`);
    } else {
      console.log(`    Key: ${c.green("✓ Presente")} ${c.dim(`(${result.model})`)}`);
    }

    // Status
    if (result.working) {
      console.log(`    Estado: ${c.green("✓ FUNCIONA")}`);
    } else {
      console.log(`    Estado: ${c.red("✗ FALLO")}`);
    }

    // Error
    if (result.error) {
      console.log(`    Error: ${c.red(result.error.slice(0, 300))}`);
      if (result.error.length > 300) {
        console.log(c.dim(`    ... (${result.error.length} chars total)`));
      }
    }

    // Suggestion
    if (result.suggestion) {
      console.log(`    ${c.yellow("→")} ${result.suggestion}`);
    }

    // Dashboard
    if (result.dashboardUrl && !result.working) {
      console.log(`    ${c.cyan("🔗")} ${result.dashboardUrl}`);
    }

    console.log();
  }

  // Summary
  const working = results.filter((r) => r.working);
  const failed = results.filter((r) => !r.working);

  console.log(c.bold("  ── Resumen ──"));
  console.log(`    ${c.green(`✓ Funcionando: ${working.map((r) => r.name).join(", ") || "Ninguno"}`)}`);
  if (failed.length > 0) {
    console.log(`    ${c.red(`✗ Fallando: ${failed.map((r) => r.name).join(", ")}`)}`);
  }
  console.log();

  if (working.length === 0) {
    console.log(c.red(c.bold("  ⚠️  NINGÚN PROVIDER FUNCIONA — la generación de estrategias no será posible.")));
    console.log(c.yellow("  Arregla al menos uno de los providers arriba para continuar.\n"));
  } else if (working.length === 1) {
    console.log(c.yellow("  ⚠️  Solo 1 provider activo — la generación será lenta y puede fallar."));
    console.log(c.yellow("  Se recomienda tener al menos 2 providers activos.\n"));
  } else {
    console.log(c.green(`  ✅ ${working.length} providers activos — el sistema funcionará correctamente.\n`));
  }

  return results;
}

// Export for use by server
export { main as runDiagnostics };
export type { DiagnosticResult };

// Run if executed directly
main().catch(console.error);
