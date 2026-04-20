import { describe, expect, it } from "vitest";
import { heuristicAnalysis, parseAnalysisPayload } from "@/core/ai/openrouter";

describe("openrouter analysis helpers", () => {
  it("parses structured JSON payloads", () => {
    const result = parseAnalysisPayload(`
      {
        "isRelevant": true,
        "relevanceScore": 82,
        "credibilityRisk": 21,
        "noveltyScore": 68,
        "summary": "New model release confirmed.",
        "reasoning": "Appears in multiple official sources.",
        "suggestedNotify": "high"
      }
    `);

    expect(result.relevanceScore).toBe(82);
    expect(result.suggestedNotify).toBe("high");
  });

  it("falls back to heuristic analysis when no model output exists", () => {
    const result = heuristicAnalysis({
      query: "Claude Code",
      title: "Claude Code release lands",
      body: "Anthropic announces Claude Code release for terminal workflows."
    });

    expect(result.isRelevant).toBe(true);
    expect(result.relevanceScore).toBeGreaterThan(50);
  });

  it("keeps fallback scoring shape stable", () => {
    const result = heuristicAnalysis({
      query: "AI coding",
      title: "AI coding release update",
      body: "A release update about AI coding workflows."
    });

    expect(result.credibilityRisk).toBe(28);
    expect(["high", "medium", "low"]).toContain(result.suggestedNotify);
  });
});
