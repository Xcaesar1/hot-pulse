import type { CandidateDocument, EvidenceFamily, HotspotEvidenceRecord } from "@/core/contracts";
import { clamp, domainFromUrl } from "@/core/utils";

export function getEvidenceFamily(sourceKey: string): EvidenceFamily {
  switch (sourceKey) {
    case "duckduckgo-search":
    case "google-news-rss":
    case "bing-search":
    case "startpage-search":
    case "brave-search":
      return "search_discovery";
    case "twitter-api":
      return "social";
    case "hacker-news":
    case "reddit-search":
      return "community";
    case "github-releases":
    case "custom-rss":
      return "official";
    default:
      return "search_discovery";
  }
}

export function getEvidenceQuality(document: CandidateDocument): number {
  const qualitySignals = (document.metadata.qualitySignals as Record<string, unknown> | undefined) ?? {};
  const explicitScore = Number(qualitySignals.score ?? document.metadata.qualityScore ?? 0);
  if (explicitScore > 0) {
    return clamp(explicitScore);
  }

  const discoveryEngine = String(document.metadata.discoveryEngine ?? "");
  const rank = Number(qualitySignals.rank ?? document.metadata.rank ?? 10);
  const extracted = Boolean(qualitySignals.extracted ?? false);
  const base =
    discoveryEngine === "google-news"
      ? 62
      : discoveryEngine === "bing-news"
        ? 58
        : discoveryEngine === "startpage"
          ? 56
          : discoveryEngine === "brave-search"
            ? 54
        : discoveryEngine === "duckduckgo"
          ? 52
          : getEvidenceFamily(document.sourceKey) === "official"
            ? 80
            : getEvidenceFamily(document.sourceKey) === "community"
              ? 64
              : 48;
  return clamp(base + (extracted ? 10 : 0) - Math.max(rank - 1, 0) * 4);
}

export function getCandidateCanonicalUrl(candidate: CandidateDocument): string {
  return String(candidate.metadata.canonicalUrl ?? candidate.url);
}

export function getCandidateCanonicalDomain(candidate: CandidateDocument): string {
  return String(candidate.metadata.canonicalDomain ?? domainFromUrl(getCandidateCanonicalUrl(candidate)));
}

export function getEvidenceIdentity(evidence: HotspotEvidenceRecord): string {
  if (evidence.evidenceFamily === "search_discovery") {
    return `${evidence.evidenceFamily}::${evidence.url.toLowerCase()}`;
  }
  return `${evidence.evidenceFamily}::${evidence.sourceKey}::${evidence.url.toLowerCase()}`;
}
