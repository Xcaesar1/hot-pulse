import type { CandidateDocument } from "@/core/contracts";
import { fetchSearchHtml, mapSearchResultsToCandidates, parseHtmlSearchResults } from "@/core/sources/search-html";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";

const braveProfile = {
  resultSelectors: [".snippet[data-type='web']", ".card[data-type='web']", ".result", ".snippet"],
  titleSelectors: [".title", "h2", ".heading", "a span"],
  linkSelectors: ["a.heading-serpresult", "a[href]"],
  snippetSelectors: [".description", ".snippet-description", ".excerpt", "p"],
  skipHrefPatterns: [/\/settings/i, /\/help/i, /\/search\?/i]
};

export function parseBraveResults(html: string) {
  return parseHtmlSearchResults(html, "https://search.brave.com", braveProfile);
}

function buildBraveUrl(query: string, country: string, searchType: string) {
  return {
    url: "https://search.brave.com/search",
    params: {
      q: query,
      source: searchType,
      country
    }
  };
}

export const braveSearchAdapter: SourceAdapter = {
  key: "brave-search",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 6);
    const requestDelayMs = Number(context.source.config.requestDelayMs ?? 180);
    const country = String(context.source.config.country ?? "us");
    const searchType = String(context.source.config.searchType ?? "web");
    const request = buildBraveUrl(context.monitor.query, country, searchType);
    const html = await fetchSearchHtml(request.url, request.params);
    const results = parseBraveResults(html);

    return mapSearchResultsToCandidates({
      context,
      results,
      maxResults,
      requestDelayMs,
      discoveryEngine: "brave-search",
      baseScore: 60
    });
  }
};
