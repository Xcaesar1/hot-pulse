import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { domainFromUrl, normalizeCanonicalUrl, normalizeText, truncate } from "@/core/utils";

interface HnItem {
  objectID: string;
  title: string;
  url: string | null;
  author: string;
  created_at: string;
  story_text: string | null;
}

export const hackerNewsAdapter: SourceAdapter = {
  key: "hacker-news",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 8);
    const endpoint = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(context.monitor.query)}&tags=story&hitsPerPage=${maxResults}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      throw new Error(`Hacker News fetch failed: ${response.status}`);
    }
    const payload = (await response.json()) as { hits: HnItem[] };
    return (payload.hits ?? []).map((item) => ({
      sourceKey: context.source.key,
      sourceLabel: context.source.label,
      sourceKind: context.source.kind,
      externalId: item.objectID,
      title: normalizeText(item.title),
      url: normalizeCanonicalUrl(item.url || `https://news.ycombinator.com/item?id=${item.objectID}`),
      snippet: truncate(normalizeText(item.story_text || item.title), 220),
      content: truncate(normalizeText(item.story_text || item.title), 1200),
      author: normalizeText(item.author),
      publishedAt: item.created_at,
      metadata: {
        query: context.monitor.query,
        evidenceFamily: "community",
        publishedAtSource: "api",
        canonicalUrl: normalizeCanonicalUrl(item.url || `https://news.ycombinator.com/item?id=${item.objectID}`),
        canonicalDomain: domainFromUrl(item.url || `https://news.ycombinator.com/item?id=${item.objectID}`),
        qualitySignals: {
          score: 74
        }
      }
    }));
  }
};
