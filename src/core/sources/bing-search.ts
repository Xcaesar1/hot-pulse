import Parser from "rss-parser";
import type { CandidateDocument } from "@/core/contracts";
import { extractArticle } from "@/core/extract";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { domainFromUrl, normalizeCanonicalUrl, normalizeText, truncate } from "@/core/utils";

const parser = new Parser();

export const bingSearchAdapter: SourceAdapter = {
  key: "bing-search",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const mode = String(context.source.config.mode ?? "news");
    const maxResults = Number(context.source.config.maxResults ?? 8);
    const feedUrl =
      mode === "web"
        ? `https://www.bing.com/search?q=${encodeURIComponent(context.monitor.query)}&format=rss&setlang=en-US`
        : `https://www.bing.com/news/search?q=${encodeURIComponent(context.monitor.query)}&format=rss&setlang=en-US`;
    const feed = await parser.parseURL(feedUrl);
    const results: CandidateDocument[] = [];

    for (const [index, item] of (feed.items ?? []).slice(0, maxResults).entries()) {
      const rawUrl = item.link || feed.link || "";
      if (!rawUrl) continue;
      const article = await extractArticle(rawUrl).catch(() => null);
      const canonicalUrl = article?.canonicalUrl || normalizeCanonicalUrl(rawUrl);

      results.push({
        sourceKey: context.source.key,
        sourceLabel: context.source.label,
        sourceKind: context.source.kind,
        externalId: item.guid || item.id || canonicalUrl || `${context.monitor.query}-${index}`,
        title: normalizeText(article?.title || item.title || "Untitled Bing result"),
        url: canonicalUrl,
        snippet: truncate(normalizeText(article?.text || item.contentSnippet || item.title || ""), 220),
        content: truncate(normalizeText(article?.text || item.contentSnippet || item.title || ""), 1600),
        author: item.creator ? normalizeText(item.creator) : null,
        publishedAt: item.isoDate || item.pubDate || null,
        metadata: {
          discoveryEngine: "bing-news",
          evidenceFamily: "search_discovery",
          canonicalUrl,
          canonicalDomain: domainFromUrl(canonicalUrl),
          qualitySignals: {
            rank: index + 1,
            extracted: Boolean(article),
            score: Math.max(36, 72 - index * 4 + (article ? 8 : 0))
          }
        }
      });
    }

    return results;
  }
};
