const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function fetchPage(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": randomUA(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(url: string, retries = 2, delayMs = 1500): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchPage(url);
    } catch (err) {
      lastError = err as Error;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Verify a URL resolves by sending a HEAD request.
 * Returns true if status is 2xx or 3xx. Falls back to GET if HEAD fails.
 */
export async function verifyUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": randomUA(), Accept: "*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    return response.status >= 200 && response.status < 400;
  } catch {
    // Some servers block HEAD — try GET with Range header
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": randomUA(), Accept: "text/html", Range: "bytes=0-0" },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }
}

/**
 * Verify multiple URLs in parallel. Returns map of url → boolean.
 */
export async function verifyUrls(urls: string[], timeoutMs = 5000): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  await Promise.all(
    urls.map(async (url) => {
      const ok = await verifyUrl(url, timeoutMs);
      results.set(url, ok);
    })
  );
  return results;
}
