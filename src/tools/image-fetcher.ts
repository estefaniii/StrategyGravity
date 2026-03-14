import type { Competitor } from "../types/index.js";

/**
 * Fetches a website's favicon as base64 for embedding in PPTX.
 * Uses Google's favicon service for reliability.
 */
export async function fetchFaviconBase64(websiteUrl: string, brandName?: string): Promise<string | null> {
  try {
    const hostname = new URL(websiteUrl).hostname;
    // Build list of domains to try in priority order
    const domains = [hostname];
    const parts = hostname.split(".");
    // If subdomain (e.g. "remax.panama.com"), try the brand's own .com domain
    if (parts.length > 2) {
      const subdomain = parts[0].replace(/^www$/, "");
      if (subdomain && subdomain !== "www") {
        domains.push(`${subdomain}.com`); // e.g. "remax.com" from "remax.panama.com"
        domains.push(`www.${subdomain}.com`);
      }
    }
    // Also try brand name as domain if provided
    if (brandName) {
      const clean = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean.length > 2) domains.push(`${clean}.com`);
    }

    for (const domain of domains) {
      try {
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        const response = await fetch(faviconUrl, { signal: AbortSignal.timeout(5000) });
        const buffer = await response.arrayBuffer();
        // Skip if 404 with tiny default icon (726 bytes = generic globe)
        if (!response.ok && buffer.byteLength <= 800) continue;
        if (buffer.byteLength < 100) continue; // Too small, probably empty
        const base64 = Buffer.from(buffer).toString("base64");
        return `image/png;base64,${base64}`;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches any image URL as base64 for embedding in PPTX.
 */
export async function fetchImageBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/png";
    const mimeType = contentType.split(";")[0].trim();
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Fetches favicons for all competitors in parallel.
 * Returns a Map of competitor name → base64 image data.
 */
export async function fetchCompetitorLogos(competitors: Competitor[]): Promise<Map<string, string>> {
  const logos = new Map<string, string>();

  console.log(`  [Images] Descargando logos de ${competitors.length} competidores...`);

  const promises = competitors.map(async (comp) => {
    if (!comp.website) return;
    try {
      const logo = await fetchFaviconBase64(comp.website, comp.name);
      if (logo) {
        logos.set(comp.name, logo);
      }
    } catch {}
  });

  await Promise.allSettled(promises);
  console.log(`  [Images] ${logos.size} logos descargados`);
  return logos;
}

/**
 * Fetches the company's own logo/favicon.
 */
export async function fetchCompanyLogo(website?: string): Promise<string | null> {
  if (!website) return null;
  console.log(`  [Images] Descargando logo de la empresa...`);
  return fetchFaviconBase64(website);
}
