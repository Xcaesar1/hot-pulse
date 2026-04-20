import type { CandidateDocument } from "@/core/contracts";
import { fetchSearchHtml, mapSearchResultsToCandidates, parseHtmlSearchResults } from "@/core/sources/search-html";
import type { SourceAdapter, SourceFetchContext } from "@/core/sources/base";

const startpageProfile = {
  resultSelectors: [".w-gl__result", ".result", ".search-result"],
  titleSelectors: [".w-gl__result-title", "h3", ".result-title"],
  linkSelectors: ["a.w-gl__result-title", "a.result-link", "a[href]"],
  snippetSelectors: [".w-gl__description", ".result-desc", ".description", "p"],
  timeSelectors: ["time", ".w-gl__result-date", ".result-date", ".meta"],
  skipHrefPatterns: [/\/sp\/search/i, /\/settings/i]
};

export function parseStartpageResults(html: string) {
  return parseHtmlSearchResults(html, "https://www.startpage.com", startpageProfile);
}

function buildStartpageUrl(query: string, region: string) {
  return {
    url: "https://www.startpage.com/sp/search",
    params: {
      query,
      cat: "web",
      language: "english",
      region
    }
  };
}

export const startpageSearchAdapter: SourceAdapter = {
  key: "startpage-search",
  async fetch(context: SourceFetchContext): Promise<CandidateDocument[]> {
    const maxResults = Number(context.source.config.maxResults ?? 6);
    const requestDelayMs = Number(context.source.config.requestDelayMs ?? 180);
    const region = String(context.source.config.region ?? "us-en");
    const request = buildStartpageUrl(context.monitor.query, region);
    const html = await fetchSearchHtml(request.url, request.params);
    const results = parseStartpageResults(html);

    return mapSearchResultsToCandidates({
      context,
      results,
      maxResults,
      requestDelayMs,
      discoveryEngine: "startpage",
      baseScore: 62
    });
  }
};
