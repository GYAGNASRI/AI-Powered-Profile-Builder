const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

function headers() {
  const lovable = process.env.LOVABLE_API_KEY;
  const fc = process.env.FIRECRAWL_API_KEY;
  if (!lovable || !fc) throw new Error("Missing LOVABLE_API_KEY or FIRECRAWL_API_KEY");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": fc,
  };
}

export interface SearchResultItem {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

export async function firecrawlSearch(
  query: string,
  opts: { limit?: number; scrape?: boolean } = {},
): Promise<SearchResultItem[]> {
  const body: Record<string, unknown> = {
    query,
    limit: opts.limit ?? 5,
  };
  if (opts.scrape) {
    body.scrapeOptions = { formats: ["markdown"], onlyMainContent: true };
  }
  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl search [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as { data?: { web?: SearchResultItem[] } | SearchResultItem[] };
  const raw = json.data;
  if (Array.isArray(raw)) return raw;
  return raw?.web ?? [];
}

export async function firecrawlScrape(url: string): Promise<{ markdown?: string; title?: string }> {
  const res = await fetch(`${GATEWAY}/scrape`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl scrape [${res.status}]: ${text}`);
  }
  const json = (await res.json()) as {
    data?: { markdown?: string; metadata?: { title?: string } };
    markdown?: string;
    metadata?: { title?: string };
  };
  const md = json.data?.markdown ?? json.markdown;
  const title = json.data?.metadata?.title ?? json.metadata?.title;
  return { markdown: md, title };
}
