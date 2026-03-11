import * as cheerio from "cheerio";
import { fetchWithRetry } from "./http-utils.js";
import type { ScrapedCompetitorData } from "../types/index.js";

export async function scrapeCompetitorWebsite(url: string): Promise<ScrapedCompetitorData> {
  console.log(`  [Scrape] Analizando ${url}...`);

  const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer for cleaner text
  $("script, style, noscript, nav, footer, header, iframe").remove();

  // Title
  const title = $("title").text().trim() || $("h1").first().text().trim() || "";

  // Description
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  // Body text - clean and limited
  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  // Extract services from headings and key sections
  const services: string[] = [];
  $("h2, h3, .service, .services, [class*='service'], [class*='producto'], [class*='solucion']").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 3 && text.length < 100 && !text.includes("{")) {
      services.push(text);
    }
  });

  // Deduplicate services
  const uniqueServices = [...new Set(services)].slice(0, 15);

  // Social links
  const socialLinks: string[] = [];
  const socialPatterns = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "youtube.com"];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (socialPatterns.some((p) => href.includes(p))) {
      socialLinks.push(href);
    }
  });

  // Tech stack hints
  const techStack: string[] = [];
  const generator = $('meta[name="generator"]').attr("content");
  if (generator) techStack.push(generator);

  // Check for common frameworks
  const htmlStr = html.slice(0, 50000).toLowerCase();
  if (htmlStr.includes("wordpress")) techStack.push("WordPress");
  if (htmlStr.includes("shopify")) techStack.push("Shopify");
  if (htmlStr.includes("wix")) techStack.push("Wix");
  if (htmlStr.includes("react")) techStack.push("React");
  if (htmlStr.includes("next")) techStack.push("Next.js");
  if (htmlStr.includes("hubspot")) techStack.push("HubSpot");
  if (htmlStr.includes("google tag manager") || htmlStr.includes("gtm.js")) techStack.push("Google Tag Manager");
  if (htmlStr.includes("google analytics") || htmlStr.includes("gtag")) techStack.push("Google Analytics");
  if (htmlStr.includes("facebook pixel") || htmlStr.includes("fbq(")) techStack.push("Facebook Pixel");

  return {
    url,
    title,
    description,
    bodyText,
    services: uniqueServices,
    socialLinks: [...new Set(socialLinks)],
    techStack: [...new Set(techStack)],
  };
}
