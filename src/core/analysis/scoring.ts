import type { AIAnalysisResult, CandidateDocument, HotspotEvidenceRecord, NotificationLevel } from "@/core/contracts";
import { getCandidateCanonicalDomain, getCandidateCanonicalUrl } from "@/core/source-signals";
import { clamp, domainFromUrl } from "@/core/utils";

const authorityWeights: Record<string, number> = {
  "twitter-api": 10,
  "google-news-rss": 16,
  "bing-search": 16,
  "startpage-search": 15,
  "brave-search": 14,
  "duckduckgo-search": 12,
  "hacker-news": 22,
  "reddit-search": 14,
  "github-releases": 28,
  "custom-rss": 26
};

export function buildHotspotFingerprint(candidate: CandidateDocument, query: string) {
  const titleCore = candidate.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ").trim();
  const canonicalUrl = getCandidateCanonicalUrl(candidate);
  const domain = getCandidateCanonicalDomain(candidate) || domainFromUrl(canonicalUrl);
  return `${query.toLowerCase()}::${domain}::${titleCore.slice(0, 120)}`;
}

export function computeScores(args: {
  analysis: AIAnalysisResult;
  evidence: HotspotEvidenceRecord[];
}): {
  finalScore: number;
  sourceDiversityScore: number;
  sourceAuthorityScore: number;
  sourceReliabilityScore: number;
  velocityScore: number;
  notifyLevel: NotificationLevel;
} {
  const uniqueFamilies = [...new Set(args.evidence.map((item) => item.evidenceFamily))];
  const hasNonSearchFamily = uniqueFamilies.some((family) => family !== "search_discovery");
  const uniqueEvidenceKeys = [...new Set(args.evidence.map((item) => `${item.evidenceFamily}:${item.sourceKey}:${item.url}`))];
  const sourceDiversityScore = clamp(uniqueFamilies.length * 34, 0, 100);
  const sourceAuthorityScore = clamp(
    Math.round(
      args.evidence.reduce((sum, item) => sum + (authorityWeights[item.sourceKey] ?? 8), 0) /
        Math.max(uniqueEvidenceKeys.length, 1)
    )
  );
  const sourceReliabilityScore = clamp(
    Math.round(args.evidence.reduce((sum, item) => sum + item.qualityScore, 0) / Math.max(args.evidence.length, 1))
  );
  const velocityScore = clamp(args.evidence.length * 16, 0, 100);
  const trustScore = 100 - args.analysis.credibilityRisk;
  const finalScore = clamp(
    args.analysis.relevanceScore * 0.34 +
      trustScore * 0.16 +
      args.analysis.noveltyScore * 0.08 +
      sourceDiversityScore * 0.18 +
      sourceReliabilityScore * 0.12 +
      sourceAuthorityScore * 0.06 +
      velocityScore * 0.06
  );

  let notifyLevel: NotificationLevel = "low";
  if (finalScore >= 72 && uniqueFamilies.length >= 2 && hasNonSearchFamily && args.analysis.credibilityRisk <= 45) {
    notifyLevel = "high";
  } else if (finalScore >= 58 && args.analysis.relevanceScore >= 55 && uniqueFamilies.length >= 2 && hasNonSearchFamily) {
    notifyLevel = "medium";
  }

  return {
    finalScore,
    sourceDiversityScore,
    sourceAuthorityScore,
    sourceReliabilityScore,
    velocityScore,
    notifyLevel
  };
}
