import { analyzeCandidate } from "@/core/ai/openrouter";
import { buildRelevancePrefilter } from "@/core/ai/relevance";
import { relevanceRegressionCases } from "@/core/ai/relevance-eval";

async function main() {
  const rows = [];

  for (const testCase of relevanceRegressionCases) {
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

    const analysis = await analyzeCandidate({
      query: testCase.query,
      aliases: testCase.aliases,
      monitorMode: testCase.mode,
      expandedTerms: prefilter.expandedTerms,
      prefilter,
      title: testCase.title,
      body: `${testCase.snippet ?? ""} ${testCase.content}`.trim(),
      sourceLabel: "Local relevance eval",
      url: `https://local-eval/${testCase.name}`
    });

    rows.push({
      name: testCase.name,
      expectedPass: testCase.expectedPass,
      keywordMentioned: analysis.keywordMentioned,
      relevanceScore: analysis.relevanceScore,
      matchType: analysis.matchType,
      summary: analysis.summary
    });
  }

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
