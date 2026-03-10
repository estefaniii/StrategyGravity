import type { ToolResult } from "../types/index.js";

export interface ImageResult {
  title: string;
  url: string;
  thumbnailUrl: string;
  source: string;
  width?: number;
  height?: number;
}

/**
 * Search for images using web search. Uses free Pexels-style search
 * or falls back to generating descriptive placeholders for slides.
 */
export async function searchImages(query: string, count = 5): Promise<ToolResult> {
  try {
    // Try Pexels free API (no key required for basic search)
    const results = await searchPexels(query, count);
    if (results.length > 0) {
      return { success: true, data: results };
    }

    // Fallback: generate placeholder image descriptions for slides
    return {
      success: true,
      data: generatePlaceholderImages(query, count),
    };
  } catch (err) {
    return {
      success: true,
      data: generatePlaceholderImages(query, count),
    };
  }
}

async function searchPexels(query: string, count: number): Promise<ImageResult[]> {
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: process.env.PEXELS_API_KEY || "",
        },
      }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as {
      photos: Array<{
        alt: string;
        src: { large: string; medium: string };
        photographer: string;
        width: number;
        height: number;
      }>;
    };

    return data.photos.map((photo) => ({
      title: photo.alt || query,
      url: photo.src.large,
      thumbnailUrl: photo.src.medium,
      source: `Pexels - ${photo.photographer}`,
      width: photo.width,
      height: photo.height,
    }));
  } catch {
    return [];
  }
}

function generatePlaceholderImages(query: string, count: number): ImageResult[] {
  const images: ImageResult[] = [];
  for (let i = 0; i < count; i++) {
    // Use placeholder service for development
    const width = 1200;
    const height = 675;
    images.push({
      title: `${query} - Image ${i + 1}`,
      url: `https://placehold.co/${width}x${height}/1a1a2e/e0e0e0?text=${encodeURIComponent(query.slice(0, 30))}`,
      thumbnailUrl: `https://placehold.co/400x225/1a1a2e/e0e0e0?text=${encodeURIComponent(query.slice(0, 20))}`,
      source: "placeholder",
      width,
      height,
    });
  }
  return images;
}

export async function getImageForSlide(topic: string, brand?: string): Promise<ImageResult | null> {
  const searchQuery = brand ? `${topic} ${brand} professional` : `${topic} business professional`;
  const result = await searchImages(searchQuery, 1);
  if (result.success && Array.isArray(result.data) && result.data.length > 0) {
    return result.data[0];
  }
  return null;
}
