import { describe, expect, it } from "vitest";
import { computeScores } from "@/core/analysis/scoring";

describe("computeScores", () => {
  it("promotes multi-family relevant evidence to high priority", () => {
    const now = new Date().toISOString();
    const result = computeScores({
      analysis: {
        keywordMentioned: true,
        isRelevant: true,
        relevanceScore: 90,
        matchType: "exact",
        matchedTerms: ["claude code"],
        missingRequiredTerms: [],
        whyRelevant: "Direct keyword match",
        whyNotRelevant: "None",
        credibilityRisk: 24,
        noveltyScore: 72,
        summary: "Summary",
        reasoning: "Reason",
        credibilityReasoning: "Credibility reason",
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
          publishedAt: now,
          capturedAt: now,
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 78,
          interactionMetrics: null,
          authorSignals: null
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
          publishedAt: now,
          capturedAt: now,
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 92,
          interactionMetrics: null,
          authorSignals: null
        }
      ]
    });

    expect(result.notifyLevel).toBe("high");
    expect(result.finalScore).toBeGreaterThanOrEqual(72);
    expect(result.hasFreshPrimaryEvidence).toBe(true);
  });

  it("keeps single-family evidence below medium", () => {
    const now = new Date().toISOString();
    const result = computeScores({
      analysis: {
        keywordMentioned: true,
        isRelevant: true,
        relevanceScore: 96,
        matchType: "exact",
        matchedTerms: ["claude code"],
        missingRequiredTerms: [],
        whyRelevant: "Direct keyword match",
        whyNotRelevant: "None",
        credibilityRisk: 18,
        noveltyScore: 80,
        summary: "Summary",
        reasoning: "Reason",
        credibilityReasoning: "Credibility reason",
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
          publishedAt: now,
          capturedAt: now,
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 80,
          interactionMetrics: null,
          authorSignals: null
        }
      ]
    });

    expect(result.notifyLevel).toBe("low");
  });

  it("does not promote multiple search engines hitting the same family alone", () => {
    const now = new Date().toISOString();
    const result = computeScores({
      analysis: {
        keywordMentioned: true,
        isRelevant: true,
        relevanceScore: 88,
        matchType: "exact",
        matchedTerms: ["openai"],
        missingRequiredTerms: [],
        whyRelevant: "Direct keyword match",
        whyNotRelevant: "None",
        credibilityRisk: 20,
        noveltyScore: 70,
        summary: "Summary",
        reasoning: "Reason",
        credibilityReasoning: "Credibility reason",
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
          publishedAt: now,
          capturedAt: now,
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 72,
          interactionMetrics: null,
          authorSignals: null
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
          publishedAt: now,
          capturedAt: now,
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 68,
          interactionMetrics: null,
          authorSignals: null
        }
      ]
    });

    expect(result.notifyLevel).toBe("low");
    expect(result.sourceDiversityScore).toBe(34);
  });

  it("downgrades stale content even with multiple sources", () => {
    const stale = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const result = computeScores({
      analysis: {
        keywordMentioned: true,
        isRelevant: true,
        relevanceScore: 92,
        matchType: "exact",
        matchedTerms: ["claude code"],
        missingRequiredTerms: [],
        whyRelevant: "Direct keyword match",
        whyNotRelevant: "None",
        credibilityRisk: 16,
        noveltyScore: 70,
        summary: "Summary",
        reasoning: "Reason",
        credibilityReasoning: "Credibility reason",
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
          publishedAt: stale,
          capturedAt: stale,
          freshnessState: "stale",
          isFreshEvidence: false,
          weight: 1,
          qualityScore: 81,
          interactionMetrics: null,
          authorSignals: null
        },
        {
          sourceKey: "google-news-rss",
          sourceLabel: "Google News",
          evidenceFamily: "search_discovery",
          discoverySource: "google-news",
          url: "https://example.com/post",
          title: "Title",
          snippet: "Snippet",
          author: "openai",
          publishedAt: stale,
          capturedAt: stale,
          freshnessState: "stale",
          isFreshEvidence: false,
          weight: 1,
          qualityScore: 76,
          interactionMetrics: null,
          authorSignals: null
        }
      ]
    });

    expect(result.notifyLevel).toBe("low");
    expect(result.freshnessScore).toBeLessThan(40);
  });
});
