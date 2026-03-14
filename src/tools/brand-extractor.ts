import * as cheerio from "cheerio";
import { generate } from "../llm/index.js";
import type { BrandIdentity, ToolResult } from "../types/index.js";
import { fetchWithRetry } from "./http-utils.js";
import { searchGoogle } from "./web-search.js";
import { scrapeCompetitorWebsite } from "./web-scraper.js";

// Auto-confirm flag for web mode (no terminal available)
let autoConfirm = false;
export function setAutoConfirm(value: boolean) { autoConfirm = value; }

/**
 * Robust JSON parser with multiple fallback strategies.
 * Same approach as generator.ts parseJSON, adapted for brand extraction.
 */
function parseJSONRobust<T>(text: string): T {
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*$/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");

  const attempts: Array<() => T> = [
    () => JSON.parse(match[0]) as T,
    () => {
      const fixed = match[0].replace(/,\s*([}\]])/g, "$1").replace(/[\r\n]+/g, " ").replace(/\t/g, " ");
      return JSON.parse(fixed) as T;
    },
    () => {
      let fixed = match[0].replace(/,\s*([}\]])/g, "$1").replace(/[\r\n]+/g, " ").replace(/\t/g, " ");
      fixed = fixed.replace(/[\x00-\x1F]/g, " ");
      return JSON.parse(fixed) as T;
    },
    () => {
      const fixed = match[0].replace(/,\s*([}\]])/g, "$1").replace(/[\r\n]+/g, " ").replace(/\t/g, " ").replace(/[\x00-\x1F]/g, " ");
      const lastBrace = fixed.lastIndexOf("}");
      if (lastBrace <= 0) throw new Error("no brace");
      return JSON.parse(fixed.slice(0, lastBrace + 1)) as T;
    },
    () => {
      let fixed = match[0].replace(/[\r\n\t\x00-\x1F]/g, " ").replace(/,\s*([}\]])/g, "$1");
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

/**
 * Generate a default brand identity from a URL when all LLM parsing fails.
 * This ensures the strategy generation can continue with reasonable defaults.
 */
function defaultBrandFromUrl(url: string): BrandIdentity {
  let domain = "empresa";
  try {
    domain = new URL(url).hostname.replace("www.", "");
  } catch {}
  const companyGuess = domain.replace(/\.(com|net|org|io|co|us|mx|es|ar).*$/i, "").replace(/[-_]/g, " ");
  const capitalized = companyGuess.charAt(0).toUpperCase() + companyGuess.slice(1);

  return {
    companyName: capitalized,
    industry: "Desconocido",
    description: `Empresa con presencia web en ${domain}`,
    colors: { primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560" },
    fonts: { heading: "Montserrat", body: "Open Sans" },
    website: url,
    confirmed: false,
  };
}

async function askUserOrAutoConfirm(prompt: string): Promise<string> {
  if (autoConfirm) {
    console.log(`  [Auto-confirm] ${prompt.slice(0, 60)}...`);
    return "ok";
  }
  const { askUser } = await import("../core/chat.js");
  return askUser(prompt);
}

async function fetchPage(url: string): Promise<string> {
  return fetchWithRetry(url);
}

function extractMetadata(html: string, url: string) {
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content") || "";
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogDescription = $('meta[property="og:description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";

  // Extract visible text content (limited)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);

  // Try to find colors in inline styles and CSS
  const styleContent = $("style").text() + " " + $('[style]').map((_, el) => $(el).attr("style")).get().join(" ");

  // Find logos
  const logos: string[] = [];
  $('img[src*="logo"], img[alt*="logo"], img[class*="logo"], link[rel="icon"]').each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("href") || "";
    if (src) logos.push(src.startsWith("http") ? src : new URL(src, url).href);
  });

  return { title, description, ogTitle, ogDescription, ogImage, bodyText, styleContent, logos };
}

// ─── Fallback: Use web search + scraper when direct fetch fails (403, etc.) ───
async function extractBrandViaWebSearch(url: string): Promise<ToolResult> {
  console.log(`  [Brand] Fetch directo fallo, usando busqueda web como respaldo para ${url}...`);

  const domain = new URL(url).hostname.replace("www.", "");
  const companyGuess = domain.replace(/\.(com|net|org|io|co|us|mx|es|ar).*$/i, "").replace(/[-_]/g, " ");

  // Search for info about this company
  let searchContext = "";
  try {
    const results = await searchGoogle(`"${domain}" company services about`, 5);
    if (results.length > 0) {
      searchContext = results.map((r) => `- ${r.title}: ${r.snippet}`).join("\n");
      console.log(`  [Brand] Encontrados ${results.length} resultados web sobre ${domain}`);
    }
  } catch (err) {
    console.log(`  [Brand] Busqueda web fallo: ${(err as Error).message?.slice(0, 50)}`);
  }

  // Also try to scrape the site with our scraper (which may use different headers)
  let scraperContext = "";
  try {
    const scraped = await scrapeCompetitorWebsite(url);
    if (scraped.title || scraped.description) {
      scraperContext = `
Titulo del sitio: ${scraped.title}
Descripcion del sitio: ${scraped.description}
Servicios detectados: ${scraped.services.join(", ") || "ninguno"}
Texto del sitio: ${scraped.bodyText.slice(0, 2000)}`;
      console.log(`  [Brand] Scraper extrajo datos de ${domain}`);
    }
  } catch {
    console.log(`  [Brand] Scraper tambien fallo, usando solo datos de busqueda web`);
  }

  const prompt = `Analiza esta empresa/sitio web y crea un perfil de identidad de marca.
Usa los resultados de busqueda web y cualquier dato extraido para determinar la identidad de marca.

URL del sitio web: ${url}
Dominio: ${domain}
${scraperContext ? `\nDATOS EXTRAIDOS:${scraperContext}` : ""}
${searchContext ? `\nRESULTADOS DE BUSQUEDA WEB:\n${searchContext}` : ""}

Basandote en TODA la informacion disponible, retorna SOLO JSON valido:
{
  "companyName": "nombre de la empresa (del dominio '${companyGuess}' o resultados de busqueda)",
  "industry": "industria/sector",
  "description": "que hace la empresa en 2-3 oraciones detalladas",
  "location": "ciudad, estado/pais si es determinable",
  "colors": {
    "primary": "#hex sugerido basado en la industria",
    "secondary": "#hex sugerido",
    "accent": "#hex sugerido"
  },
  "fonts": {
    "heading": "fuente profesional sugerida",
    "body": "fuente profesional sugerida"
  },
  "logo": "",
  "website": "${url}",
  "confidence": "medium"
}`;

  let identity: BrandIdentity;
  try {
    const response = await generate(
      prompt,
      "Eres un analista de identidad de marca. Cuando no puedas ver directamente un sitio, usa los datos disponibles (resultados de busqueda, nombre de dominio, fragmentos extraidos) para inferir la identidad de marca. Retorna SOLO JSON valido, sin markdown."
    );

    let brandData: Record<string, unknown>;
    try {
      brandData = parseJSONRobust<Record<string, unknown>>(response.text);
    } catch {
      console.log(`  [Brand] JSON parse fallo, reintentando con prompt de correccion...`);
      // Retry with correction prompt
      try {
        const retryResponse = await generate(
          `Tu respuesta anterior NO fue JSON valido. Retorna SOLO un objeto JSON puro (sin backticks, sin markdown) con estos campos: companyName, industry, description, location, colors (primary, secondary, accent), fonts (heading, body), website. Basado en: dominio=${domain}, busqueda web disponible.`,
          "Retorna SOLO JSON valido, sin texto adicional."
        );
        brandData = parseJSONRobust<Record<string, unknown>>(retryResponse.text);
      } catch {
        console.log(`  [Brand] Segundo intento fallo, usando valores por defecto del dominio`);
        identity = defaultBrandFromUrl(url);
        identity.companyName = companyGuess.charAt(0).toUpperCase() + companyGuess.slice(1) || identity.companyName;
        return { success: true, data: identity };
      }
    }

    identity = {
      companyName: (brandData.companyName as string) || companyGuess,
      industry: (brandData.industry as string) || "Desconocido",
      description: (brandData.description as string) || "",
      colors: (brandData.colors as BrandIdentity["colors"]) || { primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560" },
      fonts: (brandData.fonts as BrandIdentity["fonts"]) || { heading: "Montserrat", body: "Open Sans" },
      logo: brandData.logo as string | undefined,
      website: url,
      location: (brandData.location as string) || undefined,
      confirmed: false,
    };
  } catch (llmErr) {
    // LLM completely failed (all providers down) — use default brand
    console.log(`  [Brand] LLM fallo completamente: ${(llmErr as Error).message?.slice(0, 60)}, usando valores por defecto`);
    identity = defaultBrandFromUrl(url);
    identity.companyName = companyGuess.charAt(0).toUpperCase() + companyGuess.slice(1) || identity.companyName;
  }

  console.log(`  [Brand] Detected via web search: ${identity.companyName} (${identity.industry})`);
  console.log(`  [Brand] Location: ${identity.location || "unknown"}`);

  // Auto-confirm or ask user
  const userConfirm = await askUserOrAutoConfirm(
    `Marca detectada via busqueda web: ${identity.companyName} (${identity.industry}).\n` +
    "Confirma estos datos o corrigelos (escribe 'ok' o los datos correctos):"
  );

  if (userConfirm.toLowerCase() !== "ok") {
    const nameMatch = userConfirm.match(/nombre:\s*([^|]+)/i);
    const colorMatch = userConfirm.match(/colores?:\s*([^|]+)/i);
    const fontMatch = userConfirm.match(/fuentes?:\s*(.+)/i);
    if (nameMatch) identity.companyName = nameMatch[1].trim();
    if (colorMatch) {
      const colors = colorMatch[1].split(",").map((c) => c.trim());
      if (colors[0]) identity.colors.primary = colors[0];
      if (colors[1]) identity.colors.secondary = colors[1];
      if (colors[2]) identity.colors.accent = colors[2];
    }
    if (fontMatch) {
      const fonts = fontMatch[1].split(",").map((f) => f.trim());
      if (fonts[0]) identity.fonts.heading = fonts[0];
      if (fonts[1]) identity.fonts.body = fonts[1];
    }
  }
  identity.confirmed = true;

  return { success: true, data: identity };
}

export async function extractBrandFromUrl(url: string): Promise<ToolResult> {
  // First try direct HTML fetch
  try {
    console.log(`\n  Fetching ${url}...`);
    const html = await fetchPage(url);
    const meta = extractMetadata(html, url);

    const prompt = `Analiza este sitio web y extrae la identidad de marca. Retorna SOLO JSON valido.

URL del sitio web: ${url}
Titulo: ${meta.title}
Descripcion: ${meta.description}
OG Titulo: ${meta.ogTitle}
OG Descripcion: ${meta.ogDescription}
Extracto del texto del sitio: ${meta.bodyText.slice(0, 2000)}
Extracto CSS/Estilos: ${meta.styleContent.slice(0, 1000)}
Logos encontrados: ${meta.logos.join(", ")}

Extrae y retorna esta estructura JSON:
{
  "companyName": "nombre de la empresa extraido",
  "industry": "industria/sector",
  "description": "que hace la empresa en 2-3 oraciones",
  "location": "ciudad, estado/pais si se encuentra en el contenido del sitio",
  "colors": {
    "primary": "#hex o 'unknown'",
    "secondary": "#hex o 'unknown'",
    "accent": "#hex o 'unknown'"
  },
  "fonts": {
    "heading": "nombre de fuente o 'unknown'",
    "body": "nombre de fuente o 'unknown'"
  },
  "logo": "URL del logo si se encuentra",
  "website": "${url}",
  "confidence": "high/medium/low"
}`;

    const response = await generate(prompt, "Eres un analista de identidad de marca. Extrae datos de identidad visual de sitios web. Retorna SOLO JSON valido, sin markdown.");

    let brandData: Record<string, unknown>;
    try {
      brandData = parseJSONRobust<Record<string, unknown>>(response.text);
    } catch {
      console.log(`  [Brand] JSON parse fallo en fetch directo, reintentando...`);
      try {
        const retryResponse = await generate(
          `Tu respuesta anterior NO fue JSON valido. Retorna SOLO un objeto JSON puro (sin backticks, sin markdown) con: companyName, industry, description, location, colors (primary, secondary, accent), fonts (heading, body), website="${url}".`,
          "Retorna SOLO JSON valido, sin texto adicional."
        );
        brandData = parseJSONRobust<Record<string, unknown>>(retryResponse.text);
      } catch {
        console.log(`  [Brand] Segundo intento fallo, usando valores por defecto`);
        return { success: true, data: defaultBrandFromUrl(url) };
      }
    }

    const confidence = brandData.confidence as string;
    const identity: BrandIdentity = {
      companyName: (brandData.companyName as string) || "Desconocido",
      industry: (brandData.industry as string) || "Desconocido",
      description: (brandData.description as string) || "",
      colors: (brandData.colors as BrandIdentity["colors"]) || { primary: "unknown", secondary: "unknown", accent: "unknown" },
      fonts: (brandData.fonts as BrandIdentity["fonts"]) || { heading: "unknown", body: "unknown" },
      logo: brandData.logo as string | undefined,
      website: url,
      location: (brandData.location as string) || undefined,
      confirmed: false,
    };

    // If confidence is low, ask user
    if (confidence === "low" || identity.colors.primary === "unknown") {
      console.log("\n  No pude determinar con precision la identidad visual.");
      console.log(`  Empresa detectada: ${identity.companyName}`);
      console.log(`  Colores: ${JSON.stringify(identity.colors)}`);
      console.log(`  Tipografias: ${JSON.stringify(identity.fonts)}`);

      const userConfirm = await askUserOrAutoConfirm(
        "Necesito que confirmes o corrijas estos datos de identidad visual.\n" +
        "Escribe 'ok' para confirmar, o proporciona los datos correctos (ej: 'colores: #1a1a1a, #ff5500, #ffffff | fuentes: Montserrat, Open Sans'):"
      );

      if (userConfirm.toLowerCase() !== "ok") {
        // Parse user corrections
        const colorMatch = userConfirm.match(/colores?:\s*([^|]+)/i);
        const fontMatch = userConfirm.match(/fuentes?:\s*(.+)/i);
        if (colorMatch) {
          const colors = colorMatch[1].split(",").map((c) => c.trim());
          if (colors[0]) identity.colors.primary = colors[0];
          if (colors[1]) identity.colors.secondary = colors[1];
          if (colors[2]) identity.colors.accent = colors[2];
        }
        if (fontMatch) {
          const fonts = fontMatch[1].split(",").map((f) => f.trim());
          if (fonts[0]) identity.fonts.heading = fonts[0];
          if (fonts[1]) identity.fonts.body = fonts[1];
        }
      }
      identity.confirmed = true;
    }

    return { success: true, data: identity };
  } catch (err) {
    // ─── FALLBACK: If direct fetch fails (403, timeout, etc.), use web search ───
    console.log(`  [Brand] Direct fetch error: ${(err as Error).message?.slice(0, 60)}`);
    try {
      return await extractBrandViaWebSearch(url);
    } catch (fallbackErr) {
      // Last resort: return default brand identity so strategy generation can continue
      console.log(`  [Brand] Todas las estrategias fallaron, usando valores por defecto del dominio`);
      return { success: true, data: defaultBrandFromUrl(url) };
    }
  }
}

export async function extractBrandFromInstagram(handle: string): Promise<ToolResult> {
  const cleanHandle = handle.replace("@", "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");

  const prompt = `Necesito analizar la marca de Instagram "@${cleanHandle}" para una estrategia de marketing.
Basandote en tu conocimiento de esta cuenta de Instagram (o inferencia educada si no estas seguro), proporciona un analisis de marca.

Retorna SOLO JSON valido:
{
  "companyName": "nombre",
  "industry": "industria",
  "description": "que hacen",
  "colors": { "primary": "#hex o 'unknown'", "secondary": "#hex o 'unknown'", "accent": "#hex o 'unknown'" },
  "fonts": { "heading": "fuente o 'unknown'", "body": "fuente o 'unknown'" },
  "instagram": "@${cleanHandle}",
  "confidence": "high/medium/low"
}`;

  try {
    const response = await generate(prompt, "Eres un analista de marcas en redes sociales. Retorna SOLO JSON valido.");

    let brandData: Record<string, unknown>;
    try {
      brandData = parseJSONRobust<Record<string, unknown>>(response.text);
    } catch {
      console.log(`  [Brand] JSON parse fallo para Instagram, reintentando...`);
      try {
        const retryResponse = await generate(
          `Tu respuesta anterior NO fue JSON valido. Retorna SOLO un objeto JSON puro con: companyName, industry, description, colors (primary, secondary, accent), fonts (heading, body). Para la cuenta @${cleanHandle}.`,
          "Retorna SOLO JSON valido, sin texto adicional."
        );
        brandData = parseJSONRobust<Record<string, unknown>>(retryResponse.text);
      } catch {
        console.log(`  [Brand] Segundo intento fallo para Instagram, usando defaults`);
        return { success: true, data: {
          companyName: cleanHandle,
          industry: "Desconocido",
          description: `Cuenta de Instagram @${cleanHandle}`,
          colors: { primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560" },
          fonts: { heading: "Montserrat", body: "Open Sans" },
          instagram: `@${cleanHandle}`,
          confirmed: false,
        } as BrandIdentity };
      }
    }

    const identity: BrandIdentity = {
      companyName: (brandData.companyName as string) || cleanHandle,
      industry: (brandData.industry as string) || "Desconocido",
      description: (brandData.description as string) || "",
      colors: (brandData.colors as BrandIdentity["colors"]) || { primary: "unknown", secondary: "unknown", accent: "unknown" },
      fonts: (brandData.fonts as BrandIdentity["fonts"]) || { heading: "unknown", body: "unknown" },
      instagram: `@${cleanHandle}`,
      confirmed: false,
    };

    // Always ask user to confirm for Instagram since we can't scrape directly
    console.log(`\n  Marca detectada: ${identity.companyName}`);
    console.log(`  Industria: ${identity.industry}`);
    console.log(`  Colores: ${JSON.stringify(identity.colors)}`);
    const userConfirm = await askUserOrAutoConfirm(
      "No puedo acceder directamente a Instagram. Confirma estos datos o corrigelos.\n" +
      "Escribe 'ok' para confirmar, o proporciona los datos correctos:"
    );

    if (userConfirm.toLowerCase() !== "ok") {
      const colorMatch = userConfirm.match(/colores?:\s*([^|]+)/i);
      const fontMatch = userConfirm.match(/fuentes?:\s*(.+)/i);
      if (colorMatch) {
        const colors = colorMatch[1].split(",").map((c) => c.trim());
        if (colors[0]) identity.colors.primary = colors[0];
        if (colors[1]) identity.colors.secondary = colors[1];
        if (colors[2]) identity.colors.accent = colors[2];
      }
      if (fontMatch) {
        const fonts = fontMatch[1].split(",").map((f) => f.trim());
        if (fonts[0]) identity.fonts.heading = fonts[0];
        if (fonts[1]) identity.fonts.body = fonts[1];
      }
    }
    identity.confirmed = true;

    return { success: true, data: identity };
  } catch (err) {
    return { success: false, error: `Analisis de Instagram fallo: ${(err as Error).message}` };
  }
}

export async function extractBrandFromDescription(description: string): Promise<ToolResult> {
  const prompt = `Basandote en esta descripcion del negocio, crea un perfil de identidad de marca.

Descripcion: ${description}

Retorna SOLO JSON valido:
{
  "companyName": "nombre de la descripcion",
  "industry": "industria",
  "description": "descripcion refinada",
  "colors": { "primary": "#hex sugerido", "secondary": "#hex sugerido", "accent": "#hex sugerido" },
  "fonts": { "heading": "fuente sugerida", "body": "fuente sugerida" },
  "confidence": "medium"
}`;

  try {
    const response = await generate(prompt, "Eres un estratega de marca. Sugiere elementos de identidad de marca basados en descripciones de negocios. Retorna SOLO JSON valido.");

    let brandData: Record<string, unknown>;
    try {
      brandData = parseJSONRobust<Record<string, unknown>>(response.text);
    } catch {
      console.log(`  [Brand] JSON parse fallo para descripcion, reintentando...`);
      try {
        const retryResponse = await generate(
          `Tu respuesta anterior NO fue JSON valido. Retorna SOLO un objeto JSON puro con: companyName, industry, description, colors (primary, secondary, accent), fonts (heading, body). Basado en: "${description.slice(0, 200)}".`,
          "Retorna SOLO JSON valido, sin texto adicional."
        );
        brandData = parseJSONRobust<Record<string, unknown>>(retryResponse.text);
      } catch {
        console.log(`  [Brand] Segundo intento fallo para descripcion, usando defaults`);
        return { success: true, data: {
          companyName: "Empresa",
          industry: "Desconocido",
          description: description.slice(0, 500),
          colors: { primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560" },
          fonts: { heading: "Montserrat", body: "Open Sans" },
          confirmed: false,
        } as BrandIdentity };
      }
    }

    const identity: BrandIdentity = {
      companyName: (brandData.companyName as string) || "Desconocido",
      industry: (brandData.industry as string) || "Desconocido",
      description: (brandData.description as string) || description,
      colors: (brandData.colors as BrandIdentity["colors"]) || { primary: "#1a1a1a", secondary: "#4a90d9", accent: "#f5a623" },
      fonts: (brandData.fonts as BrandIdentity["fonts"]) || { heading: "Montserrat", body: "Open Sans" },
      confirmed: false,
    };

    console.log(`\n  Marca sugerida: ${identity.companyName}`);
    console.log(`  Colores sugeridos: ${JSON.stringify(identity.colors)}`);
    console.log(`  Tipografias sugeridas: ${JSON.stringify(identity.fonts)}`);
    const userConfirm = await askUserOrAutoConfirm("Confirma estos datos de marca o corrigelos (escribe 'ok' o los datos correctos):");

    if (userConfirm.toLowerCase() !== "ok") {
      const nameMatch = userConfirm.match(/nombre:\s*([^|]+)/i);
      const colorMatch = userConfirm.match(/colores?:\s*([^|]+)/i);
      const fontMatch = userConfirm.match(/fuentes?:\s*(.+)/i);
      if (nameMatch) identity.companyName = nameMatch[1].trim();
      if (colorMatch) {
        const colors = colorMatch[1].split(",").map((c) => c.trim());
        if (colors[0]) identity.colors.primary = colors[0];
        if (colors[1]) identity.colors.secondary = colors[1];
        if (colors[2]) identity.colors.accent = colors[2];
      }
      if (fontMatch) {
        const fonts = fontMatch[1].split(",").map((f) => f.trim());
        if (fonts[0]) identity.fonts.heading = fonts[0];
        if (fonts[1]) identity.fonts.body = fonts[1];
      }
    }
    identity.confirmed = true;

    return { success: true, data: identity };
  } catch (err) {
    return { success: false, error: `Analisis de descripcion fallo: ${(err as Error).message}` };
  }
}
