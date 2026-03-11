import express from "express";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initDatabase } from "../core/memory.js";
import { extractBrandFromUrl, extractBrandFromInstagram, extractBrandFromDescription, setAutoConfirm } from "../tools/brand-extractor.js";

// Web mode: no terminal available, auto-confirm brand data
setAutoConfirm(true);
import { generateStrategy } from "../strategy/generator.js";
import { generatePptx } from "../tools/pptx-generator.js";
import { getLatestStrategy, getStrategy, listStrategies } from "../core/memory.js";
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
  req.on("close", () => sseClients.delete(sessionId));
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
    client.write(`data: ${JSON.stringify({ type: "error", error })}\n\n`);
  }
}

// ─── Generate Strategy from URL ───
app.post("/api/strategy/url", async (req, res) => {
  const { url, sessionId } = req.body;
  if (!url) return res.status(400).json({ error: "URL requerida" });

  try {
    sendProgress(sessionId, 0, 12, "Analizando sitio web...");
    const brandResult = await extractBrandFromUrl(url);
    if (!brandResult.success) {
      sendError(sessionId, brandResult.error || "Error al analizar URL");
      return res.status(400).json({ error: brandResult.error });
    }

    const brand = brandResult.data as BrandIdentity;
    sendProgress(sessionId, 0, 12, `Marca detectada: ${brand.companyName}. Iniciando estrategia...`);

    res.json({ status: "generating", companyName: brand.companyName });

    // Generate strategy asynchronously
    const strategy = await generateStrategy(brand, (step, total, msg) => {
      sendProgress(sessionId, step, total, msg);
    });
    currentStrategy = strategy;
    sendComplete(sessionId, { id: strategy.id, companyName: strategy.companyName });
  } catch (err) {
    sendError(sessionId, (err as Error).message);
  }
});

// ─── Generate Strategy from Instagram ───
app.post("/api/strategy/instagram", async (req, res) => {
  const { handle, sessionId } = req.body;
  if (!handle) return res.status(400).json({ error: "Handle requerido" });

  try {
    sendProgress(sessionId, 0, 12, "Analizando perfil de Instagram...");
    const brandResult = await extractBrandFromInstagram(handle);
    if (!brandResult.success) {
      sendError(sessionId, brandResult.error || "Error al analizar Instagram");
      return res.status(400).json({ error: brandResult.error });
    }

    const brand = brandResult.data as BrandIdentity;
    res.json({ status: "generating", companyName: brand.companyName });

    const strategy = await generateStrategy(brand, (step, total, msg) => {
      sendProgress(sessionId, step, total, msg);
    });
    currentStrategy = strategy;
    sendComplete(sessionId, { id: strategy.id, companyName: strategy.companyName });
  } catch (err) {
    sendError(sessionId, (err as Error).message);
  }
});

// ─── Generate Strategy from Description ───
app.post("/api/strategy/description", async (req, res) => {
  const { description, sessionId } = req.body;
  if (!description) return res.status(400).json({ error: "Descripcion requerida" });

  try {
    sendProgress(sessionId, 0, 12, "Analizando descripcion...");
    const brandResult = await extractBrandFromDescription(description);
    if (!brandResult.success) {
      sendError(sessionId, brandResult.error || "Error al analizar descripcion");
      return res.status(400).json({ error: brandResult.error });
    }

    const brand = brandResult.data as BrandIdentity;
    res.json({ status: "generating", companyName: brand.companyName });

    const strategy = await generateStrategy(brand, (step, total, msg) => {
      sendProgress(sessionId, step, total, msg);
    });
    currentStrategy = strategy;
    sendComplete(sessionId, { id: strategy.id, companyName: strategy.companyName });
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
      res.download(filePath, `${strategy.companyName.replace(/\s+/g, "_")}_Estrategia.pptx`);
    } else {
      res.status(500).json({ error: result.error });
    }
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
  app.listen(PORT, () => {
    console.log(chalk.bold.magenta(`\n  StrategyGravity Web Server`));
    console.log(chalk.cyan(`  http://localhost:${PORT}`));
    console.log(chalk.dim(`  Ctrl+C para detener\n`));
  });
}
