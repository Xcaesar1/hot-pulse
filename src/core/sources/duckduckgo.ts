import * as cheerio from "cheerio";
import type { CandidateDocument } from "@/core/contracts";
import { extractArticle, fetchText } from "@/core/extract";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { hashString, truncate, wait } from "@/core/utils";

function buildSearchUrl(query: string): string {
  return `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
}

export const duckDuckGoAdapter: SourceAdapter = {
  key: "duckduckgo-search",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 4);
    const html = await fetchText(buildSearchUrl(context.monitor.query));
    const $ = cheerio.load(html);
    const anchors = $("a.result__a").slice(0, maxResults).toArray();
    const results: CandidateDocument[] = [];

    for (const [index, anchor] of anchors.entries()) {
      const title = $(anchor).text().trim();
      const url = $(anchor).attr("href") ?? "";
      if (!title || !url) continue;

      const article = await extractArticle(url).catch(() => null);
      results.push({
        sourceKey: context.source.key,
        sourceLabel: context.source.label,
        sourceKind: context.source.kind,
        externalId: hashString(url),
        title: article?.title || title,
        url,
        snippet: truncate(article?.text || title, 220),
        content: article?.text || title,
        author: null,
        publishedAt: null,
        metadata: {
          rank: index + 1,
          query: context.monitor.query
        }
      });
      await wait(120);
    }

    return results;
  }
};
