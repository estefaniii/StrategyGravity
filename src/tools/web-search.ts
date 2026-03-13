import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { fetchPage, delay } from "./http-utils.js";
import type { WebSearchResult } from "../types/index.js";

// Track whether Claude API is usable for search (avoids repeated 400 errors)
let claudeSearchDisabled = false;

// ─── Approach A: Claude with web_search tool (most reliable) ───

async function searchWithClaude(query: string, count: number): Promise<WebSearchResult[]> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("No Anthropic API key");
  if (claudeSearchDisabled) throw new Error("Claude search disabled (no credits)");

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Retry loop for rate limits
  let response: Anthropic.Messages.Message;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Busca en internet: "${query}". Necesito los ${count} primeros resultados con sus URLs reales. Para cada resultado proporciona titulo, URL y un snippet breve. Responde SOLO con JSON valido en este formato:
[{"title": "titulo", "url": "https://...", "snippet": "descripcion breve", "position": 1}]`,
          },
        ],
        tools: [
          {
            type: "web_search_20250305" as any,
            name: "web_search",
            max_uses: 3,
          } as any,
        ],
      });
      break; // success
    } catch (err: any) {
      // If billing/credit error, disable Claude search for the rest of the session
      const msg = err?.message?.toLowerCase() || "";
      if (err?.status === 400 && (msg.includes("credit") || msg.includes("billing") || msg.includes("cred"))) {
        claudeSearchDisabled = true;
        throw err;
      }

      if ((err?.status === 429 || err?.message?.includes("rate_limit")) && attempt < 3) {
        const waitMs = 20000 * (attempt + 1);
        console.log(`  [Search] Rate limit, esperando ${Math.round(waitMs / 1000)}s...`);
        await delay(waitMs);
        continue;
      }
      throw err;
    }
  }
  if (!response!) throw new Error("Search failed after retries");

  // Extract text content from response
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const fullText = textBlocks.map((b) => b.text).join("\n");

  // Try to parse JSON from response
  try {
    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as WebSearchResult[];
      return parsed.slice(0, count).map((r, i) => ({ ...r, position: i + 1 }));
    }
  } catch {}

  // If no JSON, extract URLs from search results blocks
  const searchResults: WebSearchResult[] = [];
  for (const block of response.content) {
    if ((block as any).type === "web_search_tool_result") {
      const results = (block as any).content || [];
      for (const r of results) {
        if (r.type === "web_search_result" && r.url) {
          searchResults.push({
            title: r.title || "",
            url: r.url,
            snippet: r.snippet || "",
            position: searchResults.length + 1,
          });
        }
      }
    }
  }

  if (searchResults.length > 0) {
    return searchResults.slice(0, count);
  }

  // Last resort: extract URLs from text
  const urlRegex = /https?:\/\/[^\s"'<>\]]+/g;
  const urls = fullText.match(urlRegex) || [];
  return urls
    .filter((url) => !url.includes("google.com") && !url.includes("anthropic.com"))
    .slice(0, count)
    .map((url, i) => ({ title: "", url, snippet: "", position: i + 1 }));
}

// ─── Approach B: DuckDuckGo HTML scraping (no blocking like Google) ───

async function searchWithDuckDuckGo(query: string, count: number): Promise<WebSearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $(".result").each((_i, el) => {
    if (results.length >= count) return;

    const titleEl = $(el).find(".result__title a, .result__a").first();
    const snippetEl = $(el).find(".result__snippet").first();

    const title = titleEl.text().trim();
    let href = titleEl.attr("href") || "";

    // DuckDuckGo uses redirect URLs, extract actual URL
    if (href.includes("uddg=")) {
      try {
        const urlParam = new URL(href, "https://duckduckgo.com").searchParams.get("uddg");
        if (urlParam) href = urlParam;
      } catch {}
    }

    const snippet = snippetEl.text().trim();

    if (title && href.startsWith("http")) {
      results.push({ title, url: href, snippet, position: results.length + 1 });
    }
  });

  return results;
}

// ─── Approach C: Direct Google scraping (fallback, often blocked) ───

async function searchWithGoogleScraping(query: string, count: number): Promise<WebSearchResult[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${count + 5}&hl=es`;

  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $("div.g").each((_i, el) => {
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

  if (results.length === 0) {
    $("a[href^='http']").each((_i, el) => {
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

// ─── Main export: tries Claude → DuckDuckGo → Google scraping ───

export async function searchGoogle(query: string, count = 10): Promise<WebSearchResult[]> {
  console.log(`  [Search] Buscando: "${query.slice(0, 80)}..."`);

  // Try Claude web_search first (most reliable, if available)
  if (!claudeSearchDisabled) {
    try {
      const results = await searchWithClaude(query, count);
      if (results.length > 0) {
        console.log(`  [Search] ${results.length} resultados via Claude web_search`);
        return results;
      }
    } catch (err) {
      console.log(`  [Search] Claude web_search error: ${(err as Error).message?.slice(0, 80)}`);
    }
  }

  // Fallback to DuckDuckGo (more reliable than Google scraping)
  try {
    await delay(500);
    const results = await searchWithDuckDuckGo(query, count);
    if (results.length > 0) {
      console.log(`  [Search] ${results.length} resultados via DuckDuckGo`);
      return results;
    }
  } catch (err) {
    console.log(`  [Search] DuckDuckGo fallback error: ${(err as Error).message?.slice(0, 50)}`);
  }

  // Last fallback: direct Google scraping
  try {
    await delay(1000);
    const results = await searchWithGoogleScraping(query, count);
    if (results.length > 0) {
      console.log(`  [Search] ${results.length} resultados via Google scraping`);
      return results;
    }
  } catch (err) {
    console.log(`  [Search] Google scraping fallback error: ${(err as Error).message?.slice(0, 50)}`);
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
