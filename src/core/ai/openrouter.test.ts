import { describe, expect, it } from "vitest";
import { heuristicAnalysis, parseAnalysisPayload, shouldTranslateAnalysis } from "@/core/ai/openrouter";
import { buildRelevancePrefilter } from "@/core/ai/relevance";

describe("openrouter analysis helpers", () => {
  it("parses structured JSON payloads", () => {
    const result = parseAnalysisPayload(`
      {
        "keywordMentioned": true,
        "isRelevant": true,
        "relevanceScore": 82,
        "matchType": "exact",
        "matchedTerms": ["claude sonnet 4.6", "claude", "sonnet", "4.6"],
        "missingRequiredTerms": [],
        "whyRelevant": "文本直接提到了 Claude Sonnet 4.6。",
        "whyNotRelevant": "没有明显的缺失项。",
        "credibilityRisk": 21,
        "noveltyScore": 68,
        "summary": "这条内容直接讨论了 Claude Sonnet 4.6。",
        "credibilityReasoning": "多个来源一致，没有明显冲突。",
        "suggestedNotify": "high"
      }
    `);

    expect(result.keywordMentioned).toBe(true);
    expect(result.matchType).toBe("exact");
    expect(result.matchedTerms).toContain("claude");
    expect(result.suggestedNotify).toBe("high");
  });

  it("falls back to heuristic analysis with keyword-aware reasoning", () => {
    const prefilter = buildRelevancePrefilter({
      query: "Claude Code",
      mode: "keyword",
      document: {
        title: "Claude Code release lands",
        snippet: "",
        content: "Anthropic announces Claude Code release for terminal workflows."
      }
    });

    const result = heuristicAnalysis({
      query: "Claude Code",
      title: "Claude Code release lands",
      body: "Anthropic announces Claude Code release for terminal workflows.",
      prefilter
    });

    expect(result.keywordMentioned).toBe(true);
    expect(result.isRelevant).toBe(true);
    expect(result.matchType).toBe("exact");
    expect(result.whyRelevant).toContain("直接");
  });

  it("marks english analysis text for chinese translation", () => {
    expect(
      shouldTranslateAnalysis({
        summary: "New model release confirmed.",
        reasoning: "Appears in multiple official sources.",
        credibilityReasoning: "Official sources align.",
        whyRelevant: "It directly mentions the keyword.",
        whyNotRelevant: "Missing version detail."
      })
    ).toBe(true);

    expect(
      shouldTranslateAnalysis({
        summary: "这条内容直接讨论了目标关键词。",
        reasoning: "它直接提到了监控词。",
        credibilityReasoning: "多个来源之间没有明显冲突。",
        whyRelevant: "内容里出现了核心词。",
        whyNotRelevant: "未发现明显缺项。"
      })
    ).toBe(false);
  });
});
