import type { AIAnalysisResult, CandidateDocument, HotspotEvidenceRecord, NotificationLevel } from "@/core/contracts";
import { clamp, domainFromUrl } from "@/core/utils";

const authorityWeights: Record<string, number> = {
  "twitter-api": 18,
  "google-news-rss": 20,
  "duckduckgo-search": 12,
  "hacker-news": 15,
  "reddit-search": 10,
  "github-releases": 22,
  "custom-rss": 24
};

export function buildHotspotFingerprint(candidate: CandidateDocument, query: string) {
  const titleCore = candidate.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ").trim();
  const domain = domainFromUrl(candidate.url);
  return `${query.toLowerCase()}::${domain}::${titleCore.slice(0, 120)}`;
}

export function computeScores(args: {
  analysis: AIAnalysisResult;
  evidence: HotspotEvidenceRecord[];
}): {
  finalScore: number;
  sourceDiversityScore: number;
  sourceAuthorityScore: number;
  velocityScore: number;
  notifyLevel: NotificationLevel;
} {
  const uniqueSources = [...new Set(args.evidence.map((item) => item.sourceKey))];
  const sourceDiversityScore = clamp(uniqueSources.length * 30, 0, 100);
  const sourceAuthorityScore = clamp(
    uniqueSources.reduce((sum, key) => sum + (authorityWeights[key] ?? 8), 0),
    0,
    100
  );
  const velocityScore = clamp(args.evidence.length * 18, 0, 100);
  const trustScore = 100 - args.analysis.credibilityRisk;
  const finalScore = clamp(
    args.analysis.relevanceScore * 0.4 +
      trustScore * 0.18 +
      args.analysis.noveltyScore * 0.12 +
      sourceDiversityScore * 0.16 +
      sourceAuthorityScore * 0.09 +
      velocityScore * 0.05
  );

  let notifyLevel: NotificationLevel = "low";
  if (finalScore >= 72 && sourceDiversityScore >= 30 && args.analysis.credibilityRisk <= 45) {
    notifyLevel = "high";
  } else if (finalScore >= 58 && args.analysis.relevanceScore >= 55) {
    notifyLevel = "medium";
  }

  return {
    finalScore,
    sourceDiversityScore,
    sourceAuthorityScore,
    velocityScore,
    notifyLevel
  };
}
