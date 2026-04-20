import type { SourceAdapter } from "@/core/sources/base";
import { bingSearchAdapter } from "@/core/sources/bing-search";
import { braveSearchAdapter } from "@/core/sources/brave-search";
import { customRssAdapter } from "@/core/sources/custom-rss";
import { duckDuckGoAdapter } from "@/core/sources/duckduckgo";
import { githubReleasesAdapter } from "@/core/sources/github-releases";
import { googleNewsAdapter } from "@/core/sources/google-news";
import { hackerNewsAdapter } from "@/core/sources/hacker-news";
import { redditAdapter } from "@/core/sources/reddit";
import { startpageSearchAdapter } from "@/core/sources/startpage-search";
import { twitterApiAdapter } from "@/core/sources/twitter-api";

const adapters = [
  duckDuckGoAdapter,
  googleNewsAdapter,
  bingSearchAdapter,
  startpageSearchAdapter,
  braveSearchAdapter,
  twitterApiAdapter,
  hackerNewsAdapter,
  redditAdapter,
  githubReleasesAdapter,
  customRssAdapter
] satisfies SourceAdapter[];

export function getSourceAdapter(key: string): SourceAdapter | undefined {
  return adapters.find((adapter) => adapter.key === key);
}

export function listSourceAdapters(): SourceAdapter[] {
  return adapters;
}
