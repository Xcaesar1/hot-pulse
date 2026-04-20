import Parser from "rss-parser";
import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { domainFromUrl, normalizeCanonicalUrl, truncate } from "@/core/utils";

const parser = new Parser();

export const githubReleasesAdapter: SourceAdapter = {
  key: "github-releases",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const repositories = Array.isArray(context.source.config.repositories) ? context.source.config.repositories : [];
    const results: CandidateDocument[] = [];

    for (const repo of repositories.slice(0, 5)) {
      const feed = await parser.parseURL(`https://github.com/${repo}/releases.atom`);
      for (const item of (feed.items ?? []).slice(0, 2)) {
        results.push({
          sourceKey: context.source.key,
          sourceLabel: context.source.label,
          sourceKind: context.source.kind,
          externalId: item.id || item.guid || `${repo}-${item.link}`,
          title: item.title || `${repo} release`,
          url: normalizeCanonicalUrl(item.link || `https://github.com/${repo}/releases`),
          snippet: truncate(item.contentSnippet || item.title || "", 220),
          content: truncate(item.content || item.contentSnippet || item.title || "", 1200),
          author: item.creator || repo,
          publishedAt: item.isoDate || item.pubDate || null,
          metadata: {
            repository: repo,
            evidenceFamily: "official",
            canonicalUrl: normalizeCanonicalUrl(item.link || `https://github.com/${repo}/releases`),
            canonicalDomain: domainFromUrl(item.link || `https://github.com/${repo}/releases`),
            qualitySignals: {
              score: 90
            }
          }
        });
      }
    }

    return results.filter((item) => item.title.toLowerCase().includes(context.monitor.query.toLowerCase()) || item.content.toLowerCase().includes(context.monitor.query.toLowerCase()));
  }
};
