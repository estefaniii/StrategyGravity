import { generate } from "../llm/index.js";
import { researchCompetitors, researchKeywords } from "../tools/deep-research.js";
import { saveStrategy } from "../core/memory.js";
import type { MarketingStrategy, BrandIdentity, Competitor, KeywordGroup, ProgressCallback } from "../types/index.js";
import * as prompts from "./prompts.js";
import chalk from "chalk";

function parseJSON<T>(text: string): T {
  // Strip markdown fences (```json ... ``` or ``` ... ```)
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/gi, "").trim();

  // Try to find the outermost JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");

  const attempts: Array<() => T> = [
    // 1. Direct parse
    () => JSON.parse(match[0]) as T,

    // 2. Fix trailing commas, newlines, tabs
    () => {
      const fixed = match[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\r\n]+/g, " ")
        .replace(/\t/g, " ");
      return JSON.parse(fixed) as T;
    },

    // 3. Also fix unescaped quotes inside string values
    () => {
      let fixed = match[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\r\n]+/g, " ")
        .replace(/\t/g, " ");
      // Fix control characters inside strings
      fixed = fixed.replace(/[\x00-\x1F]/g, " ");
      return JSON.parse(fixed) as T;
    },

    // 4. Truncate at last valid closing brace
    () => {
      const fixed = match[0]
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\r\n]+/g, " ")
        .replace(/\t/g, " ")
        .replace(/[\x00-\x1F]/g, " ");
      const lastBrace = fixed.lastIndexOf("}");
      if (lastBrace <= 0) throw new Error("no brace");
      return JSON.parse(fixed.slice(0, lastBrace + 1)) as T;
    },

    // 5. Aggressive: strip everything after last complete key-value pair
    () => {
      let fixed = match[0]
        .replace(/[\r\n\t\x00-\x1F]/g, " ")
        .replace(/,\s*([}\]])/g, "$1");
      // Find all balanced braces and pick the longest valid parse
      for (let end = fixed.length; end > 10; end--) {
        if (fixed[end - 1] === "}") {
          try { return JSON.parse(fixed.slice(0, end)) as T; } catch { /* try shorter */ }
        }
      }
      throw new Error("no valid JSON found");
    },
  ];

  for (const attempt of attempts) {
    try { return attempt(); } catch { /* try next */ }
  }

  throw new Error("Failed to parse JSON after multiple attempts");
}

function log(step: string, msg: string) {
  console.log(chalk.cyan(`  [${step}]`) + ` ${msg}`);
}

// Delay between LLM steps to reduce rate limit pressure on free-tier providers
const STEP_DELAY_MS = 1000;
function paceDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, STEP_DELAY_MS));
}

/**
 * Generate JSON from LLM with automatic retry on parse failure.
 * On first failure, retries once with a "fix your JSON" correction prompt.
 */
async function generateJSON<T>(
  prompt: string,
  systemPrompt: string,
  options: { maxTokens: number; label?: string },
): Promise<T> {
  const label = options.label || "step";

  // First attempt
  const response = await generate(prompt, systemPrompt, { maxTokens: options.maxTokens });

  try {
    return parseJSON<T>(response.text);
  } catch (firstErr) {
    // Log raw response for debugging
    const preview = response.text?.slice(0, 300) || "(empty)";
    console.log(chalk.yellow(`  [${label}] JSON parse fallo. Respuesta raw (300 chars): ${preview}`));

    // Retry with correction prompt
    console.log(chalk.yellow(`  [${label}] Reintentando con prompt de correccion...`));
    try {
      const correctionPrompt = `Tu respuesta anterior NO fue JSON valido. Aqui esta lo que respondiste:

---
${response.text.slice(0, 1500)}
---

CORRIGE y retorna SOLO JSON valido, sin texto adicional, sin backticks, sin markdown. Solo el objeto JSON puro comenzando con { y terminando con }.

Prompt original: ${prompt.slice(0, 500)}`;

      const retryResponse = await generate(correctionPrompt, systemPrompt, {
        maxTokens: options.maxTokens,
      });

      return parseJSON<T>(retryResponse.text);
    } catch (retryErr) {
      const retryPreview = (retryErr as any)?.text?.slice(0, 200) || "";
      console.log(chalk.red(`  [${label}] Segundo intento tambien fallo. ${retryPreview}`));
      throw new Error(`Failed to generate valid JSON for ${label} after 2 attempts`);
    }
  }
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
  const description = await generateJSON<{ summary: string; objective: string }>(
    prompts.promptDescription(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048, label: "1/12 Descripcion" }
  );
  await paceDelay();

  // ─── Services (needed early) ───
  log("prep", "Definiendo servicios...");
  const { services } = await generateJSON<{ services: MarketingStrategy["services"] }>(
    prompts.promptServices(brand),
    prompts.STRATEGY_SYSTEM_PROMPT,
    { maxTokens: 2048, label: "prep Servicios" }
  );
  await paceDelay();

  // ─── Point 2: Competitor Research (REAL web search + scraping) ───
  emit(2, TOTAL, "Buscando y analizando competidores reales...");
  log("2/12", "Investigando competencia (busqueda web real)...");

  // Clean up location — if it's unusable, default to something generic
  let location = brand.location || "mercado objetivo";
  if (/no determinable|desconocid|unknown|n\/a|not available/i.test(location)) {
    location = "mercado objetivo";
    log("2/12", `Ubicacion no disponible, usando busqueda general`);
  }

  const compResult = await researchCompetitors(brand.companyName, brand.industry, location);

  let competitors: Competitor[] = [];
  if (compResult.success) {
    // Handle both array data and object with competitors key
    const rawData = compResult.data;
    if (Array.isArray(rawData)) {
      competitors = rawData;
    } else if (rawData && typeof rawData === "object") {
      competitors = (rawData as any).competitors || (rawData as any).competidores || [];
    }

    if (competitors.length > 0) {
      // Refine with AI for deeper analysis
      log("2/12", `${competitors.length} competidores encontrados, refinando analisis...`);
      try {
        const refined = await generateJSON<{ competitors: Competitor[] }>(
          prompts.promptCompetitorAnalysis(brand, competitors),
          prompts.STRATEGY_SYSTEM_PROMPT,
          { maxTokens: 4096, label: "2/12 Refinar competidores" }
        );
        if (refined.competitors?.length > 0) {
          competitors = refined.competitors;
        }
      } catch (err) {
        log("2/12", `Refinamiento parcial: ${(err as Error).message?.slice(0, 50)}`);
      }
    }
  } else {
    log("2/12", `Investigacion web fallo: ${compResult.error?.slice(0, 60)}`);
  }

  // If still no competitors after web+LLM, generate directly with a focused prompt
  if (competitors.length === 0) {
    log("2/12", "Sin competidores, generando analisis directo con IA...");
    try {
      const parsed = await generateJSON<{ competitors: Competitor[] }>(
        prompts.promptCompetitorAnalysis(brand, []),
        prompts.STRATEGY_SYSTEM_PROMPT,
        { maxTokens: 4096, label: "2/12 Competidores directos" }
      );
      if (parsed.competitors?.length > 0) {
        competitors = parsed.competitors;
      }
    } catch (err) {
      log("2/12", `Generacion directa fallo: ${(err as Error).message?.slice(0, 50)}`);
    }
  }

  // Guarantee minimum 5 competitors — supplement with LLM if we have fewer
  const TARGET_COMPETITORS = 5;
  if (competitors.length > 0 && competitors.length < TARGET_COMPETITORS) {
    const missing = TARGET_COMPETITORS - competitors.length;
    log("2/12", `Solo ${competitors.length} competidores, buscando ${missing} más con IA...`);
    try {
      const existingNames = competitors.map(c => c.name).join(", ");
      const supplementPrompt = `Ya tenemos ${competitors.length} competidores de "${brand.companyName}" en ${brand.industry}${brand.location ? ` en ${brand.location}` : ""}: ${existingNames}.

Necesitamos EXACTAMENTE ${missing} competidores ADICIONALES que:
1. Sean empresas REALES del mismo sector (${brand.industry})
2. Operen en la misma ubicación (${brand.location || "mercado objetivo"})
3. NO sean ninguno de los ya listados: ${existingNames}
4. Aparecerían en los primeros resultados de Google al buscar "${brand.industry}${brand.location ? ` en ${brand.location}` : ""}"
5. Sean COMPETIDORES DIRECTOS que compitan por el mismo cliente

Para CADA competidor incluye análisis detallado con fortalezas, debilidades y oportunidades.

Retorna SOLO JSON:
{
  "competitors": [
    {
      "name": "nombre", "website": "url", "detailedAnalysis": "200+ palabras...",
      "services": [], "strengths": ["min 3"], "weaknesses": ["min 3"], "opportunitiesForUs": ["min 2"],
      "seoAnalysis": { "topKeywords": [], "estimatedTraffic": "nivel" }
    }
  ]
}`;
      const supplemented = await generateJSON<{ competitors: Competitor[] }>(
        supplementPrompt,
        prompts.STRATEGY_SYSTEM_PROMPT,
        { maxTokens: 4096, label: "2/12 Competidores adicionales" }
      );
      if (supplemented.competitors?.length > 0) {
        competitors = [...competitors, ...supplemented.competitors.slice(0, missing)];
        log("2/12", `Completados a ${competitors.length} competidores`);
      }
    } catch (err) {
      log("2/12", `Suplemento parcial: ${(err as Error).message?.slice(0, 50)}`);
    }
  }

  log("2/12", `${competitors.length} competidores analizados`);
  await paceDelay();

  // ─── Point 3: Comparative Analysis ───
  emit(3, TOTAL, "Generando analisis comparativo...");
  log("3/12", "Generando analisis comparativo...");
  let comparativeAnalysis = "";
  try {
    const parsed = await generateJSON<{ comparativeAnalysis: string }>(
      prompts.promptComparativeAnalysis(brand, competitors),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096, label: "3/12 Analisis comparativo" }
    );
    comparativeAnalysis = parsed.comparativeAnalysis;
  } catch (err) {
    log("3/12", `Analisis comparativo parcial: ${(err as Error).message?.slice(0, 50)}`);
    comparativeAnalysis = `Análisis comparativo del mercado de ${brand.industry} en ${brand.location}. Se identificaron ${competitors.length} competidores principales. Se recomienda enfocarse en diferenciación a través de calidad de servicio y presencia digital.`;
  }

  await paceDelay();

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
  if (kwResult.success) {
    const rawKw = kwResult.data;
    if (Array.isArray(rawKw)) {
      keywordGroups = rawKw;
    } else if (rawKw && typeof rawKw === "object") {
      keywordGroups = (rawKw as any).keywordGroups || (rawKw as any).keyword_groups || [];
    }

    if (keywordGroups.length > 0) {
      try {
        const refined = await generateJSON<{ keywordGroups: KeywordGroup[] }>(
          prompts.promptKeywords(brand, keywordGroups),
          prompts.STRATEGY_SYSTEM_PROMPT,
          { maxTokens: 4096, label: "4/12 Refinar keywords" }
        );
        if (refined.keywordGroups?.length > 0) {
          keywordGroups = refined.keywordGroups;
        }
      } catch {}
    }
  }

  // If still no keywords, generate directly
  if (keywordGroups.length === 0) {
    log("4/12", "Sin keywords web, generando con IA...");
    try {
      const parsed = await generateJSON<{ keywordGroups: KeywordGroup[] }>(
        prompts.promptKeywords(brand, []),
        prompts.STRATEGY_SYSTEM_PROMPT,
        { maxTokens: 4096, label: "4/12 Keywords directas" }
      );
      if (parsed.keywordGroups?.length > 0) {
        keywordGroups = parsed.keywordGroups;
      }
    } catch (err) {
      log("4/12", `Keywords directas fallaron: ${(err as Error).message?.slice(0, 50)}`);
    }
  }
  log("4/12", `${keywordGroups.length} grupos de keywords`);
  await paceDelay();

  // ─── Point 5: Strategic Conclusions ───
  emit(5, TOTAL, "Formulando conclusiones estrategicas...");
  log("5/12", "Conclusiones estrategicas...");
  let strategicConclusions: string[] = [];
  try {
    const parsed = await generateJSON<{ strategicConclusions: string[] }>(
      prompts.promptStrategicConclusions(brand, competitors, keywordGroups),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096, label: "5/12 Conclusiones estrategicas" }
    );
    strategicConclusions = parsed.strategicConclusions;
  } catch (err) {
    log("5/12", `Conclusiones parciales: ${(err as Error).message?.slice(0, 50)}`);
    strategicConclusions = [
      `El mercado de ${brand.industry} en ${brand.location} presenta oportunidades significativas de crecimiento digital.`,
      `La competencia tiene debilidades en presencia digital que ${brand.companyName} puede aprovechar.`,
      "La diferenciación a través de contenido de valor y experiencia de marca será clave.",
      "Se recomienda una estrategia omnicanal con enfoque en redes sociales y SEO local.",
    ];
  }

  await paceDelay();

  // ─── Point 6: Differentiation ───
  emit(6, TOTAL, "Proponiendo estrategias de diferenciacion...");
  log("6/12", "Diferenciacion...");
  let differentiationProposals: string[] = [];
  try {
    const parsed = await generateJSON<{ differentiationProposals: string[] }>(
      prompts.promptDifferentiation(brand, strategicConclusions),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096, label: "6/12 Diferenciacion" }
    );
    differentiationProposals = parsed.differentiationProposals;
  } catch (err) {
    log("6/12", `Diferenciacion parcial: ${(err as Error).message?.slice(0, 50)}`);
    differentiationProposals = [
      "Posicionamiento premium basado en calidad y experiencia de marca.",
      "Contenido educativo y storytelling auténtico como diferenciador.",
      "Presencia digital superior con UX optimizada y atención personalizada.",
      "Programa de fidelización y comunidad de marca activa.",
    ];
  }

  await paceDelay();

  // ─── Point 7: Brand Design ───
  emit(7, TOTAL, "Definiendo diseno de marca...");
  log("7/12", "Diseno de marca...");
  let brandDesignData = {
    personality: `${brand.companyName} proyecta una imagen moderna, profesional y cercana.`,
    values: ["Calidad", "Innovación", "Cercanía", "Profesionalismo"],
    guidelines: "Comunicación clara, visual moderna y consistente en todos los canales.",
    styleReferences: ["Diseño minimalista", "Fotografía profesional", "Tipografía moderna"],
  };
  try {
    const parsed = await generateJSON<{
      personality: string;
      values: string[];
      guidelines: string;
      styleReferences: string[];
    }>(
      prompts.promptBrandDesign(brand),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 2048, label: "7/12 Diseno de marca" }
    );
    brandDesignData = parsed;
  } catch (err) {
    log("7/12", `Diseno parcial: ${(err as Error).message?.slice(0, 50)}`);
  }

  await paceDelay();

  // ─── Point 8: Content Strategy ───
  emit(8, TOTAL, "Creando estrategia de contenido...");
  log("8/12", "Estrategia de contenido...");
  let contentStrategy: MarketingStrategy["contentStrategy"] = {
    targetAudience: ["Público general interesado en " + brand.industry],
    painPoints: ["Falta de opciones de calidad", "Desconocimiento de la marca"],
    channels: ["Instagram", "Facebook", "Google My Business", "TikTok"],
    focusAreas: ["Branding", "Contenido educativo", "Engagement en redes"],
    tone: "Profesional pero cercano, informativo y aspiracional.",
  };
  try {
    const parsed = await generateJSON<{ contentStrategy: MarketingStrategy["contentStrategy"] }>(
      prompts.promptContentStrategy(brand, services),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 2048, label: "8/12 Estrategia contenido" }
    );
    contentStrategy = parsed.contentStrategy;
  } catch (err) {
    log("8/12", `Estrategia contenido parcial: ${(err as Error).message?.slice(0, 50)}`);
  }

  await paceDelay();

  // ─── Point 9: Content Pillars ───
  emit(9, TOTAL, "Definiendo pilares de contenido...");
  log("9/12", "Pilares de contenido...");
  let contentPillars: MarketingStrategy["contentPillars"] = [
    { name: "Educativo", percentage: 30, description: "Contenido que informa y educa a la audiencia", topics: ["Tips", "Guías", "Tutoriales"] },
    { name: "Inspiracional", percentage: 25, description: "Contenido que inspira y motiva", topics: ["Historias", "Testimonios", "Casos de éxito"] },
    { name: "Promocional", percentage: 25, description: "Contenido que promueve productos y servicios", topics: ["Ofertas", "Lanzamientos", "Eventos"] },
    { name: "Entretenimiento", percentage: 20, description: "Contenido ligero y entretenido", topics: ["Behind the scenes", "Tendencias", "Humor"] },
  ];
  try {
    const parsed = await generateJSON<{ contentPillars: MarketingStrategy["contentPillars"] }>(
      prompts.promptContentPillars(brand, contentStrategy),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 2048, label: "9/12 Pilares contenido" }
    );
    contentPillars = parsed.contentPillars;
  } catch (err) {
    log("9/12", `Pilares parciales: ${(err as Error).message?.slice(0, 50)}`);
  }

  await paceDelay();

  // ─── Point 10: Content Grid ───
  emit(10, TOTAL, "Armando grilla de contenido semanal...");
  log("10/12", "Grilla de contenido...");
  let contentGrid: MarketingStrategy["contentGrid"] = [
    { day: "Lunes", platform: "Instagram", contentType: "Carrusel", topic: "Tips de la semana", pillar: "Educativo" },
    { day: "Martes", platform: "Facebook", contentType: "Post", topic: "Detrás de escena", pillar: "Entretenimiento" },
    { day: "Miércoles", platform: "Instagram", contentType: "Reel", topic: "Producto destacado", pillar: "Promocional" },
    { day: "Jueves", platform: "TikTok", contentType: "Video corto", topic: "Tendencia del sector", pillar: "Entretenimiento" },
    { day: "Viernes", platform: "Instagram", contentType: "Story", topic: "Testimonios", pillar: "Inspiracional" },
    { day: "Sábado", platform: "Facebook", contentType: "Post", topic: "Oferta del fin de semana", pillar: "Promocional" },
    { day: "Domingo", platform: "Instagram", contentType: "Post", topic: "Reflexión semanal", pillar: "Inspiracional" },
  ];
  try {
    const parsed = await generateJSON<{ contentGrid: MarketingStrategy["contentGrid"] }>(
      prompts.promptContentGrid(brand, contentPillars),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096, label: "10/12 Grilla contenido" }
    );
    contentGrid = parsed.contentGrid;
  } catch (err) {
    log("10/12", `Grilla parcial: ${(err as Error).message?.slice(0, 50)}`);
  }

  await paceDelay();

  // ─── Point 11: KPIs ───
  emit(11, TOTAL, "Definiendo KPIs...");
  log("11/12", "KPIs...");
  let kpis: MarketingStrategy["kpis"] = [];
  try {
    const parsed = await generateJSON<{ kpis: MarketingStrategy["kpis"] }>(
      prompts.promptKPIs(brand),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 4096, label: "11/12 KPIs" }
    );
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

  await paceDelay();

  // ─── Point 12: Timeline + Conclusions ───
  emit(12, TOTAL, "Creando cronograma y conclusiones finales...");
  log("12/12", "Cronograma y conclusiones...");

  let implementationTimeline: MarketingStrategy["implementationTimeline"];
  try {
    const parsed = await generateJSON<{ implementationTimeline: MarketingStrategy["implementationTimeline"] }>(
      prompts.promptTimeline(brand),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 2048, label: "12/12 Timeline" }
    );
    implementationTimeline = parsed.implementationTimeline;
  } catch (err) {
    console.log(`  [Timeline] Parse failed, using defaults: ${(err as Error).message?.slice(0, 50)}`);
    implementationTimeline = [
      { phase: "Fase 1: Fundamentos", weeks: "Semanas 1-4", tasks: ["Configurar plataformas digitales", "Definir identidad visual", "Crear perfiles sociales", "Planificar contenido inicial"] },
      { phase: "Fase 2: Lanzamiento", weeks: "Semanas 5-8", tasks: ["Publicar contenido SEO", "Iniciar campanas en redes sociales", "Configurar analiticas", "Primera ronda de email marketing"] },
      { phase: "Fase 3: Crecimiento", weeks: "Semanas 9-16", tasks: ["Escalar produccion de contenido", "Optimizar campanas pagadas", "Desarrollar partnerships", "Analizar metricas y ajustar"] },
      { phase: "Fase 4: Optimizacion", weeks: "Semanas 17-24", tasks: ["A/B testing de campanas", "Refinar segmentacion", "Expandir canales exitosos", "Reporte trimestral de resultados"] },
    ];
  }

  let conclusions: string[];
  let recommendations: string[];
  try {
    const strategySummary = `${brand.companyName}: ${description.summary.slice(0, 200)}. Competidores: ${competitors.map((c) => c.name).join(", ")}. Pilares: ${contentPillars.map((p) => p.name).join(", ")}`;
    const parsed = await generateJSON<{ conclusions: string[]; recommendations: string[] }>(
      prompts.promptConclusions(brand, strategySummary),
      prompts.STRATEGY_SYSTEM_PROMPT,
      { maxTokens: 2048, label: "12/12 Conclusiones finales" }
    );
    conclusions = parsed.conclusions;
    recommendations = parsed.recommendations;
  } catch (err) {
    console.log(`  [Conclusions] Parse failed, using defaults: ${(err as Error).message?.slice(0, 50)}`);
    conclusions = [
      `${brand.companyName} tiene oportunidades significativas de crecimiento en el mercado digital.`,
      "La estrategia de contenido multicanal permitira alcanzar al publico objetivo de forma efectiva.",
      "La diferenciacion a traves de contenido de valor sera clave para destacar frente a la competencia.",
      "Se recomienda implementar las fases de manera progresiva para optimizar recursos.",
    ];
    recommendations = [
      "Priorizar la creacion de contenido SEO optimizado para captar trafico organico.",
      "Invertir en redes sociales con contenido visual de alta calidad.",
      "Establecer un sistema de medicion continua para ajustar la estrategia.",
      "Considerar alianzas estrategicas para ampliar el alcance.",
    ];
  }

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

  // PPTX is generated in background by server.ts after sendComplete — not here
  return strategy;
}
