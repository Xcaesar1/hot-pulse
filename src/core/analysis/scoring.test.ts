import { describe, expect, it } from "vitest";
import { computeScores } from "@/core/analysis/scoring";

describe("computeScores", () => {
  it("promotes multi-source relevant evidence to high priority", () => {
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
          url: "https://x.com/example",
          title: "Title",
          snippet: "Snippet",
          author: "alice",
          publishedAt: new Date().toISOString(),
          weight: 1
        },
        {
          sourceKey: "google-news-rss",
          sourceLabel: "Google News",
          url: "https://news.google.com/example",
          title: "Title",
          snippet: "Snippet",
          author: "bob",
          publishedAt: new Date().toISOString(),
          weight: 1
        }
      ]
    });

    expect(result.notifyLevel).toBe("high");
    expect(result.finalScore).toBeGreaterThanOrEqual(72);
  });
});
