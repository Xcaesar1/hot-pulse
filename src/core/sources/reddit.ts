import Parser from "rss-parser";
import type { CandidateDocument } from "@/core/contracts";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";
import { domainFromUrl, normalizeCanonicalUrl, normalizeText, truncate } from "@/core/utils";

interface RedditChild {
  data: {
    id: string;
    title: string;
    permalink: string;
    selftext: string;
    subreddit: string;
    author: string;
    created_utc: number;
  };
}

const parser = new Parser();

async function fetchRssFallback(context: SourceFetchContext, maxResults: number): Promise<CandidateDocument[]> {
  const subreddits = Array.isArray(context.source.config.subreddits) ? context.source.config.subreddits : [];
  const queryTerms = context.monitor.query.toLowerCase().split(/\s+/).filter(Boolean);
  const documents: CandidateDocument[] = [];

  for (const subreddit of subreddits.slice(0, 4)) {
    try {
      const feed = await parser.parseURL(`https://www.reddit.com/r/${subreddit}/new/.rss`);
      for (const item of (feed.items ?? []).slice(0, maxResults)) {
        const content = normalizeText(`${item.title || ""} ${item.contentSnippet || ""} ${item.content || ""}`);
        const matches = queryTerms.some((term) => content.toLowerCase().includes(term));
        if (!matches) continue;

        documents.push({
          sourceKey: context.source.key,
          sourceLabel: context.source.label,
          sourceKind: context.source.kind,
          externalId: item.id || item.guid || `${subreddit}-${item.link}`,
          title: normalizeText(item.title || `r/${subreddit}`),
          url: normalizeCanonicalUrl(item.link || `https://www.reddit.com/r/${subreddit}/new/`),
          snippet: truncate(content, 220),
          content: truncate(content, 1200),
          author: item.creator ? normalizeText(item.creator) : subreddit,
          publishedAt: item.isoDate || item.pubDate || null,
          metadata: {
            subreddit,
            fallback: "rss",
            evidenceFamily: "community",
            publishedAtSource: "rss",
            canonicalUrl: normalizeCanonicalUrl(item.link || `https://www.reddit.com/r/${subreddit}/new/`),
            canonicalDomain: domainFromUrl(item.link || `https://www.reddit.com/r/${subreddit}/new/`),
            qualitySignals: {
              score: 60
            }
          }
        });
      }
    } catch {
      continue;
    }
  }

  return documents.slice(0, maxResults);
}

export const redditAdapter: SourceAdapter = {
  key: "reddit-search",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 8);
    const subreddits = Array.isArray(context.source.config.subreddits) ? context.source.config.subreddits.join("+") : "";
    const endpoint = subreddits
      ? `https://www.reddit.com/r/${subreddits}/search.json?q=${encodeURIComponent(context.monitor.query)}&sort=new&restrict_sr=on&limit=${maxResults}`
      : `https://www.reddit.com/search.json?q=${encodeURIComponent(context.monitor.query)}&sort=new&limit=${maxResults}`;

    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HotPulseBot/0.1; +https://localhost)",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        return fetchRssFallback(context, maxResults);
      }
      throw new Error(`Reddit fetch failed: ${response.status}`);
    }
    const payload = (await response.json()) as { data: { children: RedditChild[] } };
    return (payload.data?.children ?? []).map((child) => ({
      sourceKey: context.source.key,
      sourceLabel: context.source.label,
      sourceKind: context.source.kind,
      externalId: child.data.id,
      title: normalizeText(child.data.title),
      url: normalizeCanonicalUrl(`https://www.reddit.com${child.data.permalink}`),
      snippet: truncate(normalizeText(child.data.selftext || child.data.title), 220),
      content: truncate(normalizeText(child.data.selftext || child.data.title), 1200),
      author: normalizeText(child.data.author),
      publishedAt: new Date(child.data.created_utc * 1000).toISOString(),
      metadata: {
        subreddit: child.data.subreddit,
        evidenceFamily: "community",
        publishedAtSource: "api",
        canonicalUrl: normalizeCanonicalUrl(`https://www.reddit.com${child.data.permalink}`),
        canonicalDomain: domainFromUrl(`https://www.reddit.com${child.data.permalink}`),
        qualitySignals: {
          score: 60
        }
      }
    }));
  }
};
