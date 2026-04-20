import axios from "axios";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { CandidateDocument } from "@/core/contracts";
import { extractArticle } from "@/core/extract";
import type { SourceFetchContext } from "@/core/sources/base";
import { domainFromUrl, hashString, normalizeCanonicalUrl, normalizeText, truncate, wait } from "@/core/utils";

export interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface SearchHtmlProfile {
  resultSelectors: string[];
  titleSelectors: string[];
  linkSelectors: string[];
  snippetSelectors: string[];
  skipHrefPatterns?: RegExp[];
}

const searchClient = axios.create({
  timeout: 12000,
  maxRedirects: 4,
  headers: {
    "User-Agent": "HotPulseBot/0.1 (+https://localhost)",
    Accept: "text/html,application/xhtml+xml"
  },
  responseType: "text",
  transitional: {
    clarifyTimeoutError: true
  }
});

function pickFirstText($: CheerioAPI, root: unknown, selectors: string[]): string {
  for (const selector of selectors) {
    const value = $(root as never).find(selector).first().text().trim();
    if (value) return normalizeText(value);
  }
  return "";
}

function pickFirstHref($: CheerioAPI, root: unknown, selectors: string[], baseUrl: string): string {
  for (const selector of selectors) {
    const href = $(root as never).find(selector).first().attr("href")?.trim();
    if (!href) continue;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
  }
  return "";
}

function matchesBlockedPattern(href: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(href));
}

export async function fetchSearchHtml(url: string, params?: Record<string, string>): Promise<string> {
  const response = await searchClient.get<string>(url, {
    params,
    validateStatus: (status) => status >= 200 && status < 400
  });
  return response.data;
}

export function parseHtmlSearchResults(html: string, baseUrl: string, profile: SearchHtmlProfile): RawSearchResult[] {
  const $ = cheerio.load(html);
  const containers = profile.resultSelectors.flatMap((selector) => $(selector).toArray());
  const blockedPatterns = profile.skipHrefPatterns ?? [];
  const results: RawSearchResult[] = [];
  const seen = new Set<string>();

  for (const [index, node] of containers.entries()) {
    const url = pickFirstHref($, node, profile.linkSelectors, baseUrl);
    const title = pickFirstText($, node, profile.titleSelectors);
    const snippet = pickFirstText($, node, profile.snippetSelectors);
    if (!url || !title) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (blockedPatterns.length > 0 && matchesBlockedPattern(url, blockedPatterns)) continue;

    const canonicalUrl = normalizeCanonicalUrl(url);
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);

    results.push({
      title,
      url: canonicalUrl,
      snippet,
      rank: index + 1
    });
  }

  return results;
}

export async function mapSearchResultsToCandidates(args: {
  context: SourceFetchContext;
  results: RawSearchResult[];
  maxResults: number;
  requestDelayMs: number;
  discoveryEngine: string;
  baseScore: number;
}): Promise<CandidateDocument[]> {
  const items: CandidateDocument[] = [];

  for (const result of args.results.slice(0, args.maxResults)) {
    const article = await extractArticle(result.url).catch(() => null);
    const canonicalUrl = article?.canonicalUrl || normalizeCanonicalUrl(result.url);
    const content = article?.text || result.snippet || result.title;

    items.push({
      sourceKey: args.context.source.key,
      sourceLabel: args.context.source.label,
      sourceKind: args.context.source.kind,
      externalId: hashString(canonicalUrl),
      title: article?.title || result.title,
      url: canonicalUrl,
      snippet: truncate(article?.text || result.snippet || result.title, 220),
      content,
      author: null,
      publishedAt: null,
      metadata: {
        discoveryEngine: args.discoveryEngine,
        evidenceFamily: "search_discovery",
        canonicalUrl,
        canonicalDomain: domainFromUrl(canonicalUrl),
        rank: result.rank,
        query: args.context.monitor.query,
        qualitySignals: {
          rank: result.rank,
          extracted: Boolean(article),
          score: Math.max(28, args.baseScore - (result.rank - 1) * 4 + (article ? 8 : 0))
        }
      }
    });

    if (args.requestDelayMs > 0) {
      await wait(args.requestDelayMs);
    }
  }

  return items;
}
