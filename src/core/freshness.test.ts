import { describe, expect, it } from "vitest";
import { annotateCandidateFreshness, evaluateFreshness, parseLooseDate } from "@/core/freshness";

describe("freshness", () => {
  it("marks recent content as fresh within 24 hours", () => {
    const publishedAt = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const result = evaluateFreshness(publishedAt, { freshnessWindowHours: 24 });
    expect(result.freshnessState).toBe("fresh");
    expect(result.isFresh).toBe(true);
  });

  it("marks old content as stale", () => {
    const publishedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const result = evaluateFreshness(publishedAt, { freshnessWindowHours: 24 });
    expect(result.freshnessState).toBe("stale");
    expect(result.isFresh).toBe(false);
  });

  it("parses relative time strings from search results", () => {
    const parsed = parseLooseDate("3 hours ago");
    expect(parsed).not.toBeNull();
  });

  it("annotates candidates with freshness metadata", () => {
    const candidate = annotateCandidateFreshness(
      {
        sourceKey: "twitter-api",
        sourceLabel: "X",
        sourceKind: "social",
        externalId: "1",
        title: "A brand new release",
        url: "https://x.com/example/status/1",
        snippet: "Snippet",
        content: "Content",
        author: "alice",
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        metadata: {
          discoveryEngine: "twitterapi.io",
          publishedAtSource: "api"
        }
      },
      {
        config: {
          freshnessWindowHours: 24
        }
      }
    );

    expect(candidate.metadata.freshnessState).toBe("fresh");
    expect(candidate.metadata.publishedAtSource).toBe("api");
  });
});
