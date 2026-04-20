export type MonitorMode = "keyword" | "topic";
export type SourceKind = "search" | "social" | "structured" | "custom";
export type NotificationLevel = "high" | "medium" | "low";
export type NotifyChannel = "inbox" | "email";
export type ScanTrigger = "manual" | "scheduled" | "api";
export type EvidenceFamily = "search_discovery" | "social" | "community" | "official";
export type FreshnessState = "fresh" | "stale" | "unknown";
export type HotspotCandidateState = "fresh_hotspot_candidate" | "stale_or_unknown_date_candidate";
export type HotspotSort = "heat" | "relevance" | "published" | "discovered" | "importance";
export type HotspotTimeRange = "1h" | "6h" | "24h" | "7d" | "all";

export interface MonitorRecord {
  id: string;
  label: string;
  query: string;
  mode: MonitorMode;
  aliases: string[];
  checkIntervalMinutes: number;
  minRelevanceScore: number;
  notifyEmail: boolean;
  notifyInApp: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourceRecord {
  id: string;
  key: string;
  label: string;
  kind: SourceKind;
  enabled: boolean;
  config: Record<string, unknown>;
  lastStatus: "idle" | "ok" | "error";
  lastRunAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDocument {
  sourceKey: string;
  sourceLabel: string;
  sourceKind: SourceKind;
  externalId: string;
  title: string;
  url: string;
  snippet: string;
  content: string;
  author: string | null;
  publishedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface AIAnalysisResult {
  isRelevant: boolean;
  relevanceScore: number;
  credibilityRisk: number;
  noveltyScore: number;
  summary: string;
  reasoning: string;
  suggestedNotify: NotificationLevel;
}

export interface HotspotEvidenceRecord {
  sourceKey: string;
  sourceLabel: string;
  evidenceFamily: EvidenceFamily;
  discoverySource: string;
  url: string;
  title: string;
  snippet: string;
  author: string | null;
  publishedAt: string | null;
  freshnessState: FreshnessState;
  isFreshEvidence: boolean;
  weight: number;
  qualityScore: number;
}

export interface HotspotView {
  id: string;
  fingerprint: string;
  title: string;
  canonicalUrl: string;
  summary: string;
  notifyLevel: NotificationLevel;
  relevanceScore: number;
  credibilityRisk: number;
  noveltyScore: number;
  freshnessScore: number;
  heatScore: number;
  sourceDiversityScore: number;
  sourceAuthorityScore: number;
  sourceReliabilityScore: number;
  velocityScore: number;
  finalScore: number;
  evidenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestPublishedAt: string | null;
  notified: boolean;
  hasFreshPrimaryEvidence: boolean;
  candidateState: HotspotCandidateState;
  monitorLabels: string[];
  evidence: HotspotEvidenceRecord[];
}

export interface HotspotListQuery {
  sort: HotspotSort;
  sources: string[];
  levels: NotificationLevel[];
  monitors: string[];
  timeRange: HotspotTimeRange;
}

export interface NotificationView {
  id: string;
  hotspotId: string | null;
  channel: NotifyChannel;
  level: NotificationLevel;
  status: "sent" | "queued" | "skipped" | "failed";
  recipient: string | null;
  subject: string;
  body: string;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface ScanRunView {
  id: string;
  trigger: ScanTrigger;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  summary: {
    candidates: number;
    hotspots: number;
    notifications: number;
  };
  errorMessage: string | null;
}

export interface DashboardData {
  monitors: MonitorRecord[];
  sources: SourceRecord[];
  hotspots: HotspotView[];
  notifications: NotificationView[];
  recentRuns: ScanRunView[];
  env: {
    hasOpenRouter: boolean;
    hasTwitterApi: boolean;
    hasEmail: boolean;
  };
}
