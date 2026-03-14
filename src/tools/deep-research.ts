import { getResearchProvider } from "../llm/index.js";
import { searchGoogle, deduplicateUrls } from "./web-search.js";
import { scrapeCompetitorWebsite } from "./web-scraper.js";
import { delay, verifyUrl, verifyUrls } from "./http-utils.js";
import type { ToolResult, Competitor, KeywordGroup, ScrapedCompetitorData } from "../types/index.js";

/**
 * Verify competitor URLs via HTTP HEAD requests.
 * For unverified URLs, try domain variations. Mark each competitor as verified or not.
 */
async function verifyCompetitorUrls(competitors: Competitor[]): Promise<Competitor[]> {
  if (competitors.length === 0) return competitors;

  const urls = competitors.map((c) => c.website).filter(Boolean);
  if (urls.length === 0) return competitors;

  console.log(`  [Research] Verificando ${urls.length} URLs de competidores...`);
  const verification = await verifyUrls(urls, 5000);

  const result: Competitor[] = [];
  for (const comp of competitors) {
    const isVerified = verification.get(comp.website);
    if (isVerified) {
      result.push({ ...comp, urlVerified: true });
      continue;
    }

    // Try domain variations from company name
    const slug = comp.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 30);

    const candidates = [
      `https://www.${slug}.com`,
      `https://${slug}.com`,
      `https://www.${slug}.com.pa`,
      `https://www.${slug}.co`,
    ];

    let correctedUrl: string | null = null;
    for (const candidate of candidates) {
      if (await verifyUrl(candidate, 3000)) {
        correctedUrl = candidate;
        break;
      }
    }

    if (correctedUrl) {
      console.log(`  [Research] URL corregida: ${comp.website} -> ${correctedUrl}`);
      result.push({ ...comp, website: correctedUrl, urlVerified: true });
    } else {
      console.log(`  [Research] URL no verificada: ${comp.website} (${comp.name})`);
      result.push({ ...comp, urlVerified: false });
    }
  }

  const verifiedCount = result.filter((c) => c.urlVerified).length;
  console.log(`  [Research] ${verifiedCount}/${result.length} URLs verificadas`);
  return result;
}

export async function researchCompetitors(
  companyName: string,
  industry: string,
  location: string
): Promise<ToolResult> {
  const provider = getResearchProvider();

  try {
    // Step 1: Search Google for real competitors
    console.log(`  [Research] Buscando competidores reales de "${companyName}" en ${industry}...`);

    // Generate natural search queries — how a REAL USER would search Google
    // Key insight: industry might be adjective ("Inmobiliario") so we need noun variants too
    const isRealLocation = location && !/mercado objetivo|no determinable|desconocid|unknown|n\/a/i.test(location);
    const queries: string[] = [];

    // Create plural/noun variants of industry (e.g., "Inmobiliario" → "inmobiliarias")
    const industryLower = industry.toLowerCase().trim();
    const industryVariants: string[] = [industry];

    // Generate natural plural/noun forms for common industry patterns
    if (industryLower.endsWith("io") || industryLower.endsWith("ia")) {
      // "Inmobiliario" → "inmobiliarias", "Tecnología" → stays
      const base = industryLower.replace(/i[oa]$/, "");
      industryVariants.push(`${base}ias`);    // inmobiliarias
      industryVariants.push(`${base}ios`);    // inmobiliarios
    }
    if (!industryLower.startsWith("empresa")) {
      industryVariants.push(`empresas de ${industryLower}`);   // "empresas de inmobiliario"
    }
    // Add "agencia(s) de" variant for service industries
    if (/marketing|publicidad|diseño|consultora|legal|viaje|turismo/i.test(industryLower)) {
      industryVariants.push(`agencias de ${industryLower}`);
    }

    if (isRealLocation) {
      // Extract country from location for broader search
      const locationParts = location.split(',').map(s => s.trim());
      const country = locationParts[locationParts.length - 1] || location;

      // Use multiple industry variants for richer results
      for (const variant of industryVariants.slice(0, 3)) {
        queries.push(`mejores ${variant} en ${location}`);
      }
      // Direct competitor search with company name context
      queries.push(`competidores de ${companyName} ${location}`);
      queries.push(`${companyName} alternativas ${location}`);
      // Natural "empresas de X" format
      queries.push(`empresas de ${industryLower} en ${location}`);
      // Broader country search if location has city+country
      if (country !== location) {
        queries.push(`mejores ${industry} en ${country}`);
      }
      // "Top" / ranking searches that list actual companies
      queries.push(`top ${industry} ${location} 2025 2026`);
    } else {
      queries.push(`mejores ${industry}`);
      queries.push(`empresas de ${industryLower}`);
      queries.push(`competidores de ${companyName}`);
    }

    // Deduplicate queries (case-insensitive) and limit to 6
    const seen = new Set<string>();
    const uniqueQueries = queries.filter(q => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);

    console.log(`  [Research] Queries: ${uniqueQueries.join(" | ")}`);

    const allResults = [];
    for (const query of uniqueQueries) {
      const results = await searchGoogle(query, 10);
      allResults.push(...results);
      console.log(`  [Research] "${query}" → ${results.length} resultados`);
      await delay(2500);  // Reduced from 4s — faster without hitting rate limits
    }

    // Filter out the company itself, social media, and non-business URLs
    const excludePatterns = [
      companyName.toLowerCase(),
      "wikipedia", "youtube", "facebook", "instagram", "twitter",
      "linkedin", "yelp", "tripadvisor", "google.com", "tiktok",
    ];

    // Filter out aggregator/listicle sites that are NOT real competitors
    const aggregatorPatterns = [
      "top-", "top 10", "top 5", "top 20", "mejores-", "mejores ",
      "ranking", "listado", "directorio", "comparar", "comparativa",
      "/blog/", "/articulo/", "/post/", "/article/",
      "nichoseo", "sortlist", "goodfirms", "clutch.co", "g2.com",
      "capterra", "trustpilot", "glassdoor", "indeed",
      "hubspot.com/blog", "semrush.com/blog", "ahrefs.com/blog",
    ];

    const filtered = allResults.filter((r) => {
      const lower = (r.url + r.title).toLowerCase();
      // Exclude social/non-business
      if (excludePatterns.some((p) => lower.includes(p))) return false;
      // Exclude aggregators and listicles
      if (aggregatorPatterns.some((p) => lower.includes(p))) return false;
      return true;
    });

    // Score and sort: POSITION IS KING — top 5 Google results are what matters
    const scored = filtered.map((r) => {
      let score = 0;
      // Massive bonus for top Google positions (user wants top 5)
      if (r.position === 1) score += 20;
      else if (r.position === 2) score += 17;
      else if (r.position === 3) score += 15;
      else if (r.position === 4) score += 12;
      else if (r.position === 5) score += 10;
      else if (r.position <= 7) score += 5;
      else if (r.position <= 10) score += 2;
      try {
        const path = new URL(r.url).pathname;
        if (path === "/" || path === "") score += 3;             // Homepage = best
        else if (path.split("/").filter(Boolean).length <= 1) score += 2;  // Shallow path
        if (/servicio|about|nosotros|contacto|solutions|services/i.test(path)) score += 1;
        // Bonus if domain contains industry-related terms
        const domain = new URL(r.url).hostname.toLowerCase();
        if (domain.includes(industry.split(" ")[0].toLowerCase())) score += 1;
      } catch {}
      return { ...r, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const deduplicated = deduplicateUrls(scored);

    // Verify URLs look like real business websites (not 404 pages)
    const verified = [];
    for (const result of deduplicated) {
      try {
        const url = new URL(result.url);
        // Must have a real domain (not IP, not localhost)
        if (url.hostname.includes('.') && !url.hostname.startsWith('localhost')) {
          verified.push(result);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    const unique = verified.slice(0, 8); // Get extra candidates in case scraping fails for some

    if (unique.length === 0) {
      console.log("  [Research] No se encontraron competidores via web, usando LLM...");
      return await researchCompetitorsWithLLM(companyName, industry, location);
    }

    // Step 2: Scrape each competitor website (keep basic data if scraping fails)
    console.log(`  [Research] Analizando ${unique.length} sitios web de competidores...`);

    const scrapedData: ScrapedCompetitorData[] = [];
    for (const result of unique) {
      try {
        const data = await scrapeCompetitorWebsite(result.url);
        scrapedData.push(data);
        await delay(1000);
      } catch (err) {
        console.log(`  [Research] Error scraping ${result.url}: ${(err as Error).message?.slice(0, 50)}`);
        // Include basic data from search result so we don't lose this competitor
        scrapedData.push({
          url: result.url,
          title: result.title || new URL(result.url).hostname,
          description: result.snippet || "",
          services: [],
          socialLinks: [],
          bodyText: result.snippet || `Sitio web de ${result.title || "competidor"} en el sector de ${industry}.`,
        });
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

    const prompt = `Eres un analista de inteligencia competitiva de élite. Analiza estos datos REALES extraídos de sitios web de competidores de "${companyName}" en el sector de ${industry} en ${location}.

DATOS REALES EXTRAÍDOS DE SITIOS WEB:
${scrapedContext}

REQUISITOS CRÍTICOS:
- Debes retornar EXACTAMENTE 5 competidores en tu respuesta. Si hay más de 5 datos, selecciona los 5 MÁS RELEVANTES (competidores directos del mismo sector, NO directorios ni agregadores).
- Si hay menos de 5 datos de sitios web, COMPLEMENTA con tu conocimiento sobre competidores REALES y CONOCIDOS del sector ${industry} en ${location}. Estos deben ser empresas que un profesional de la industria reconocería de inmediato.
- Solo incluye competidores que operen EN EL MISMO PAÍS/REGIÓN que ${companyName} (${location})
- Deben ser empresas del MISMO SECTOR (${industry}) que compitan DIRECTAMENTE por el mismo tipo de cliente
- FILTRA AGRESIVAMENTE: Si algún resultado es un directorio, blog, medio de noticias, o empresa de otro sector, REEMPLÁZALO con un competidor real que sí conozcas del sector ${industry} en ${location}
- DEBILIDADES deben ser REALES y ESPECÍFICAS: analiza su sitio web, su tecnología, su contenido, su UX. ¿Su sitio es lento? ¿No tiene blog? ¿No aparece en redes sociales? ¿Diseño anticuado? ¿No tiene chat en vivo? ¿Precios no transparentes? Busca debilidades CONCRETAS basadas en los datos que ves.
- OPORTUNIDADES para ${companyName} deben ser ACCIONABLES: explica exactamente qué puede hacer ${companyName} para ganar a esos clientes

Para CADA uno de los 5 competidores, crea un análisis PROFUNDO y DETALLADO que incluya:
1. Nombre de la empresa y su descripción
2. Servicios principales detectados en su sitio web
3. FORTALEZAS (mínimo 3) con explicación detallada
4. DEBILIDADES (mínimo 3) con explicación detallada
5. OPORTUNIDADES para ${companyName}
6. Análisis SEO básico

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
    // Verify URLs from LLM analysis (they come from web search so most should resolve)
    const verifiedCompetitors = await verifyCompetitorUrls(data.competitors as Competitor[]);
    return { success: true, data: verifiedCompetitors };
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

  const prompt = `Realiza un análisis competitivo PROFUNDO para "${companyName}" en el sector de ${industry}, ubicada en ${location}.

REQUISITOS CRÍTICOS - LEE CON CUIDADO:
1. Identifica los 5 competidores principales REALES y CONOCIDOS que operan EN EL MISMO PAÍS (${location})
2. Deben ser empresas del MISMO SECTOR (${industry}) que compitan DIRECTAMENTE por el mismo cliente
3. Sus URLs deben ser REALES y FUNCIONALES - NO inventes URLs. Si no conoces la URL exacta, usa el formato de dominio más probable (empresa.com o empresa.com.PAIS)
4. Deben ser las empresas que REALMENTE aparecen en los primeros resultados de Google al buscar "mejores ${industry} en ${location}" o "empresas de ${industry} ${location}"
5. IMPORTANTE: Deben ser COMPETIDORES DIRECTOS - empresas que ofrecen los mismos servicios al mismo segmento objetivo. NO incluyas directorios, blogs, portales de noticias, ni empresas de otros sectores
6. NO incluyas empresas internacionales gigantes a menos que tengan operación LOCAL en ${location}
7. Piensa en las marcas que un profesional del sector ${industry} en ${location} reconocería INMEDIATAMENTE como competidores

Para cada competidor incluye:
- name: nombre REAL de la empresa
- website: URL REAL del sitio web (verifica que sea el dominio correcto)
- detailedAnalysis: análisis de 200+ palabras sobre qué hace, su posicionamiento y cómo compite
- services: lista de servicios principales
- strengths: MÍNIMO 3 fortalezas ESPECÍFICAS (no genéricas)
- weaknesses: MÍNIMO 3 debilidades REALES que representen oportunidades (debilidades en servicio al cliente, tecnología obsoleta, precios altos, falta de presencia digital, etc.)
- opportunitiesForUs: MÍNIMO 2 oportunidades CONCRETAS para ${companyName}

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
    const response = await provider.generate(prompt, "Analista competitivo experto. Solo JSON.", { maxTokens: 4096 });
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    // Handle different response shapes from various LLM providers
    const competitors = data.competitors || data.competidores || data.competitor_analysis || [];
    if (Array.isArray(competitors) && competitors.length > 0) {
      // Verify URLs — LLM-only path is most likely to hallucinate
      const verifiedCompetitors = await verifyCompetitorUrls(competitors as Competitor[]);
      return { success: true, data: verifiedCompetitors };
    }
    console.log(`  [Research] LLM retorno JSON pero sin competidores validos`);
    return { success: false, error: "LLM no genero competidores" };
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
    const response = await provider.generate(prompt, "Especialista SEO. Solo JSON.", { maxTokens: 4096 });
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
