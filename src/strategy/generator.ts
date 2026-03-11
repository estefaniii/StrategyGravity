import { generate } from "../llm/index.js";
import { researchCompetitors, researchKeywords } from "../tools/deep-research.js";
import { saveStrategy } from "../core/memory.js";
import type { MarketingStrategy, BrandIdentity, Competitor, KeywordGroup, ProgressCallback } from "../types/index.js";
import * as prompts from "./prompts.js";
import chalk from "chalk";

function parseJSON<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Try to fix common JSON issues: trailing commas, unescaped newlines
    let fixed = match[0]
      .replace(/,\s*([}\]])/g, "$1")           // trailing commas
      .replace(/[\r\n]+/g, " ")                  // newlines inside strings
      .replace(/\t/g, " ");                      // tabs
    try {
      return JSON.parse(fixed) as T;
    } catch {
      // Last resort: extract up to the last valid closing brace
      const lastBrace = fixed.lastIndexOf("}");
      if (lastBrace > 0) {
        try {
          return JSON.parse(fixed.slice(0, lastBrace + 1)) as T;
        } catch {
          throw new Error("Failed to parse JSON after multiple attempts");
        }
      }
      throw new Error("Failed to parse JSON from LLM response");
    }
  }
}

function log(step: string, msg: string) {
  console.log(chalk.cyan(`  [${step}]`) + ` ${msg}`);
}

export async function generateStrategy(
  brand: BrandIdentity,
  onProgress?: ProgressCallback
): Promise<MarketingStrategy> {
  const now = new Date().toISOString();
  const emit = onProgress || (() => {});
  const TOTAL = 12;

  console.log(chalk.bold.magenta(`\n  Generando estrategia para ${brand.companyName}...\n`));

  // ─── Point 1: Descripcion ───
  emit(1, TOTAL, "Generando descripcion ejecutiva...");
  log("1/12", "Generando descripcion...");
  const descResponse = await generate(
    prompts.promptDescription(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const description = parseJSON<{ summary: string; objective: string }>(descResponse.text);

  // ─── Services (needed early) ───
  log("prep", "Definiendo servicios...");
  const svcResponse = await generate(
    prompts.promptServices(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { services } = parseJSON<{ services: MarketingStrategy["services"] }>(svcResponse.text);

  // ─── Point 2: Competitor Research (REAL web search + scraping) ───
  emit(2, TOTAL, "Buscando y analizando competidores reales...");
  log("2/12", "Investigando competencia (busqueda web real)...");
  const location = brand.location || "mercado objetivo";
  const compResult = await researchCompetitors(brand.companyName, brand.industry, location);

  let competitors: Competitor[] = [];
  if (compResult.success && Array.isArray(compResult.data)) {
    competitors = compResult.data;
    // Refine with AI for deeper analysis
    log("2/12", `${competitors.length} competidores encontrados, refinando analisis...`);
    try {
      const refineResponse = await generate(
        prompts.promptCompetitorAnalysis(brand, competitors),
        prompts.STRATEGY_SYSTEM_PROMPT,
        { maxTokens: 8192 }
      );
      const refined = parseJSON<{ competitors: Competitor[] }>(refineResponse.text);
      competitors = refined.competitors;
    } catch (err) {
      log("2/12", `Refinamiento parcial: ${(err as Error).message?.slice(0, 50)}`);
    }
  }
  log("2/12", `${competitors.length} competidores analizados`);

  // ─── Point 3: Comparative Analysis ───
  emit(3, TOTAL, "Generando analisis comparativo...");
  log("3/12", "Generando analisis comparativo...");
  const compAnalysisResponse = await generate(
    prompts.promptComparativeAnalysis(brand, competitors),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { comparativeAnalysis } = parseJSON<{ comparativeAnalysis: string }>(compAnalysisResponse.text);

  // ─── Point 4: Keyword Research (with web grounding) ───
  emit(4, TOTAL, "Investigando keywords estrategicas...");
  log("4/12", "Investigando keywords (con datos web)...");
  const kwResult = await researchKeywords(
    brand.companyName,
    brand.industry,
    services.map((s) => s.name),
    location
  );
  let keywordGroups: KeywordGroup[] = [];
  if (kwResult.success && Array.isArray(kwResult.data)) {
    keywordGroups = kwResult.data;
    try {
      const kwRefine = await generate(
        prompts.promptKeywords(brand, keywordGroups),
        prompts.STRATEGY_SYSTEM_PROMPT,
        { maxTokens: 8192 }
      );
      const refined = parseJSON<{ keywordGroups: KeywordGroup[] }>(kwRefine.text);
      keywordGroups = refined.keywordGroups;
    } catch {}
  }
  log("4/12", `${keywordGroups.length} grupos de keywords`);

  // ─── Point 5: Strategic Conclusions ───
  emit(5, TOTAL, "Formulando conclusiones estrategicas...");
  log("5/12", "Conclusiones estrategicas...");
  const conclusionsResponse = await generate(
    prompts.promptStrategicConclusions(brand, competitors, keywordGroups),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { strategicConclusions } = parseJSON<{ strategicConclusions: string[] }>(conclusionsResponse.text);

  // ─── Point 6: Differentiation ───
  emit(6, TOTAL, "Proponiendo estrategias de diferenciacion...");
  log("6/12", "Diferenciacion...");
  const diffResponse = await generate(
    prompts.promptDifferentiation(brand, strategicConclusions),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { differentiationProposals } = parseJSON<{ differentiationProposals: string[] }>(diffResponse.text);

  // ─── Point 7: Brand Design ───
  emit(7, TOTAL, "Definiendo diseno de marca...");
  log("7/12", "Diseno de marca...");
  const brandResponse = await generate(
    prompts.promptBrandDesign(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const brandDesignData = parseJSON<{
    personality: string;
    values: string[];
    guidelines: string;
    styleReferences: string[];
  }>(brandResponse.text);

  // ─── Point 8: Content Strategy ───
  emit(8, TOTAL, "Creando estrategia de contenido...");
  log("8/12", "Estrategia de contenido...");
  const csResponse = await generate(
    prompts.promptContentStrategy(brand, services),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { contentStrategy } = parseJSON<{ contentStrategy: MarketingStrategy["contentStrategy"] }>(csResponse.text);

  // ─── Point 9: Content Pillars ───
  emit(9, TOTAL, "Definiendo pilares de contenido...");
  log("9/12", "Pilares de contenido...");
  const pillarsResponse = await generate(
    prompts.promptContentPillars(brand, contentStrategy),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { contentPillars } = parseJSON<{ contentPillars: MarketingStrategy["contentPillars"] }>(pillarsResponse.text);

  // ─── Point 10: Content Grid ───
  emit(10, TOTAL, "Armando grilla de contenido semanal...");
  log("10/12", "Grilla de contenido...");
  const gridResponse = await generate(
    prompts.promptContentGrid(brand, contentPillars),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { contentGrid } = parseJSON<{ contentGrid: MarketingStrategy["contentGrid"] }>(gridResponse.text);

  // ─── Point 11: KPIs ───
  emit(11, TOTAL, "Definiendo KPIs...");
  log("11/12", "KPIs...");
  let kpis: MarketingStrategy["kpis"] = [];
  try {
    const kpiResponse = await generate(
      prompts.promptKPIs(brand),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096 }
    );
    const parsed = parseJSON<{ kpis: MarketingStrategy["kpis"] }>(kpiResponse.text);
    kpis = parsed.kpis;
  } catch (err) {
    log("11/12", `KPIs parciales: ${(err as Error).message?.slice(0, 50)}`);
    kpis = [
      { category: "Atraccion y SEO", metric: "Trafico organico mensual", description: "Visitas desde buscadores", target: "+30% en 6 meses" },
      { category: "Conversion y Ventas", metric: "Tasa de conversion", description: "Porcentaje de visitantes que convierten", target: "3-5%" },
      { category: "Retencion y Lealtad", metric: "Tasa de retencion", description: "Clientes que repiten", target: "+20% en 6 meses" },
      { category: "Marca y Engagement", metric: "Engagement rate", description: "Interacciones en redes sociales", target: "4-6%" },
    ];
  }

  // ─── Point 12: Timeline + Conclusions ───
  emit(12, TOTAL, "Creando cronograma y conclusiones finales...");
  log("12/12", "Cronograma y conclusiones...");

  const timeResponse = await generate(
    prompts.promptTimeline(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { implementationTimeline } = parseJSON<{ implementationTimeline: MarketingStrategy["implementationTimeline"] }>(timeResponse.text);

  const strategySummary = `${brand.companyName}: ${description.summary.slice(0, 200)}. Competidores: ${competitors.map((c) => c.name).join(", ")}. Pilares: ${contentPillars.map((p) => p.name).join(", ")}`;
  const finalResponse = await generate(
    prompts.promptConclusions(brand, strategySummary),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { conclusions, recommendations } = parseJSON<{ conclusions: string[]; recommendations: string[] }>(finalResponse.text);

  // ─── Assemble Strategy ───
  const strategy: MarketingStrategy = {
    companyName: brand.companyName,
    createdAt: now,
    updatedAt: now,
    description,
    competitors,
    comparativeAnalysis,
    keywordGroups,
    strategicConclusions,
    differentiationProposals,
    services,
    brandDesign: {
      identity: brand,
      personality: brandDesignData.personality,
      values: brandDesignData.values,
      guidelines: brandDesignData.guidelines,
      styleReferences: brandDesignData.styleReferences,
    },
    contentStrategy,
    contentPillars,
    contentGrid,
    kpis,
    implementationTimeline,
    conclusions,
    recommendations,
  };

  // Save to SQLite
  const id = saveStrategy(strategy);
  strategy.id = id;

  console.log(chalk.green.bold(`\n  Estrategia guardada con ID: ${id}`));

  // Generate PPTX
  console.log(chalk.yellow(`\n  Generando presentacion PPTX...\n`));
  try {
    const { generatePptx } = await import("../tools/pptx-generator.js");
    const pptxResult = await generatePptx(strategy);
    if (pptxResult.success) {
      const data = pptxResult.data as Record<string, unknown>;
      console.log(chalk.green(`  PPTX generado: ${data.filePath}`));
      console.log(chalk.green(`  Slides: ${data.slideCount}`));
    }
  } catch (err) {
    console.log(chalk.yellow(`  PPTX no generado: ${(err as Error).message?.slice(0, 80)}`));
  }

  return strategy;
}
