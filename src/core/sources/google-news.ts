import Parser from "rss-parser";
import type { CandidateDocument } from "@/core/contracts";
import { extractArticle } from "@/core/extract";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { domainFromUrl, normalizeCanonicalUrl, normalizeText, truncate } from "@/core/utils";

const parser = new Parser();

export const googleNewsAdapter: SourceAdapter = {
  key: "google-news-rss",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 10);
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(context.monitor.query)}&hl=en-US&gl=US&ceid=US:en`;
    const feed = await parser.parseURL(url);
    const items: CandidateDocument[] = [];

    for (const [index, item] of (feed.items ?? []).slice(0, maxResults).entries()) {
      const rawUrl = item.link || "";
      const article = rawUrl ? await extractArticle(rawUrl).catch(() => null) : null;
      const canonicalUrl = article?.canonicalUrl || normalizeCanonicalUrl(rawUrl);

      items.push({
        sourceKey: context.source.key,
        sourceLabel: context.source.label,
        sourceKind: context.source.kind,
        externalId: item.guid || item.id || canonicalUrl || `${context.monitor.query}-${index}`,
        title: normalizeText(article?.title || item.title || "Untitled Google News item"),
        url: canonicalUrl,
        snippet: truncate(normalizeText(article?.text || item.contentSnippet || item.content || ""), 220),
        content: truncate(normalizeText(article?.text || item.contentSnippet || item.content || item.title || ""), 1600),
        author: item.creator ? normalizeText(item.creator) : null,
        publishedAt: item.isoDate || item.pubDate || null,
        metadata: {
          query: context.monitor.query,
          categories: item.categories ?? [],
          discoveryEngine: "google-news",
          evidenceFamily: "search_discovery",
          publishedAtSource: "rss",
          canonicalUrl,
          canonicalDomain: domainFromUrl(canonicalUrl),
          qualitySignals: {
            rank: index + 1,
            extracted: Boolean(article),
            score: Math.max(40, 76 - index * 4 + (article ? 8 : 0))
          }
        }
      });
    }

    return items;
  }
};
