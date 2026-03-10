import { generate } from "../llm/index.js";
import { researchCompetitors, researchKeywords } from "../tools/deep-research.js";
import { generatePresentation } from "../tools/slides-generator.js";
import { saveStrategy } from "../core/memory.js";
import type { MarketingStrategy, BrandIdentity, Competitor, KeywordGroup } from "../types/index.js";
import * as prompts from "./prompts.js";
import chalk from "chalk";

function parseJSON<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]) as T;
}

function log(step: string, msg: string) {
  console.log(chalk.cyan(`  [${step}]`) + ` ${msg}`);
}

export async function generateStrategy(brand: BrandIdentity): Promise<MarketingStrategy> {
  const now = new Date().toISOString();

  console.log(chalk.bold.magenta(`\n  Generando estrategia para ${brand.companyName}...\n`));

  // ─── Point 1: Description ───
  log("1/14", "Generando descripcion...");
  const descResponse = await generate(
    prompts.promptDescription(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const description = parseJSON<{ summary: string; objective: string }>(descResponse.text);

  // ─── Point 7: Services (needed early for other points) ───
  log("7/14", "Definiendo servicios...");
  const svcResponse = await generate(
    prompts.promptServices(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { services } = parseJSON<{ services: MarketingStrategy["services"] }>(svcResponse.text);

  // ─── Point 2: Competitor Research ───
  log("2/14", "Investigando competencia...");
  const compResult = await researchCompetitors(
    brand.companyName,
    brand.industry,
    "based on description"
  );
  let competitors: Competitor[] = [];
  if (compResult.success && Array.isArray(compResult.data)) {
    competitors = compResult.data;
    // Refine with AI
    const refineResponse = await generate(
      prompts.promptCompetitorAnalysis(brand, competitors),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 8192 }
    );
    const refined = parseJSON<{ competitors: Competitor[] }>(refineResponse.text);
    competitors = refined.competitors;
  }
  log("2/14", `${competitors.length} competidores analizados`);

  // ─── Point 3: Comparative Analysis ───
  log("3/14", "Generando analisis comparativo...");
  const compAnalysisResponse = await generate(
    prompts.promptComparativeAnalysis(brand, competitors),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { comparativeAnalysis } = parseJSON<{ comparativeAnalysis: string }>(compAnalysisResponse.text);

  // ─── Point 4: Keyword Research ───
  log("4/14", "Investigando keywords...");
  const kwResult = await researchKeywords(
    brand.companyName,
    brand.industry,
    services.map((s) => s.name),
    "based on market"
  );
  let keywordGroups: KeywordGroup[] = [];
  if (kwResult.success && Array.isArray(kwResult.data)) {
    keywordGroups = kwResult.data;
    // Refine
    const kwRefine = await generate(
      prompts.promptKeywords(brand, keywordGroups),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096 }
    );
    const refined = parseJSON<{ keywordGroups: KeywordGroup[] }>(kwRefine.text);
    keywordGroups = refined.keywordGroups;
  }
  log("4/14", `${keywordGroups.length} grupos de keywords`);

  // ─── Point 5: Strategic Conclusions ───
  log("5/14", "Formulando conclusiones estrategicas...");
  const conclusionsResponse = await generate(
    prompts.promptStrategicConclusions(brand, competitors, keywordGroups),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { strategicConclusions } = parseJSON<{ strategicConclusions: string[] }>(conclusionsResponse.text);

  // ─── Point 6: Differentiation ───
  log("6/14", "Proponiendo diferenciacion...");
  const diffResponse = await generate(
    prompts.promptDifferentiation(brand, strategicConclusions),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { differentiationProposals } = parseJSON<{ differentiationProposals: string[] }>(diffResponse.text);

  // ─── Point 8: Brand Design ───
  log("8/14", "Definiendo diseno de marca...");
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

  // ─── Point 9: Content Strategy ───
  log("9/14", "Creando estrategia de contenido...");
  const csResponse = await generate(
    prompts.promptContentStrategy(brand, services),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { contentStrategy } = parseJSON<{ contentStrategy: MarketingStrategy["contentStrategy"] }>(csResponse.text);

  // ─── Point 10: Content Pillars ───
  log("10/14", "Definiendo pilares de contenido...");
  const pillarsResponse = await generate(
    prompts.promptContentPillars(brand, contentStrategy),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { contentPillars } = parseJSON<{ contentPillars: MarketingStrategy["contentPillars"] }>(pillarsResponse.text);

  // ─── Point 11: Content Grid ───
  log("11/14", "Armando grilla de contenido...");
  const gridResponse = await generate(
    prompts.promptContentGrid(brand, contentPillars),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 4096 }
  );
  const { contentGrid } = parseJSON<{ contentGrid: MarketingStrategy["contentGrid"] }>(gridResponse.text);

  // ─── Point 12: KPIs ───
  log("12/14", "Definiendo KPIs...");
  const kpiResponse = await generate(
    prompts.promptKPIs(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { kpis } = parseJSON<{ kpis: MarketingStrategy["kpis"] }>(kpiResponse.text);

  // ─── Point 13: Timeline ───
  log("13/14", "Creando cronograma...");
  const timeResponse = await generate(
    prompts.promptTimeline(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048 }
  );
  const { implementationTimeline } = parseJSON<{ implementationTimeline: MarketingStrategy["implementationTimeline"] }>(timeResponse.text);

  // ─── Point 14: Conclusions ───
  log("14/14", "Finalizando conclusiones...");
  const strategySummary = `Company: ${brand.companyName}. ${description.summary}. ${strategicConclusions[0]}. Pillars: ${contentPillars.map(p => p.name).join(", ")}`;
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

  // Generate presentation
  console.log(chalk.yellow(`\n  Generando presentacion...\n`));
  const slideResult = await generatePresentation(strategy);
  if (slideResult.success) {
    const slideData = slideResult.data as Record<string, unknown>;
    if (slideData.url) {
      console.log(chalk.green(`  Presentacion creada: ${slideData.url}`));
      console.log(chalk.green(`  Editar: ${slideData.editUrl}`));
    } else {
      console.log(chalk.yellow(`  Presentacion generada en modo offline (${slideData.slideCount} slides)`));
      console.log(chalk.dim(`  Configura service-account.json para exportar a Google Slides`));
    }
  }

  return strategy;
}
