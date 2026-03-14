import express from "express";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, createReadStream } from "fs";
import { initDatabase } from "../core/memory.js";
import { extractBrandFromUrl, extractBrandFromInstagram, extractBrandFromDescription, setAutoConfirm } from "../tools/brand-extractor.js";

// Web mode: no terminal available, auto-confirm brand data
setAutoConfirm(true);
import { generateStrategy } from "../strategy/generator.js";
import { generatePptx } from "../tools/pptx-generator.js";
import { getLatestStrategy, getStrategy, listStrategies, deleteStrategy } from "../core/memory.js";
import type { BrandIdentity, MarketingStrategy } from "../types/index.js";
import { env } from "../config/env.js";
import chalk from "chalk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(env.PORT || "3000");

app.use(express.json());
app.use(express.static(resolve(__dirname, "public")));

// Store active SSE connections
const sseClients: Map<string, express.Response> = new Map();
let currentStrategy: MarketingStrategy | null = null;

// ─── SSE endpoint for real-time progress ───
app.get("/api/progress/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("data: {\"type\":\"connected\"}\n\n");
  sseClients.set(sessionId, res);

  // Keep-alive: send SSE comment every 15s to prevent mobile browsers from closing connection
  const keepAlive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { clearInterval(keepAlive); }
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(sessionId);
  });
});

function sendProgress(sessionId: string, step: number, total: number, message: string) {
  const client = sseClients.get(sessionId);
  if (client) {
    client.write(`data: ${JSON.stringify({ type: "progress", step, total, message })}\n\n`);
  }
}

function sendComplete(sessionId: string, data: unknown) {
  const client = sseClients.get(sessionId);
  if (client) {
    client.write(`data: ${JSON.stringify({ type: "complete", data })}\n\n`);
  }
}

function sendError(sessionId: string, error: string) {
  const client = sseClients.get(sessionId);
  if (client) {
    try {
      client.write(`data: ${JSON.stringify({ type: "error", error })}\n\n`);
    } catch (e) {
      console.log(`  [SSE] Could not send error to ${sessionId}: ${(e as Error).message}`);
    }
  }
}

// Timeout wrapper for generation endpoints (10 minutes max)
const GENERATION_TIMEOUT = 10 * 60 * 1000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout: la generacion excedio el tiempo maximo. Por favor intenta nuevamente."));
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// Background PPTX generation (non-blocking, runs after sendComplete)
function generatePptxInBackground(strategy: MarketingStrategy): void {
  generatePptx(strategy)
    .then(r => r.success && console.log(`  PPTX generado en background para ID: ${strategy.id}`))
    .catch(err => console.log(`  PPTX no generado: ${(err as Error).message?.slice(0, 80)}`));
}

// ─── Apply user preferences to brand identity ───
function applyPreferences(brand: BrandIdentity, preferences: any): void {
  if (!preferences) return;

  if (preferences.country) brand.location = preferences.country;
  if (preferences.industry) brand.industry = preferences.industry;

  if (preferences.description) {
    if (!brand.description || brand.description.length < 30) {
      brand.description = preferences.description;
    } else {
      brand.description = preferences.description + ". " + brand.description;
    }
  }

  if (preferences.colors?.primary && preferences.colors.primary !== "#000000") {
    brand.colors = {
      primary: preferences.colors.primary,
      secondary: preferences.colors.secondary || brand.colors.secondary,
      accent: preferences.colors.accent || brand.colors.accent,
    };
  }
  if (preferences.headingFont) brand.fonts.heading = preferences.headingFont;
  if (preferences.bodyFont) brand.fonts.body = preferences.bodyFont;
}

// ─── Generate Strategy from URL ───
app.post("/api/strategy/url", async (req, res) => {
  const { url, sessionId, preferences } = req.body;
  if (!url) return res.status(400).json({ error: "URL requerida" });

  try {
    sendProgress(sessionId, 0, 12, "Analizando sitio web...");
    const brandResult = await extractBrandFromUrl(url);
    if (!brandResult.success) {
      sendError(sessionId, brandResult.error || "Error al analizar URL");
      return res.status(400).json({ error: brandResult.error });
    }

    const brand = brandResult.data as BrandIdentity;
    applyPreferences(brand, preferences);

    sendProgress(sessionId, 0, 12, `Marca detectada: ${brand.companyName}. Iniciando estrategia...`);

    res.json({ status: "generating", companyName: brand.companyName });

    // Generate strategy asynchronously with timeout
    const strategy = await withTimeout(
      generateStrategy(brand, (step, total, msg) => {
        sendProgress(sessionId, step, total, msg);
      }),
      GENERATION_TIMEOUT
    );
    currentStrategy = strategy;
    sendComplete(sessionId, { id: strategy.id, companyName: strategy.companyName });
    generatePptxInBackground(strategy);
  } catch (err) {
    sendError(sessionId, (err as Error).message);
  }
});

// ─── Generate Strategy from Instagram ───
app.post("/api/strategy/instagram", async (req, res) => {
  const { handle, sessionId, preferences } = req.body;
  if (!handle) return res.status(400).json({ error: "Handle requerido" });

  try {
    sendProgress(sessionId, 0, 12, "Analizando perfil de Instagram...");
    const brandResult = await extractBrandFromInstagram(handle);
    if (!brandResult.success) {
      sendError(sessionId, brandResult.error || "Error al analizar Instagram");
      return res.status(400).json({ error: brandResult.error });
    }

    const brand = brandResult.data as BrandIdentity;
    applyPreferences(brand, preferences);

    res.json({ status: "generating", companyName: brand.companyName });

    const strategy = await withTimeout(
      generateStrategy(brand, (step, total, msg) => {
        sendProgress(sessionId, step, total, msg);
      }),
      GENERATION_TIMEOUT
    );
    currentStrategy = strategy;
    sendComplete(sessionId, { id: strategy.id, companyName: strategy.companyName });
    generatePptxInBackground(strategy);
  } catch (err) {
    sendError(sessionId, (err as Error).message);
  }
});

// ─── Generate Strategy from Description ───
app.post("/api/strategy/description", async (req, res) => {
  const { description, sessionId, preferences } = req.body;
  if (!description) return res.status(400).json({ error: "Descripcion requerida" });

  try {
    sendProgress(sessionId, 0, 12, "Analizando descripcion...");
    const brandResult = await extractBrandFromDescription(description);
    if (!brandResult.success) {
      sendError(sessionId, brandResult.error || "Error al analizar descripcion");
      return res.status(400).json({ error: brandResult.error });
    }

    const brand = brandResult.data as BrandIdentity;
    applyPreferences(brand, preferences);

    res.json({ status: "generating", companyName: brand.companyName });

    const strategy = await withTimeout(
      generateStrategy(brand, (step, total, msg) => {
        sendProgress(sessionId, step, total, msg);
      }),
      GENERATION_TIMEOUT
    );
    currentStrategy = strategy;
    sendComplete(sessionId, { id: strategy.id, companyName: strategy.companyName });
    generatePptxInBackground(strategy);
  } catch (err) {
    sendError(sessionId, (err as Error).message);
  }
});

// ─── Get strategy data ───
app.get("/api/strategy/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const strategy = getStrategy(id);
  if (!strategy) return res.status(404).json({ error: "Estrategia no encontrada" });
  currentStrategy = strategy;
  res.json(strategy);
});

app.get("/api/strategy", (_req, res) => {
  if (currentStrategy) return res.json(currentStrategy);
  const latest = getLatestStrategy();
  if (latest) {
    currentStrategy = latest;
    return res.json(latest);
  }
  res.status(404).json({ error: "No hay estrategia cargada" });
});

// ─── List strategies ───
app.get("/api/strategies", (_req, res) => {
  const strategies = listStrategies();
  res.json(strategies);
});

// ─── Delete strategy ───
app.delete("/api/strategy/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const success = deleteStrategy(id);
  if (!success) return res.status(404).json({ error: "Estrategia no encontrada" });
  // Clear cached strategy if it was the deleted one
  if (currentStrategy?.id === id) currentStrategy = null;
  res.json({ success: true });
});

// ─── Generate PPTX ───
app.post("/api/pptx/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const strategy = getStrategy(id);
  if (!strategy) return res.status(404).json({ error: "Estrategia no encontrada" });

  try {
    const result = await generatePptx(strategy);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      res.json({ success: true, filePath: data.filePath, slideCount: data.slideCount });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Download PPTX ───
app.get("/api/pptx/download/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const strategy = getStrategy(id);
  if (!strategy) return res.status(404).json({ error: "Estrategia no encontrada" });

  try {
    const result = await generatePptx(strategy);
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      const filePath = data.filePath as string;
      const filename = (data.filename as string) || `${strategy.companyName.replace(/\s+/g, "_")}_Estrategia.pptx`;

      if (!existsSync(filePath)) {
        return res.status(404).json({ error: "Archivo PPTX no encontrado despues de generacion" });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      createReadStream(filePath).pipe(res);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Provider diagnostics (singleton pattern to avoid double rate-limit hits) ───
let cachedDiagnostics: Record<string, unknown> | null = null;
let diagnosticsTimestamp = 0;
let activeDiagnosticsPromise: Promise<Record<string, unknown>> | null = null;
const DIAGNOSTICS_CACHE_TTL = 120_000; // 2 minutes cache

async function runDiagnostics(): Promise<Record<string, unknown>> {
  const { diagnoseProviders } = await import("../llm/index.js");
  const results = await diagnoseProviders();
  const working = Object.entries(results).filter(([_, r]) => r.working).map(([n]) => n);
  const failing = Object.entries(results).filter(([_, r]) => !r.working).map(([n]) => n);
  const response = {
    providers: results,
    summary: { working, failing, totalWorking: working.length, totalFailing: failing.length },
  };
  cachedDiagnostics = response;
  diagnosticsTimestamp = Date.now();
  return response;
}

async function getDiagnostics(forceRefresh = false): Promise<Record<string, unknown>> {
  const now = Date.now();

  // Return cached if fresh
  if (!forceRefresh && cachedDiagnostics && (now - diagnosticsTimestamp) < DIAGNOSTICS_CACHE_TTL) {
    return cachedDiagnostics;
  }

  // If a diagnosis is already running, wait for it instead of starting a new one
  if (activeDiagnosticsPromise) {
    return activeDiagnosticsPromise;
  }

  // Start a new diagnosis
  activeDiagnosticsPromise = runDiagnostics().finally(() => {
    activeDiagnosticsPromise = null;
  });

  return activeDiagnosticsPromise;
}

app.get("/api/diagnose", async (req, res) => {
  const forceRefresh = req.query.refresh === "true";
  try {
    const result = await getDiagnostics(forceRefresh);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── SPA fallback (Express 5 syntax) ───
app.get("/{*splat}", (_req, res) => {
  res.sendFile(resolve(__dirname, "public", "index.html"));
});

// ─── Start server ───
export function startWebServer() {
  initDatabase();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(chalk.bold.magenta(`\n  StrategyGravity Web Server`));
    console.log(chalk.cyan(`  http://localhost:${PORT}`));
    console.log(chalk.dim(`  Ctrl+C para detener\n`));

    // Run provider diagnostics via singleton (frontend /api/diagnose will reuse this)
    console.log(chalk.cyan("  Diagnosticando proveedores LLM..."));
    getDiagnostics(true).then((result: any) => {
      const working = result.summary?.working || [];
      const failing = result.summary?.failing || [];

      if (working.length > 0) {
        console.log(chalk.green(`  Proveedores activos: ${working.join(", ")}`));
      }
      if (failing.length > 0) {
        console.log(chalk.yellow(`  Proveedores con problemas: ${failing.join(", ")}`));
      }
      if (working.length === 0) {
        console.log(chalk.red.bold(`  ADVERTENCIA: Ningun proveedor LLM funcional!`));
      }
      console.log("");
    }).catch(() => {});
  });
}
