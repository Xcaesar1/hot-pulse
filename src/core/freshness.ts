import type { CandidateDocument, FreshnessState, HotspotCandidateState, HotspotEvidenceRecord, SourceRecord } from "@/core/contracts";
import { clamp, nowIso } from "@/core/utils";

export type PublishedAtSource = "api" | "rss" | "search_result" | "article_meta" | "inferred";

export interface FreshnessEvaluation {
  freshnessHours: number | null;
  freshnessState: FreshnessState;
  isFresh: boolean;
}

const DEFAULT_FRESHNESS_WINDOW_HOURS = 24;

export function getFreshnessWindowHours(source?: Pick<SourceRecord, "config">): number {
  const configured = Number(source?.config?.freshnessWindowHours ?? DEFAULT_FRESHNESS_WINDOW_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_FRESHNESS_WINDOW_HOURS;
}

export function parseTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function parseLooseDate(value: string | null | undefined, now = new Date()): string | null {
  if (!value) return null;
  const input = value.trim();
  if (!input) return null;

  const direct = parseTimestamp(input);
  if (direct) return direct;

  const normalized = input.toLowerCase();
  const patterns: Array<{ regex: RegExp; hours: (amount: number) => number }> = [
    { regex: /(\d+)\s*(minute|min)\w*\s*ago/, hours: (amount) => amount / 60 },
    { regex: /(\d+)\s*(hour|hr)\w*\s*ago/, hours: (amount) => amount },
    { regex: /(\d+)\s*day\w*\s*ago/, hours: (amount) => amount * 24 },
    { regex: /(\d+)\s*\u5206\u949f\u524d/, hours: (amount) => amount / 60 },
    { regex: /(\d+)\s*\u5c0f\u65f6\u524d/, hours: (amount) => amount },
    { regex: /(\d+)\s*\u5929\u524d/, hours: (amount) => amount * 24 }
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    return new Date(now.getTime() - pattern.hours(amount) * 60 * 60 * 1000).toISOString();
  }

  return null;
}

export function evaluateFreshness(
  publishedAt: string | null | undefined,
  options?: {
    now?: string | Date;
    freshnessWindowHours?: number;
  }
): FreshnessEvaluation {
  const normalizedPublishedAt = parseTimestamp(publishedAt);
  if (!normalizedPublishedAt) {
    return {
      freshnessHours: null,
      freshnessState: "unknown",
      isFresh: false
    };
  }

  const nowValue = options?.now ? new Date(options.now) : new Date();
  const freshnessWindowHours = options?.freshnessWindowHours ?? DEFAULT_FRESHNESS_WINDOW_HOURS;
  const ageHours = (nowValue.getTime() - new Date(normalizedPublishedAt).getTime()) / (60 * 60 * 1000);
  if (!Number.isFinite(ageHours) || ageHours < 0) {
    return {
      freshnessHours: 0,
      freshnessState: "fresh",
      isFresh: true
    };
  }

  return {
    freshnessHours: Math.round(ageHours * 10) / 10,
    freshnessState: ageHours <= freshnessWindowHours ? "fresh" : "stale",
    isFresh: ageHours <= freshnessWindowHours
  };
}

function inferPublishedAtSource(document: CandidateDocument): PublishedAtSource {
  const explicit = document.metadata.publishedAtSource;
  if (explicit === "api" || explicit === "rss" || explicit === "search_result" || explicit === "article_meta" || explicit === "inferred") {
    return explicit;
  }

  if (document.sourceKey === "twitter-api" || document.sourceKey === "reddit-search" || document.sourceKey === "hacker-news") {
    return "api";
  }

  if (
    document.sourceKey === "google-news-rss" ||
    document.sourceKey === "bing-search" ||
    document.sourceKey === "github-releases" ||
    document.sourceKey === "custom-rss"
  ) {
    return "rss";
  }

  return "inferred";
}

export function annotateCandidateFreshness(document: CandidateDocument, source: Pick<SourceRecord, "config">): CandidateDocument {
  const normalizedPublishedAt = parseTimestamp(document.publishedAt);
  const freshness = evaluateFreshness(normalizedPublishedAt, {
    now: nowIso(),
    freshnessWindowHours: getFreshnessWindowHours(source)
  });

  return {
    ...document,
    publishedAt: normalizedPublishedAt,
    metadata: {
      ...document.metadata,
      freshnessHours: freshness.freshnessHours,
      freshnessState: freshness.freshnessState,
      publishedAtSource: inferPublishedAtSource(document)
    }
  };
}

export function getDocumentFreshness(document: CandidateDocument): FreshnessEvaluation {
  const freshnessState = document.metadata.freshnessState;
  const freshnessHours = Number(document.metadata.freshnessHours);
  if (
    (freshnessState === "fresh" || freshnessState === "stale" || freshnessState === "unknown") &&
    (Number.isFinite(freshnessHours) || freshnessState === "unknown")
  ) {
    return {
      freshnessHours: Number.isFinite(freshnessHours) ? freshnessHours : null,
      freshnessState,
      isFresh: freshnessState === "fresh"
    };
  }

  return evaluateFreshness(document.publishedAt);
}

export function getEvidenceFreshness(evidence: Pick<HotspotEvidenceRecord, "publishedAt">): FreshnessEvaluation {
  return evaluateFreshness(evidence.publishedAt);
}

export function computeFreshnessScore(evidence: HotspotEvidenceRecord[]): number {
  if (evidence.length === 0) return 0;
  const weighted = evidence.reduce((sum, item) => {
    const value = item.freshnessState === "fresh" ? 100 : item.freshnessState === "stale" ? 18 : 36;
    return sum + value;
  }, 0);
  return clamp(weighted / evidence.length);
}

export function hasFreshPrimaryEvidence(evidence: HotspotEvidenceRecord[]): boolean {
  return evidence.some((item) => item.sourceKey === "twitter-api" && item.isFreshEvidence);
}

export function getHotspotCandidateState(evidence: HotspotEvidenceRecord[]): HotspotCandidateState {
  return evidence.some((item) => item.isFreshEvidence) ? "fresh_hotspot_candidate" : "stale_or_unknown_date_candidate";
}
