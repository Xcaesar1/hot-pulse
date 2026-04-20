import type { AIAnalysisResult, CandidateDocument, HotspotCandidateState, HotspotEvidenceRecord, NotificationLevel } from "@/core/contracts";
import { computeFreshnessScore, getHotspotCandidateState, hasFreshPrimaryEvidence } from "@/core/freshness";
import { getCandidateCanonicalDomain, getCandidateCanonicalUrl } from "@/core/source-signals";
import { clamp, domainFromUrl } from "@/core/utils";

const authorityWeights: Record<string, number> = {
  "twitter-api": 24,
  "google-news-rss": 18,
  "bing-search": 16,
  "startpage-search": 12,
  "brave-search": 11,
  "duckduckgo-search": 10,
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
  freshnessScore: number;
  sourceDiversityScore: number;
  sourceAuthorityScore: number;
  sourceReliabilityScore: number;
  velocityScore: number;
  hasFreshPrimaryEvidence: boolean;
  candidateState: HotspotCandidateState;
  notifyLevel: NotificationLevel;
} {
  const uniqueFamilies = [...new Set(args.evidence.map((item) => item.evidenceFamily))];
  const hasNonSearchFamily = uniqueFamilies.some((family) => family !== "search_discovery");
  const uniqueEvidenceKeys = [...new Set(args.evidence.map((item) => `${item.evidenceFamily}:${item.sourceKey}:${item.url}`))];
  const freshEvidence = args.evidence.filter((item) => item.isFreshEvidence);
  const freshnessScore = computeFreshnessScore(args.evidence);
  const freshPrimary = hasFreshPrimaryEvidence(args.evidence);
  const hasFreshReliableEvidence = freshEvidence.some(
    (item) => item.evidenceFamily === "official" || item.sourceKey === "twitter-api" || item.qualityScore >= 80
  );
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
  const velocityScore = clamp(freshEvidence.length * 20 + Math.max(args.evidence.length - freshEvidence.length, 0) * 6, 0, 100);
  const trustScore = 100 - args.analysis.credibilityRisk;
  const baseScore =
    args.analysis.relevanceScore * 0.31 +
    trustScore * 0.16 +
    args.analysis.noveltyScore * 0.06 +
    freshnessScore * 0.18 +
    sourceDiversityScore * 0.12 +
    sourceReliabilityScore * 0.08 +
    sourceAuthorityScore * 0.05 +
    velocityScore * 0.04;
  const freshnessBias = freshPrimary ? 8 : hasFreshReliableEvidence ? 4 : 0;
  const stalenessPenalty = freshEvidence.length === 0 ? 18 : freshnessScore < 40 ? 8 : 0;
  const finalScore = clamp(baseScore + freshnessBias - stalenessPenalty);

  let notifyLevel: NotificationLevel = "low";
  if (
    finalScore >= 72 &&
    uniqueFamilies.length >= 2 &&
    hasNonSearchFamily &&
    args.analysis.credibilityRisk <= 45 &&
    freshEvidence.length > 0 &&
    (freshPrimary || hasFreshReliableEvidence)
  ) {
    notifyLevel = "high";
  } else if (
    finalScore >= 58 &&
    args.analysis.relevanceScore >= 55 &&
    uniqueFamilies.length >= 2 &&
    hasNonSearchFamily &&
    freshEvidence.length > 0 &&
    (freshPrimary || hasFreshReliableEvidence)
  ) {
    notifyLevel = "medium";
  }

  return {
    finalScore,
    freshnessScore,
    sourceDiversityScore,
    sourceAuthorityScore,
    sourceReliabilityScore,
    velocityScore,
    hasFreshPrimaryEvidence: freshPrimary,
    candidateState: getHotspotCandidateState(args.evidence),
    notifyLevel
  };
}
