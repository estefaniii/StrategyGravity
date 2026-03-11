import * as cheerio from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { fetchPage, delay } from "./http-utils.js";
import type { WebSearchResult } from "../types/index.js";

// ─── Approach A: Gemini with Google Search grounding ───

async function searchWithGemini(query: string, count: number): Promise<WebSearchResult[]> {
  if (!env.GEMINI_API_KEY) throw new Error("No Gemini API key");

  const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [{ googleSearch: {} } as any],
  });

  const result = await model.generateContent(
    `Busca en Google: "${query}". Lista los ${count} primeros resultados con titulo, URL exacta y descripcion breve. Retorna SOLO JSON valido:
[{"title": "titulo", "url": "https://...", "snippet": "descripcion", "position": 1}]`
  );

  const text = result.response.text();

  // Try to extract grounding metadata
  const candidate = result.response.candidates?.[0];
  const grounding = (candidate as any)?.groundingMetadata;

  if (grounding?.groundingChunks?.length) {
    return grounding.groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .slice(0, count)
      .map((chunk: any, i: number) => ({
        title: chunk.web.title || "",
        url: chunk.web.uri,
        snippet: "",
        position: i + 1,
      }));
  }

  // Fallback: parse from text response
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as WebSearchResult[];
      return parsed.slice(0, count);
    }
  } catch {}

  return [];
}

// ─── Approach B: Direct Google scraping ───

async function searchWithScraping(query: string, count: number): Promise<WebSearchResult[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${count + 5}&hl=es`;

  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  // Parse Google search results
  $("div.g").each((i, el) => {
    if (results.length >= count) return;

    const titleEl = $(el).find("h3").first();
    const linkEl = $(el).find("a").first();
    const snippetEl = $(el).find("div[data-sncf]").first().length
      ? $(el).find("div[data-sncf]").first()
      : $(el).find(".VwiC3b").first();

    const title = titleEl.text().trim();
    const href = linkEl.attr("href") || "";
    const snippet = snippetEl.text().trim();

    if (title && href.startsWith("http") && !href.includes("google.com")) {
      results.push({ title, url: href, snippet, position: results.length + 1 });
    }
  });

  // Alternative selectors if the above fails
  if (results.length === 0) {
    $("a[href^='http']").each((i, el) => {
      if (results.length >= count) return;
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (text.length > 10 && !href.includes("google.com") && !href.includes("youtube.com/results")) {
        results.push({ title: text.slice(0, 100), url: href, snippet: "", position: results.length + 1 });
      }
    });
  }

  return results;
}

// ─── Main export: tries Gemini first, falls back to scraping ───

export async function searchGoogle(query: string, count = 10): Promise<WebSearchResult[]> {
  console.log(`  [Search] Buscando: "${query.slice(0, 80)}..."`);

  // Try Gemini grounded search first
  try {
    const results = await searchWithGemini(query, count);
    if (results.length >= 3) {
      console.log(`  [Search] ${results.length} resultados via Gemini`);
      return results;
    }
  } catch (err) {
    console.log(`  [Search] Gemini search fallback: ${(err as Error).message?.slice(0, 50)}`);
  }

  // Fallback to direct scraping
  try {
    await delay(1000); // Rate limit
    const results = await searchWithScraping(query, count);
    if (results.length > 0) {
      console.log(`  [Search] ${results.length} resultados via scraping`);
      return results;
    }
  } catch (err) {
    console.log(`  [Search] Scraping fallback failed: ${(err as Error).message?.slice(0, 50)}`);
  }

  console.log("  [Search] No se encontraron resultados");
  return [];
}

export function deduplicateUrls(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    try {
      const domain = new URL(r.url).hostname.replace("www.", "");
      if (seen.has(domain)) return false;
      seen.add(domain);
      return true;
    } catch {
      return false;
    }
  });
}
