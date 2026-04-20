import { buildRelevancePrefilter } from "@/core/ai/relevance";
import { heuristicAnalysis } from "@/core/ai/openrouter";
import type { AIAnalysisResult, MonitorMode } from "@/core/contracts";

export interface RelevanceEvalCase {
  name: string;
  query: string;
  mode: MonitorMode;
  aliases?: string[];
  title: string;
  snippet?: string;
  content: string;
  expectedPass: boolean;
  expectedKeywordMentioned: boolean;
}

export interface RelevanceEvalResult {
  total: number;
  passed: number;
  precision: number;
  falsePositiveRate: number;
  keywordMentionedAccuracy: number;
  strictMatchAccuracy: number;
  cases: Array<{
    name: string;
    predictedPass: boolean;
    keywordMentioned: boolean;
    matchType: AIAnalysisResult["matchType"];
    correct: boolean;
  }>;
}

export const relevanceRegressionCases: RelevanceEvalCase[] = [
  {
    name: "exact-match-claude-sonnet-46",
    query: "Claude Sonnet 4.6",
    aliases: ["Anthropic Claude Sonnet 4.6"],
    mode: "keyword",
    title: "Claude Sonnet 4.6 is now rolling out to API users",
    snippet: "Anthropic confirmed Claude Sonnet 4.6 availability.",
    content: "Anthropic says Claude Sonnet 4.6 is live for selected developers.",
    expectedPass: true,
    expectedKeywordMentioned: true
  },
  {
    name: "alias-match-anthropic-name",
    query: "Claude Code",
    aliases: ["Anthropic Claude Code"],
    mode: "keyword",
    title: "Anthropic Claude Code gets new terminal workflow",
    content: "The Anthropic Claude Code team shipped better diff handling.",
    expectedPass: true,
    expectedKeywordMentioned: true
  },
  {
    name: "reject-openclaw-adjacent",
    query: "Claude Sonnet 4.6",
    aliases: ["Anthropic Claude Sonnet 4.6"],
    mode: "keyword",
    title: "OpenClaw improves local coding workflows",
    content: "This update is about OpenClaw local execution and task runners.",
    expectedPass: false,
    expectedKeywordMentioned: false
  },
  {
    name: "reject-missing-version",
    query: "Claude Sonnet 4.6",
    aliases: ["Anthropic Claude Sonnet 4.6"],
    mode: "keyword",
    title: "Claude Sonnet gets benchmark gains",
    content: "This post discusses Claude Sonnet generally, but does not specify any concrete release number.",
    expectedPass: false,
    expectedKeywordMentioned: true
  },
  {
    name: "topic-monitor-stays-broad",
    query: "AI coding agents",
    mode: "topic",
    title: "Agentic coding workflow patterns in 2026",
    content: "A broad discussion about AI coding agents and multi-step workflows.",
    expectedPass: true,
    expectedKeywordMentioned: false
  }
];

function decideLocalPass(result: AIAnalysisResult, mode: MonitorMode) {
  if (mode === "topic") {
    return result.relevanceScore >= 60;
  }

  if (!result.keywordMentioned && result.relevanceScore < 75) {
    return false;
  }

  if (result.matchType !== "exact" && result.matchType !== "alias") {
    return false;
  }

  return result.relevanceScore >= 60;
}

export function runLocalRelevanceRegression(cases: RelevanceEvalCase[]): RelevanceEvalResult {
  const rows = cases.map((testCase) => {
    const prefilter = buildRelevancePrefilter({
      query: testCase.query,
      aliases: testCase.aliases,
      mode: testCase.mode,
      document: {
        title: testCase.title,
        snippet: testCase.snippet ?? "",
        content: testCase.content
      }
    });

    const analysis = heuristicAnalysis({
      query: testCase.query,
      title: testCase.title,
      body: `${testCase.snippet ?? ""} ${testCase.content}`.trim(),
      prefilter
    });

    const predictedPass = testCase.mode === "keyword" && prefilter.strictReject ? false : decideLocalPass(analysis, testCase.mode);
    return {
      name: testCase.name,
      predictedPass,
      keywordMentioned: analysis.keywordMentioned,
      matchType: analysis.matchType,
      correct: predictedPass === testCase.expectedPass,
      keywordMentionedCorrect: analysis.keywordMentioned === testCase.expectedKeywordMentioned,
      strictMatchCorrect:
        testCase.mode === "topic" ? true : testCase.expectedPass ? analysis.matchType === "exact" || analysis.matchType === "alias" : analysis.matchType !== "exact"
    };
  });

  const truePositives = rows.filter((row, index) => row.predictedPass && cases[index]?.expectedPass).length;
  const predictedPositives = rows.filter((row) => row.predictedPass).length;
  const falsePositives = rows.filter((row, index) => row.predictedPass && !cases[index]?.expectedPass).length;
  const expectedNegatives = rows.filter((_, index) => !cases[index]?.expectedPass).length;

  return {
    total: rows.length,
    passed: rows.filter((row) => row.correct).length,
    precision: predictedPositives === 0 ? 1 : truePositives / predictedPositives,
    falsePositiveRate: expectedNegatives === 0 ? 0 : falsePositives / expectedNegatives,
    keywordMentionedAccuracy: rows.filter((row) => row.keywordMentionedCorrect).length / rows.length,
    strictMatchAccuracy: rows.filter((row) => row.strictMatchCorrect).length / rows.length,
    cases: rows
  };
}
