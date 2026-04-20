import { describe, expect, it } from "vitest";
import { heuristicAnalysis, parseAnalysisPayload, shouldTranslateAnalysis } from "@/core/ai/openrouter";

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
        "credibilityReasoning": "Official sources align and no contradiction appears in the payload.",
        "suggestedNotify": "high"
      }
    `);

    expect(result.relevanceScore).toBe(82);
    expect(result.suggestedNotify).toBe("high");
    expect(result.credibilityReasoning).toContain("Official sources");
  });

  it("falls back to heuristic analysis when no model output exists", () => {
    const result = heuristicAnalysis({
      query: "Claude Code",
      title: "Claude Code release lands",
      body: "Anthropic announces Claude Code release for terminal workflows."
    });

    expect(result.isRelevant).toBe(true);
    expect(result.relevanceScore).toBeGreaterThan(50);
    expect(result.credibilityReasoning.length).toBeGreaterThan(0);
    expect(result.reasoning).toContain("启发式兜底");
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

  it("marks english analysis text for chinese translation", () => {
    expect(
      shouldTranslateAnalysis({
        summary: "New model release confirmed.",
        reasoning: "Appears in multiple official sources.",
        credibilityReasoning: "Official sources align and no contradiction appears."
      })
    ).toBe(true);

    expect(
      shouldTranslateAnalysis({
        summary: "新模型发布已确认。",
        reasoning: "它同时出现在多个官方来源中。",
        credibilityReasoning: "多个来源之间没有明显冲突。"
      })
    ).toBe(false);
  });
});
