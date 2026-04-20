import type { MonitorRecord, SourceRecord } from "@/core/contracts";
import { createId, nowIso } from "@/core/utils";

const createdAt = nowIso();

export function defaultMonitors(): MonitorRecord[] {
  return [
    {
      id: createId("mon"),
      label: "AI 编程",
      query: "AI coding agents",
      mode: "topic",
      aliases: ["AI 编程", "coding agent", "developer AI"],
      checkIntervalMinutes: 30,
      minRelevanceScore: 60,
      notifyEmail: true,
      notifyInApp: true,
      enabled: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("mon"),
      label: "Claude Code",
      query: "Claude Code",
      mode: "keyword",
      aliases: ["Anthropic Claude Code"],
      checkIntervalMinutes: 30,
      minRelevanceScore: 65,
      notifyEmail: true,
      notifyInApp: true,
      enabled: true,
      createdAt,
      updatedAt: createdAt
    }
  ];
}

export function defaultSources(): SourceRecord[] {
  return [
    {
      id: createId("src"),
      key: "duckduckgo-search",
      label: "DuckDuckGo Search Discovery",
      kind: "search",
      enabled: true,
      config: { maxResults: 8, freshnessWindowHours: 24, allowUnknownDateCandidates: true, discoveryPriority: 42 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "google-news-rss",
      label: "Google News RSS",
      kind: "search",
      enabled: true,
      config: { maxResults: 10, freshnessWindowHours: 24, allowUnknownDateCandidates: true, discoveryPriority: 70 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "bing-search",
      label: "Bing News Search",
      kind: "search",
      enabled: true,
      config: { mode: "news", maxResults: 8, freshnessWindowHours: 24, allowUnknownDateCandidates: true, discoveryPriority: 66 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "startpage-search",
      label: "Startpage Search Discovery",
      kind: "search",
      enabled: true,
      config: { maxResults: 6, requestDelayMs: 180, region: "us-en", freshnessWindowHours: 24, allowUnknownDateCandidates: true, discoveryPriority: 38 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "brave-search",
      label: "Brave Search Discovery",
      kind: "search",
      enabled: true,
      config: { maxResults: 6, requestDelayMs: 180, country: "us", searchType: "web", freshnessWindowHours: 24, allowUnknownDateCandidates: true, discoveryPriority: 36 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "twitter-api",
      label: "X via twitterapi.io",
      kind: "social",
      enabled: true,
      config: {
        maxResults: 8,
        strictMode: true,
        queryType: "Top",
        minLikes: 10,
        minRetweets: 5,
        minViews: 500,
        minFollowers: 100,
        allowReplies: false,
        trustedAccounts: ["OpenAI", "AnthropicAI", "GoogleDeepMind", "xai", "sama"],
        usernames: ["OpenAI", "AnthropicAI", "GoogleDeepMind", "xai"],
        userFetchLimit: 4,
        backoffMs: 1200,
        freshnessWindowHours: 24,
        allowUnknownDateCandidates: false,
        discoveryPriority: 100
      },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "hacker-news",
      label: "Hacker News",
      kind: "structured",
      enabled: true,
      config: { maxResults: 8, freshnessWindowHours: 24, allowUnknownDateCandidates: false, discoveryPriority: 60 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "reddit-search",
      label: "Reddit Search",
      kind: "structured",
      enabled: true,
      config: { maxResults: 8, subreddits: ["LocalLLaMA", "singularity", "artificial"], freshnessWindowHours: 24, allowUnknownDateCandidates: false, discoveryPriority: 54 },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "github-releases",
      label: "GitHub Releases",
      kind: "structured",
      enabled: true,
      config: {
        repositories: ["openai/openai-cookbook", "vercel/ai", "anthropics/anthropic-sdk-typescript"],
        freshnessWindowHours: 24,
        allowUnknownDateCandidates: false,
        discoveryPriority: 74
      },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: createId("src"),
      key: "custom-rss",
      label: "Custom RSS",
      kind: "custom",
      enabled: true,
      config: {
        feedUrls: ["https://openai.com/news/rss.xml", "https://github.blog/feed/"],
        freshnessWindowHours: 24,
        allowUnknownDateCandidates: false,
        discoveryPriority: 72
      },
      lastStatus: "idle",
      lastRunAt: null,
      errorMessage: null,
      createdAt,
      updatedAt: createdAt
    }
  ];
}
