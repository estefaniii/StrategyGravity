import * as cheerio from "cheerio";
import { generate } from "../llm/index.js";
import type { BrandIdentity, ToolResult } from "../types/index.js";
import { askUser } from "../core/chat.js";

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StrategyGravity/1.0; marketing-research)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
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

export async function extractBrandFromUrl(url: string): Promise<ToolResult> {
  try {
    console.log(`\n  Fetching ${url}...`);
    const html = await fetchPage(url);
    const meta = extractMetadata(html, url);

    const prompt = `Analyze this website and extract the brand identity. Return ONLY valid JSON.

Website URL: ${url}
Title: ${meta.title}
Description: ${meta.description}
OG Title: ${meta.ogTitle}
OG Description: ${meta.ogDescription}
Body text excerpt: ${meta.bodyText.slice(0, 2000)}
CSS/Style excerpt: ${meta.styleContent.slice(0, 1000)}
Logos found: ${meta.logos.join(", ")}

Extract and return this JSON structure:
{
  "companyName": "extracted company name",
  "industry": "industry/sector",
  "description": "what the company does in 2-3 sentences",
  "colors": {
    "primary": "#hex or 'unknown'",
    "secondary": "#hex or 'unknown'",
    "accent": "#hex or 'unknown'"
  },
  "fonts": {
    "heading": "font name or 'unknown'",
    "body": "font name or 'unknown'"
  },
  "logo": "logo URL if found",
  "website": "${url}",
  "confidence": "high/medium/low"
}`;

    const response = await generate(prompt, "You are a brand identity analyst. Extract visual identity data from websites. Return ONLY valid JSON, no markdown.");

    let brandData: Record<string, unknown>;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      brandData = JSON.parse(jsonMatch?.[0] ?? response.text);
    } catch {
      return { success: false, error: "Failed to parse brand identity from AI response" };
    }

    const confidence = brandData.confidence as string;
    const identity: BrandIdentity = {
      companyName: (brandData.companyName as string) || "Unknown",
      industry: (brandData.industry as string) || "Unknown",
      description: (brandData.description as string) || "",
      colors: (brandData.colors as BrandIdentity["colors"]) || { primary: "unknown", secondary: "unknown", accent: "unknown" },
      fonts: (brandData.fonts as BrandIdentity["fonts"]) || { heading: "unknown", body: "unknown" },
      logo: brandData.logo as string | undefined,
      website: url,
      confirmed: false,
    };

    // If confidence is low, ask user
    if (confidence === "low" || identity.colors.primary === "unknown") {
      console.log("\n  No pude determinar con precision la identidad visual.");
      console.log(`  Empresa detectada: ${identity.companyName}`);
      console.log(`  Colores: ${JSON.stringify(identity.colors)}`);
      console.log(`  Tipografias: ${JSON.stringify(identity.fonts)}`);

      const userConfirm = await askUser(
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
    return { success: false, error: `Brand extraction failed: ${(err as Error).message}` };
  }
}

export async function extractBrandFromInstagram(handle: string): Promise<ToolResult> {
  const cleanHandle = handle.replace("@", "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");

  const prompt = `I need to analyze the Instagram brand "@${cleanHandle}" for a marketing strategy.
Based on your knowledge of this Instagram account (or educated inference if you're not sure), provide a brand analysis.

Return ONLY valid JSON:
{
  "companyName": "name",
  "industry": "industry",
  "description": "what they do",
  "colors": { "primary": "#hex or 'unknown'", "secondary": "#hex or 'unknown'", "accent": "#hex or 'unknown'" },
  "fonts": { "heading": "font or 'unknown'", "body": "font or 'unknown'" },
  "instagram": "@${cleanHandle}",
  "confidence": "high/medium/low"
}`;

  try {
    const response = await generate(prompt, "You are a social media brand analyst. Return ONLY valid JSON.");

    let brandData: Record<string, unknown>;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      brandData = JSON.parse(jsonMatch?.[0] ?? response.text);
    } catch {
      return { success: false, error: "Failed to parse brand data" };
    }

    const identity: BrandIdentity = {
      companyName: (brandData.companyName as string) || cleanHandle,
      industry: (brandData.industry as string) || "Unknown",
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
    const userConfirm = await askUser(
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
    return { success: false, error: `Instagram analysis failed: ${(err as Error).message}` };
  }
}

export async function extractBrandFromDescription(description: string): Promise<ToolResult> {
  const prompt = `Based on this business description, create a brand identity profile.

Description: ${description}

Return ONLY valid JSON:
{
  "companyName": "name from description",
  "industry": "industry",
  "description": "refined description",
  "colors": { "primary": "#hex suggestion", "secondary": "#hex suggestion", "accent": "#hex suggestion" },
  "fonts": { "heading": "suggested font", "body": "suggested font" },
  "confidence": "medium"
}`;

  try {
    const response = await generate(prompt, "You are a brand strategist. Suggest brand identity elements based on business descriptions. Return ONLY valid JSON.");

    let brandData: Record<string, unknown>;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      brandData = JSON.parse(jsonMatch?.[0] ?? response.text);
    } catch {
      return { success: false, error: "Failed to parse brand data" };
    }

    const identity: BrandIdentity = {
      companyName: (brandData.companyName as string) || "Unknown",
      industry: (brandData.industry as string) || "Unknown",
      description: (brandData.description as string) || description,
      colors: (brandData.colors as BrandIdentity["colors"]) || { primary: "#1a1a1a", secondary: "#4a90d9", accent: "#f5a623" },
      fonts: (brandData.fonts as BrandIdentity["fonts"]) || { heading: "Montserrat", body: "Open Sans" },
      confirmed: false,
    };

    console.log(`\n  Marca sugerida: ${identity.companyName}`);
    console.log(`  Colores sugeridos: ${JSON.stringify(identity.colors)}`);
    console.log(`  Tipografias sugeridas: ${JSON.stringify(identity.fonts)}`);
    const userConfirm = await askUser("Confirma estos datos de marca o corrigelos (escribe 'ok' o los datos correctos):");

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
    return { success: false, error: `Description analysis failed: ${(err as Error).message}` };
  }
}
