import { describe, expect, it, vi } from "vitest";
import type { HotspotView } from "@/core/contracts";
import { applyHotspotListQuery, computeHotspotHeatScore, getDefaultHotspotListQuery, parseHotspotListQuery } from "@/core/hotspot-query";

function makeHotspot(overrides: Partial<HotspotView> = {}): HotspotView {
  return {
    id: overrides.id ?? "hot-1",
    fingerprint: overrides.fingerprint ?? "fp-1",
    title: overrides.title ?? "Hotspot",
    canonicalUrl: overrides.canonicalUrl ?? "https://example.com/post",
    summary: overrides.summary ?? "Summary",
    rawSnippet: overrides.rawSnippet ?? "Original source snippet",
    reasoning: overrides.reasoning ?? "AI relevance reason",
    credibilityReasoning: overrides.credibilityReasoning ?? "AI credibility reason",
    notifyLevel: overrides.notifyLevel ?? "medium",
    relevanceScore: overrides.relevanceScore ?? 70,
    credibilityRisk: overrides.credibilityRisk ?? 20,
    noveltyScore: overrides.noveltyScore ?? 55,
    freshnessScore: overrides.freshnessScore ?? 85,
    heatScore: overrides.heatScore ?? 0,
    sourceDiversityScore: overrides.sourceDiversityScore ?? 60,
    sourceAuthorityScore: overrides.sourceAuthorityScore ?? 70,
    sourceReliabilityScore: overrides.sourceReliabilityScore ?? 75,
    velocityScore: overrides.velocityScore ?? 68,
    finalScore: overrides.finalScore ?? 74,
    evidenceCount: overrides.evidenceCount ?? 2,
    firstSeenAt: overrides.firstSeenAt ?? "2026-04-20T10:00:00.000Z",
    lastSeenAt: overrides.lastSeenAt ?? "2026-04-20T10:30:00.000Z",
    latestPublishedAt: overrides.latestPublishedAt === undefined ? "2026-04-20T10:15:00.000Z" : overrides.latestPublishedAt,
    notified: overrides.notified ?? false,
    hasFreshPrimaryEvidence: overrides.hasFreshPrimaryEvidence ?? true,
    candidateState: overrides.candidateState ?? "fresh_hotspot_candidate",
    monitorLabels: overrides.monitorLabels ?? ["OpenAI"],
    evidence:
      overrides.evidence ?? [
        {
          sourceKey: "twitter-api",
          sourceLabel: "Twitter",
          evidenceFamily: "social",
          discoverySource: "twitter-api",
          url: "https://x.com/openai/status/1",
          title: "Tweet",
          snippet: "Signal",
          author: "OpenAI",
          publishedAt: "2026-04-20T10:15:00.000Z",
          capturedAt: "2026-04-20T10:16:00.000Z",
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 82,
          interactionMetrics: {
            likes: 1200,
            reposts: 140,
            replies: 32,
            views: 28000
          },
          authorSignals: {
            isBlueVerified: true,
            followers: 1000000
          }
        },
        {
          sourceKey: "google-news-rss",
          sourceLabel: "Google News",
          evidenceFamily: "search_discovery",
          discoverySource: "google-news-rss",
          url: "https://news.example.com/post",
          title: "News",
          snippet: "Coverage",
          author: "Reporter",
          publishedAt: "2026-04-20T10:10:00.000Z",
          capturedAt: "2026-04-20T10:18:00.000Z",
          freshnessState: "fresh",
          isFreshEvidence: true,
          weight: 1,
          qualityScore: 70,
          interactionMetrics: null,
          authorSignals: null
        }
      ]
  };
}

describe("hotspot-query", () => {
  it("applies dashboard defaults when parsing empty search params", () => {
    expect(parseHotspotListQuery(new URLSearchParams())).toEqual(getDefaultHotspotListQuery());
  });

  it("parses page and clamps invalid values", () => {
    expect(parseHotspotListQuery(new URLSearchParams({ page: "3" })).page).toBe(3);
    expect(parseHotspotListQuery(new URLSearchParams({ page: "0" })).page).toBe(1);
    expect(parseHotspotListQuery(new URLSearchParams({ page: "-4" })).page).toBe(1);
  });

  it("filters by source, level, monitor, and time range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));
    const hotspots = [
      makeHotspot({ id: "match", notifyLevel: "high", monitorLabels: ["OpenAI"] }),
      makeHotspot({
        id: "old",
        firstSeenAt: "2026-04-18T12:00:00.000Z",
        latestPublishedAt: "2026-04-18T12:00:00.000Z",
        notifyLevel: "high",
        monitorLabels: ["Anthropic"]
      })
    ];

    const result = applyHotspotListQuery(
      hotspots,
      {
        sources: ["twitter-api"],
        levels: ["high"],
        monitors: ["OpenAI"],
        timeRange: "24h"
      },
      "all"
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("match");
    vi.useRealTimers();
  });

  it("sorts by importance before final score", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({ id: "medium", notifyLevel: "medium", finalScore: 99 }),
        makeHotspot({ id: "high", notifyLevel: "high", finalScore: 40 })
      ],
      { sort: "importance", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["high", "medium"]);
  });

  it("sorts by importance using final score and freshness as tie breakers", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({ id: "fresh-high", notifyLevel: "high", finalScore: 80, freshnessScore: 90 }),
        makeHotspot({ id: "stale-high", notifyLevel: "high", finalScore: 80, freshnessScore: 60 }),
        makeHotspot({ id: "lower-high", notifyLevel: "high", finalScore: 70, freshnessScore: 99 })
      ],
      { sort: "importance", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["fresh-high", "stale-high", "lower-high"]);
  });

  it("sorts by heat using unified heat score before velocity", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({
          id: "hottest",
          velocityScore: 60,
          sourceDiversityScore: 85,
          sourceReliabilityScore: 88,
          sourceAuthorityScore: 80,
          freshnessScore: 92,
          evidenceCount: 4
        }),
        makeHotspot({
          id: "warmer",
          velocityScore: 90,
          sourceDiversityScore: 40,
          sourceReliabilityScore: 45,
          sourceAuthorityScore: 38,
          freshnessScore: 62,
          evidenceCount: 2
        }),
        makeHotspot({
          id: "cooler",
          velocityScore: 40,
          sourceDiversityScore: 30,
          sourceReliabilityScore: 35,
          sourceAuthorityScore: 30,
          freshnessScore: 50,
          evidenceCount: 1
        })
      ],
      { sort: "heat", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["hottest", "warmer", "cooler"]);
    expect(result[0]?.heatScore).toBeGreaterThan(result[1]?.heatScore ?? 0);
  });

  it("sorts by relevance before final score", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({ id: "most-relevant", relevanceScore: 94, finalScore: 20 }),
        makeHotspot({ id: "less-relevant", relevanceScore: 80, finalScore: 99 }),
        makeHotspot({ id: "same-relevance-higher-final", relevanceScore: 80, finalScore: 60 })
      ],
      { sort: "relevance", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["most-relevant", "less-relevant", "same-relevance-higher-final"]);
  });

  it("sorts by published time with missing dates at the end", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({ id: "no-date", latestPublishedAt: null }),
        makeHotspot({ id: "newest", latestPublishedAt: "2026-04-20T12:00:00.000Z" }),
        makeHotspot({ id: "older", latestPublishedAt: "2026-04-20T11:00:00.000Z" })
      ],
      { sort: "published", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["newest", "older", "no-date"]);
  });

  it("sorts by discovered time using first seen timestamp", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({ id: "oldest", firstSeenAt: "2026-04-20T08:00:00.000Z", finalScore: 99 }),
        makeHotspot({ id: "newest", firstSeenAt: "2026-04-20T12:00:00.000Z", finalScore: 10 }),
        makeHotspot({ id: "middle", firstSeenAt: "2026-04-20T10:00:00.000Z", finalScore: 50 })
      ],
      { sort: "discovered", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("derives published time from evidence when latestPublishedAt is missing", () => {
    const result = applyHotspotListQuery(
      [
        makeHotspot({
          id: "derived-late",
          latestPublishedAt: null,
          evidence: [
            {
              sourceKey: "twitter-api",
              sourceLabel: "Twitter",
              evidenceFamily: "social",
              discoverySource: "twitter-api",
              url: "https://x.com/openai/status/2",
              title: "Tweet 2",
              snippet: "Signal 2",
              author: "OpenAI",
              publishedAt: "2026-04-20T12:00:00.000Z",
              capturedAt: "2026-04-20T12:02:00.000Z",
              freshnessState: "fresh",
              isFreshEvidence: true,
              weight: 1,
              qualityScore: 78,
              interactionMetrics: null,
              authorSignals: null
            }
          ]
        }),
        makeHotspot({
          id: "derived-early",
          latestPublishedAt: null,
          evidence: [
            {
              sourceKey: "google-news-rss",
              sourceLabel: "Google News",
              evidenceFamily: "search_discovery",
              discoverySource: "google-news-rss",
              url: "https://news.example.com/older",
              title: "Older",
              snippet: "Older coverage",
              author: "Reporter",
              publishedAt: "2026-04-20T09:00:00.000Z",
              capturedAt: "2026-04-20T09:05:00.000Z",
              freshnessState: "fresh",
              isFreshEvidence: true,
              weight: 1,
              qualityScore: 70,
              interactionMetrics: null,
              authorSignals: null
            }
          ]
        })
      ],
      { sort: "published", levels: [] },
      "all"
    );

    expect(result.map((item) => item.id)).toEqual(["derived-late", "derived-early"]);
    expect(result[0]?.latestPublishedAt).toBe("2026-04-20T12:00:00.000Z");
  });

  it("computes a unified heat score across mixed evidence", () => {
    const score = computeHotspotHeatScore(
      makeHotspot({
        evidenceCount: 4,
        velocityScore: 88,
        sourceDiversityScore: 72,
        sourceReliabilityScore: 74,
        sourceAuthorityScore: 66
      })
    );

    expect(score).toBeGreaterThan(60);
  });

  it("falls back to defaults for invalid query values", () => {
    const result = parseHotspotListQuery(
      new URLSearchParams({
        sort: "wrong",
        timeRange: "bad",
        levels: "high,invalid"
      })
    );

    expect(result.sort).toBe("importance");
    expect(result.timeRange).toBe("24h");
    expect(result.levels).toEqual(["high"]);
    expect(result.page).toBe(1);
  });
});
