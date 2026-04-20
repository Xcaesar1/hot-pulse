import Parser from "rss-parser";
import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { normalizeText, truncate } from "@/core/utils";

const parser = new Parser();

export const customRssAdapter: SourceAdapter = {
  key: "custom-rss",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const feedUrls = Array.isArray(context.source.config.feedUrls) ? context.source.config.feedUrls : [];
    const items: CandidateDocument[] = [];

    for (const feedUrl of feedUrls.slice(0, 6)) {
      try {
        const feed = await parser.parseURL(feedUrl);
        for (const item of (feed.items ?? []).slice(0, 3)) {
          const text = normalizeText(`${item.title ?? ""} ${item.contentSnippet ?? ""} ${item.content ?? ""}`).toLowerCase();
          if (!text.includes(context.monitor.query.toLowerCase())) {
            continue;
          }
          items.push({
            sourceKey: context.source.key,
            sourceLabel: context.source.label,
            sourceKind: context.source.kind,
            externalId: item.id || item.guid || `${feedUrl}-${item.link}`,
            title: normalizeText(item.title || feed.title || "Custom RSS item"),
            url: item.link || feed.link || feedUrl,
            snippet: truncate(normalizeText(item.contentSnippet || item.title || ""), 220),
            content: truncate(normalizeText(item.content || item.contentSnippet || item.title || ""), 1200),
            author: item.creator ? normalizeText(item.creator) : feed.title ? normalizeText(feed.title) : null,
            publishedAt: item.isoDate || item.pubDate || null,
            metadata: {
              feedTitle: feed.title,
              feedUrl
            }
          });
        }
      } catch {
        continue;
      }
    }

    return items;
  }
};
