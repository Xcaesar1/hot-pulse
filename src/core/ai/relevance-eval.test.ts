import { describe, expect, it } from "vitest";
import { relevanceRegressionCases, runLocalRelevanceRegression } from "@/core/ai/relevance-eval";

describe("relevance regression dataset", () => {
  it("keeps false positives under control for keyword monitors", () => {
    const result = runLocalRelevanceRegression(relevanceRegressionCases);

    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(result.precision).toBeGreaterThanOrEqual(0.8);
    expect(result.falsePositiveRate).toBe(0);
    expect(result.keywordMentionedAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(result.strictMatchAccuracy).toBeGreaterThanOrEqual(0.8);
  });

  it("specifically rejects OpenClaw for Claude Sonnet 4.6", () => {
    const result = runLocalRelevanceRegression(relevanceRegressionCases);
    const target = result.cases.find((item) => item.name === "reject-openclaw-adjacent");

    expect(target?.predictedPass).toBe(false);
    expect(target?.keywordMentioned).toBe(false);
  });
});
