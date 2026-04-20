import { describe, expect, it } from "vitest";
import { computeScores } from "@/core/analysis/scoring";

describe("computeScores", () => {
  it("promotes multi-family relevant evidence to high priority", () => {
    const result = computeScores({
      analysis: {
        isRelevant: true,
        relevanceScore: 90,
        credibilityRisk: 24,
        noveltyScore: 72,
        summary: "Summary",
        reasoning: "Reason",
        suggestedNotify: "high"
      },
      evidence: [
        {
          sourceKey: "twitter-api",
          sourceLabel: "X",
          evidenceFamily: "social",
          discoverySource: "twitterapi.io",
          url: "https://x.com/example",
          title: "Title",
          snippet: "Snippet",
          author: "alice",
          publishedAt: new Date().toISOString(),
          weight: 1,
          qualityScore: 78
        },
        {
          sourceKey: "github-releases",
          sourceLabel: "GitHub Releases",
          evidenceFamily: "official",
          discoverySource: "github-releases",
          url: "https://github.com/example/release",
          title: "Title",
          snippet: "Snippet",
          author: "bob",
          publishedAt: new Date().toISOString(),
          weight: 1,
          qualityScore: 92
        }
      ]
    });

    expect(result.notifyLevel).toBe("high");
    expect(result.finalScore).toBeGreaterThanOrEqual(72);
  });

  it("keeps single-family evidence below medium", () => {
    const result = computeScores({
      analysis: {
        isRelevant: true,
        relevanceScore: 96,
        credibilityRisk: 18,
        noveltyScore: 80,
        summary: "Summary",
        reasoning: "Reason",
        suggestedNotify: "high"
      },
      evidence: [
        {
          sourceKey: "twitter-api",
          sourceLabel: "X",
          evidenceFamily: "social",
          discoverySource: "twitterapi.io",
          url: "https://x.com/example",
          title: "Title",
          snippet: "Snippet",
          author: "alice",
          publishedAt: new Date().toISOString(),
          weight: 1,
          qualityScore: 80
        }
      ]
    });

    expect(result.notifyLevel).toBe("low");
  });

  it("does not promote multiple search engines hitting the same family alone", () => {
    const result = computeScores({
      analysis: {
        isRelevant: true,
        relevanceScore: 88,
        credibilityRisk: 20,
        noveltyScore: 70,
        summary: "Summary",
        reasoning: "Reason",
        suggestedNotify: "high"
      },
      evidence: [
        {
          sourceKey: "google-news-rss",
          sourceLabel: "Google News",
          evidenceFamily: "search_discovery",
          discoverySource: "google-news",
          url: "https://openai.com/blog/example",
          title: "Title",
          snippet: "Snippet",
          author: "openai",
          publishedAt: new Date().toISOString(),
          weight: 1,
          qualityScore: 72
        },
        {
          sourceKey: "bing-search",
          sourceLabel: "Bing",
          evidenceFamily: "search_discovery",
          discoverySource: "bing-news",
          url: "https://openai.com/blog/example",
          title: "Title",
          snippet: "Snippet",
          author: "openai",
          publishedAt: new Date().toISOString(),
          weight: 1,
          qualityScore: 68
        }
      ]
    });

    expect(result.notifyLevel).toBe("low");
    expect(result.sourceDiversityScore).toBe(34);
  });
});
