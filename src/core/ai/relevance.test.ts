import { describe, expect, it } from "vitest";
import { buildRelevancePrefilter, expandMonitorQuery } from "@/core/ai/relevance";

describe("query expansion and prefilter", () => {
  it("builds conservative variants for keyword monitors", () => {
    const result = expandMonitorQuery({
      query: "Claude Sonnet 4.6",
      aliases: ["Anthropic Claude Sonnet 4.6"],
      mode: "keyword"
    });

    expect(result.requiredTerms).toEqual(expect.arrayContaining(["claude", "sonnet", "4.6"]));
    expect(result.expandedTerms).toEqual(expect.arrayContaining(["claude sonnet 4.6", "4 6", "46"]));
  });

  it("marks direct keyword mentions and missing required terms", () => {
    const result = buildRelevancePrefilter({
      query: "Claude Sonnet 4.6",
      aliases: ["Anthropic Claude Sonnet 4.6"],
      mode: "keyword",
      document: {
        title: "Claude Sonnet 4.6 now available",
        snippet: "Anthropic ships Claude Sonnet 4.6 for developers.",
        content: ""
      }
    });

    expect(result.keywordMentioned).toBe(true);
    expect(result.strictReject).toBe(false);
    expect(result.missingRequiredTerms).toHaveLength(0);
    expect(result.matchCoverage).toBe(100);
  });

  it("rejects unrelated adjacent concepts before AI review", () => {
    const result = buildRelevancePrefilter({
      query: "Claude Sonnet 4.6",
      aliases: ["Anthropic Claude Sonnet 4.6"],
      mode: "keyword",
      document: {
        title: "OpenClaw launches new coding model",
        snippet: "OpenClaw adds local coding features.",
        content: "This update is focused on OpenClaw and local execution."
      }
    });

    expect(result.keywordMentioned).toBe(false);
    expect(result.strictReject).toBe(true);
    expect(result.matchCoverage).toBe(0);
  });

  it("keeps topic monitors broad without hard rejection", () => {
    const result = buildRelevancePrefilter({
      query: "AI coding agents",
      mode: "topic",
      document: {
        title: "New workflow for coding copilots",
        snippet: "",
        content: "A broad discussion about agentic coding workflows."
      }
    });

    expect(result.strictReject).toBe(false);
    expect(result.strictReview).toBe(false);
  });
});
