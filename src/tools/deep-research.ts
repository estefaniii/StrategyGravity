import { getResearchProvider } from "../llm/index.js";
import { searchGoogle, deduplicateUrls } from "./web-search.js";
import { scrapeCompetitorWebsite } from "./web-scraper.js";
import { delay } from "./http-utils.js";
import type { ToolResult, Competitor, KeywordGroup, ScrapedCompetitorData } from "../types/index.js";

export async function researchCompetitors(
  companyName: string,
  industry: string,
  location: string
): Promise<ToolResult> {
  const provider = getResearchProvider();

  try {
    // Step 1: Search Google for real competitors
    console.log(`  [Research] Buscando competidores reales de "${companyName}"...`);

    const queries = [
      `mejores empresas ${industry} ${location}`,
      `${industry} ${location} competidores`,
      `${companyName} alternativas ${location}`,
    ];

    const allResults = [];
    for (const query of queries) {
      const results = await searchGoogle(query, 10);
      allResults.push(...results);
      await delay(5000); // Give rate limits time to reset between searches
    }

    // Filter out the company itself and non-business URLs
    const excludePatterns = [
      companyName.toLowerCase(),
      "wikipedia", "youtube", "facebook", "instagram", "twitter",
      "linkedin", "yelp", "tripadvisor", "google.com",
    ];

    const filtered = allResults.filter((r) => {
      const lower = (r.url + r.title).toLowerCase();
      return !excludePatterns.some((p) => lower.includes(p));
    });

    const unique = deduplicateUrls(filtered).slice(0, 5);

    if (unique.length === 0) {
      console.log("  [Research] No se encontraron competidores via web, usando LLM...");
      return await researchCompetitorsWithLLM(companyName, industry, location);
    }

    // Step 2: Scrape each competitor website
    console.log(`  [Research] Analizando ${unique.length} sitios web de competidores...`);

    const scrapedData: ScrapedCompetitorData[] = [];
    for (const result of unique) {
      try {
        const data = await scrapeCompetitorWebsite(result.url);
        scrapedData.push(data);
        await delay(1000);
      } catch (err) {
        console.log(`  [Research] Error scraping ${result.url}: ${(err as Error).message?.slice(0, 50)}`);
      }
    }

    if (scrapedData.length === 0) {
      console.log("  [Research] Scraping fallido, usando LLM...");
      return await researchCompetitorsWithLLM(companyName, industry, location);
    }

    // Step 3: Send scraped data to LLM for structured analysis
    console.log(`  [Research] Analizando ${scrapedData.length} competidores con IA...`);

    const scrapedContext = scrapedData
      .map(
        (d, i) => `
--- COMPETIDOR ${i + 1}: ${d.url} ---
Titulo del sitio: ${d.title}
Meta descripcion: ${d.description}
Servicios detectados: ${d.services.join(", ") || "No detectados"}
Redes sociales: ${d.socialLinks.join(", ") || "No encontradas"}
Tecnologias: ${d.techStack?.join(", ") || "No detectadas"}
Contenido del sitio (extracto): ${d.bodyText.slice(0, 3000)}
`
      )
      .join("\n");

    const prompt = `Eres un analista de inteligencia competitiva de elite. Analiza estos datos REALES extraidos de sitios web de competidores de "${companyName}" en la industria de ${industry} en ${location}.

DATOS REALES EXTRAIDOS DE SITIOS WEB:
${scrapedContext}

Para CADA competidor, crea un analisis PROFUNDO y DETALLADO que incluya:
1. Nombre de la empresa y su descripcion
2. Servicios principales detectados en su sitio web
3. FORTALEZAS (minimo 3) con explicacion detallada
4. DEBILIDADES (minimo 3) con explicacion detallada
5. OPORTUNIDADES para ${companyName}
6. Analisis SEO basico

IMPORTANTE: El campo detailedAnalysis debe tener AL MENOS 200 palabras por competidor.

Retorna SOLO JSON valido:
{
  "competitors": [
    {
      "name": "nombre",
      "website": "url",
      "detailedAnalysis": "analisis extenso de 200+ palabras...",
      "services": ["servicio1", "servicio2"],
      "strengths": ["fortaleza detallada 1", "fortaleza 2", "fortaleza 3"],
      "weaknesses": ["debilidad detallada 1", "debilidad 2", "debilidad 3"],
      "opportunitiesForUs": ["oportunidad 1", "oportunidad 2"],
      "seoAnalysis": { "topKeywords": ["kw1", "kw2"], "estimatedTraffic": "nivel" }
    }
  ]
}`;

    const response = await provider.generate(
      prompt,
      "Eres un analista de inteligencia competitiva experto. Retorna SOLO JSON valido, sin markdown.",
      { maxTokens: 8192 }
    );

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data: data.competitors as Competitor[] };
  } catch (err) {
    console.log(`  [Research] Error: ${(err as Error).message}`);
    return await researchCompetitorsWithLLM(companyName, industry, location);
  }
}

async function researchCompetitorsWithLLM(
  companyName: string,
  industry: string,
  location: string
): Promise<ToolResult> {
  const provider = getResearchProvider();

  const prompt = `Realiza un analisis competitivo PROFUNDO para "${companyName}" en ${industry}, ${location}.
Identifica 5 competidores principales REALES. Para cada uno:
- Nombre y sitio web REAL
- Servicios, fortalezas (3+), debilidades (3+), oportunidades
- Analisis SEO

Retorna SOLO JSON:
{
  "competitors": [
    {
      "name": "nombre", "website": "url", "detailedAnalysis": "200+ palabras...",
      "services": [], "strengths": [], "weaknesses": [], "opportunitiesForUs": [],
      "seoAnalysis": { "topKeywords": [], "estimatedTraffic": "nivel" }
    }
  ]
}`;

  try {
    const response = await provider.generate(prompt, "Analista competitivo experto. Solo JSON.", { maxTokens: 8192 });
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data: data.competitors as Competitor[] };
  } catch (err) {
    return { success: false, error: `Investigacion fallo: ${(err as Error).message}` };
  }
}

export async function researchKeywords(
  companyName: string,
  industry: string,
  services: string[],
  location: string
): Promise<ToolResult> {
  const provider = getResearchProvider();

  let keywordContext = "";
  try {
    const results = await searchGoogle(`${industry} ${location} keywords SEO tendencias 2025 2026`, 5);
    if (results.length > 0) {
      keywordContext = `\nResultados web sobre keywords:\n${results.map((r) => `- ${r.title}: ${r.snippet}`).join("\n")}`;
    }
  } catch {}

  const prompt = `Investigacion de keywords para "${companyName}" - ${industry} en ${location}.
Servicios: ${services.join(", ")}
${keywordContext}

5 categorias: Transaccional, Geograficas Urbanas, Geograficas Costeras/Rurales, Tipologia/Conquista, Informacional.
AL MENOS 8 keywords por categoria.

Retorna SOLO JSON:
{
  "keywordGroups": [
    { "category": "nombre", "keywords": [{ "term": "keyword", "intent": "tipo", "volume": "nivel", "difficulty": "nivel" }] }
  ]
}`;

  try {
    const response = await provider.generate(prompt, "Especialista SEO. Solo JSON.", { maxTokens: 8192 });
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data: data.keywordGroups as KeywordGroup[] };
  } catch (err) {
    return { success: false, error: `Keywords fallo: ${(err as Error).message}` };
  }
}

export async function researchMarketTrends(industry: string, location: string): Promise<ToolResult> {
  const provider = getResearchProvider();

  let trendContext = "";
  try {
    const results = await searchGoogle(`${industry} ${location} tendencias 2025 2026`, 5);
    if (results.length > 0) {
      trendContext = `\nTendencias reales:\n${results.map((r) => `- ${r.title}: ${r.snippet}`).join("\n")}`;
    }
  } catch {}

  const prompt = `Tendencias del mercado de ${industry} en ${location}.${trendContext}
Retorna JSON: { "trends": [{"category":"","trend":"","impact":"","timeframe":""}], "opportunities": [], "threats": [] }`;

  try {
    const response = await provider.generate(prompt, "Analista de mercado. Solo JSON.", { maxTokens: 4096 });
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: `Tendencias fallo: ${(err as Error).message}` };
  }
}
