import Parser from "rss-parser";
import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { normalizeText, truncate } from "@/core/utils";

const parser = new Parser();

export const googleNewsAdapter: SourceAdapter = {
  key: "google-news-rss",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 6);
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(context.monitor.query)}&hl=en-US&gl=US&ceid=US:en`;
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).slice(0, maxResults).map((item, index) => ({
      sourceKey: context.source.key,
      sourceLabel: context.source.label,
      sourceKind: context.source.kind,
      externalId: item.guid || item.id || item.link || `${context.monitor.query}-${index}`,
      title: normalizeText(item.title || "Untitled Google News item"),
      url: item.link || "",
      snippet: truncate(normalizeText(item.contentSnippet || item.content || ""), 220),
      content: truncate(normalizeText(item.contentSnippet || item.content || item.title || ""), 1200),
      author: item.creator ? normalizeText(item.creator) : null,
      publishedAt: item.isoDate || item.pubDate || null,
      metadata: {
        query: context.monitor.query,
        categories: item.categories ?? []
      }
    }));
  }
};
