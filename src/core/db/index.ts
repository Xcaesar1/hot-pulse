import { and, desc, eq } from "drizzle-orm";
import type {
  AuthorSignals,
  DashboardData,
  FreshnessState,
  HotspotListQuery,
  HotspotEvidenceRecord,
  HotspotView,
  InteractionMetrics,
  MonitorRecord,
  NotificationLevel,
  NotificationView,
  ScanRunView,
  ScanTrigger,
  SourceRecord
} from "@/core/contracts";
import { getEnvFlags } from "@/core/config";
import { evaluateFreshness } from "@/core/freshness";
import { applyHotspotListQuery, computeHotspotHeatScore, getLatestPublishedAt } from "@/core/hotspot-query";
import { ensureBootstrap, getDbBundle } from "@/core/db/client";
import { bootstrapDatabase } from "@/core/db/bootstrap";
import { candidateDocuments, hotspotEvidences, hotspots, monitors, notifications, scanRuns, sources } from "@/core/db/schema";
import { createId, hashString, normalizeText, nowIso, safeJsonParse, toJson } from "@/core/utils";

async function ready() {
  await ensureBootstrap(bootstrapDatabase);
  return getDbBundle().db;
}

function mapMonitor(row: typeof monitors.$inferSelect): MonitorRecord {
  return {
    id: row.id,
    label: normalizeText(row.label),
    query: normalizeText(row.query),
    mode: row.mode as MonitorRecord["mode"],
    aliases: safeJsonParse<string[]>(row.aliases, []).map((item) => normalizeText(item)),
    checkIntervalMinutes: row.checkIntervalMinutes,
    minRelevanceScore: row.minRelevanceScore,
    notifyEmail: row.notifyEmail,
    notifyInApp: row.notifyInApp,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapSource(row: typeof sources.$inferSelect): SourceRecord {
  return {
    id: row.id,
    key: row.key,
    label: normalizeText(row.label),
    kind: row.kind as SourceRecord["kind"],
    enabled: row.enabled,
    config: safeJsonParse(row.config, {}),
    lastStatus: row.lastStatus as SourceRecord["lastStatus"],
    lastRunAt: row.lastRunAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseInteractionMetrics(input: unknown): InteractionMetrics | null {
  if (!input || typeof input !== "object") return null;
  const metrics = input as Record<string, unknown>;
  const normalized: InteractionMetrics = {};

  for (const key of ["likes", "reposts", "replies", "quotes", "views", "comments", "upvotes", "score"] as const) {
    const value = Number(metrics[key]);
    if (Number.isFinite(value) && value > 0) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function parseAuthorSignals(input: unknown): AuthorSignals | null {
  if (!input || typeof input !== "object") return null;
  const author = input as Record<string, unknown>;
  const normalized: AuthorSignals = {};

  if (typeof author.trustedAccount === "boolean") normalized.trustedAccount = author.trustedAccount;
  if (typeof author.isBlueVerified === "boolean") normalized.isBlueVerified = author.isBlueVerified;
  if (typeof author.verifiedType === "string" || author.verifiedType === null) normalized.verifiedType = author.verifiedType as string | null;
  if (Number.isFinite(Number(author.followers)) && Number(author.followers) > 0) normalized.followers = Number(author.followers);

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export async function listMonitors(): Promise<MonitorRecord[]> {
  const db = await ready();
  return (await db.select().from(monitors).orderBy(desc(monitors.updatedAt))).map(mapMonitor);
}

export async function createMonitor(input: Pick<MonitorRecord, "label" | "query" | "mode" | "aliases" | "notifyEmail" | "notifyInApp" | "minRelevanceScore">) {
  const db = await ready();
  const timestamp = nowIso();
  const row = {
    id: createId("mon"),
    label: input.label,
    query: input.query,
    mode: input.mode,
    aliases: toJson(input.aliases),
    checkIntervalMinutes: 30,
    minRelevanceScore: input.minRelevanceScore,
    notifyEmail: input.notifyEmail,
    notifyInApp: input.notifyInApp,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await db.insert(monitors).values(row);
  return mapMonitor(row);
}

export async function updateMonitor(id: string, patch: Partial<Omit<MonitorRecord, "id" | "createdAt">>) {
  const db = await ready();
  await db
    .update(monitors)
    .set({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.query !== undefined ? { query: patch.query } : {}),
      ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
      ...(patch.aliases !== undefined ? { aliases: toJson(patch.aliases) } : {}),
      ...(patch.checkIntervalMinutes !== undefined ? { checkIntervalMinutes: patch.checkIntervalMinutes } : {}),
      ...(patch.minRelevanceScore !== undefined ? { minRelevanceScore: patch.minRelevanceScore } : {}),
      ...(patch.notifyEmail !== undefined ? { notifyEmail: patch.notifyEmail } : {}),
      ...(patch.notifyInApp !== undefined ? { notifyInApp: patch.notifyInApp } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      updatedAt: nowIso()
    })
    .where(eq(monitors.id, id));
}

export async function listSources(): Promise<SourceRecord[]> {
  const db = await ready();
  return (await db.select().from(sources).orderBy(sources.label)).map(mapSource);
}

export async function updateSource(id: string, patch: Partial<Omit<SourceRecord, "id" | "key" | "kind" | "createdAt">>) {
  const db = await ready();
  await db
    .update(sources)
    .set({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.config !== undefined ? { config: toJson(patch.config) } : {}),
      ...(patch.lastStatus !== undefined ? { lastStatus: patch.lastStatus } : {}),
      ...(patch.lastRunAt !== undefined ? { lastRunAt: patch.lastRunAt } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      updatedAt: nowIso()
    })
    .where(eq(sources.id, id));
}

export async function setSourceHealth(key: string, status: SourceRecord["lastStatus"], errorMessage: string | null) {
  const db = await ready();
  await db
    .update(sources)
    .set({
      lastStatus: status,
      lastRunAt: nowIso(),
      errorMessage,
      updatedAt: nowIso()
    })
    .where(eq(sources.key, key));
}

export async function insertCandidate(sourceId: string, document: {
  externalId: string;
  title: string;
  url: string;
  snippet: string;
  content: string;
  author: string | null;
  publishedAt: string | null;
  metadata: Record<string, unknown>;
}) {
  const db = await ready();
  const timestamp = nowIso();
  const id = createId("cand");
  const hash = hashString(`${sourceId}:${document.externalId}:${document.url}`);
  await db
    .insert(candidateDocuments)
    .values({
      id,
      sourceId,
      externalId: document.externalId,
      title: document.title,
      url: document.url,
      snippet: document.snippet,
      content: document.content,
      author: document.author,
      publishedAt: document.publishedAt,
      hash,
      metadata: toJson(document.metadata),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: [candidateDocuments.sourceId, candidateDocuments.externalId],
      set: {
        title: document.title,
        url: document.url,
        snippet: document.snippet,
        content: document.content,
        author: document.author,
        publishedAt: document.publishedAt,
        hash,
        metadata: toJson(document.metadata),
        updatedAt: timestamp
      }
    });

  const rows = await db
    .select()
    .from(candidateDocuments)
    .where(and(eq(candidateDocuments.sourceId, sourceId), eq(candidateDocuments.externalId, document.externalId)))
    .limit(1);
  return rows[0];
}

export async function upsertHotspot(payload: {
  fingerprint: string;
  title: string;
  canonicalUrl: string;
  summary: string;
  notifyLevel: NotificationLevel;
  relevanceScore: number;
  credibilityRisk: number;
  noveltyScore: number;
  sourceDiversityScore: number;
  sourceAuthorityScore: number;
  sourceReliabilityScore: number;
  velocityScore: number;
  finalScore: number;
  monitorLabels: string[];
  evidenceCount: number;
  metadata: Record<string, unknown>;
}) {
  const db = await ready();
  const timestamp = nowIso();
  const existing = await db.select().from(hotspots).where(eq(hotspots.fingerprint, payload.fingerprint)).limit(1);
  if (existing[0]) {
    await db
      .update(hotspots)
      .set({
        title: payload.title,
        canonicalUrl: payload.canonicalUrl,
        summary: payload.summary,
        notifyLevel: payload.notifyLevel,
        relevanceScore: payload.relevanceScore,
        credibilityRisk: payload.credibilityRisk,
        noveltyScore: payload.noveltyScore,
        sourceDiversityScore: payload.sourceDiversityScore,
        sourceAuthorityScore: payload.sourceAuthorityScore,
        sourceReliabilityScore: payload.sourceReliabilityScore,
        velocityScore: payload.velocityScore,
        finalScore: payload.finalScore,
        evidenceCount: payload.evidenceCount,
        monitorLabels: toJson(payload.monitorLabels),
        metadata: toJson(payload.metadata),
        lastSeenAt: timestamp
      })
      .where(eq(hotspots.id, existing[0].id));
    return existing[0].id;
  }

  const id = createId("hot");
  await db.insert(hotspots).values({
    id,
    fingerprint: payload.fingerprint,
    title: payload.title,
    canonicalUrl: payload.canonicalUrl,
    summary: payload.summary,
    notifyLevel: payload.notifyLevel,
    relevanceScore: payload.relevanceScore,
    credibilityRisk: payload.credibilityRisk,
    noveltyScore: payload.noveltyScore,
    sourceDiversityScore: payload.sourceDiversityScore,
    sourceAuthorityScore: payload.sourceAuthorityScore,
    sourceReliabilityScore: payload.sourceReliabilityScore,
    velocityScore: payload.velocityScore,
    finalScore: payload.finalScore,
    evidenceCount: payload.evidenceCount,
    notified: false,
    monitorLabels: toJson(payload.monitorLabels),
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    metadata: toJson(payload.metadata)
  });
  return id;
}

export async function markHotspotNotified(id: string) {
  const db = await ready();
  await db.update(hotspots).set({ notified: true, lastSeenAt: nowIso() }).where(eq(hotspots.id, id));
}

export async function insertEvidence(hotspotId: string, candidateId: string, evidence: HotspotEvidenceRecord) {
  const db = await ready();
  await db
    .insert(hotspotEvidences)
    .values({
      id: createId("evi"),
      hotspotId,
      candidateId,
      sourceKey: evidence.sourceKey,
      sourceLabel: evidence.sourceLabel,
      evidenceFamily: evidence.evidenceFamily,
      discoverySource: evidence.discoverySource,
      url: evidence.url,
      title: evidence.title,
      snippet: evidence.snippet,
      author: evidence.author,
      publishedAt: evidence.publishedAt,
      weight: evidence.weight,
      qualityScore: evidence.qualityScore
    })
    .onConflictDoNothing();
}

export async function listHotspots(query?: Partial<HotspotListQuery>, mode: "dashboard" | "all" = "all"): Promise<HotspotView[]> {
  const db = await ready();
  const hotspotRows = await db.select().from(hotspots).orderBy(desc(hotspots.lastSeenAt));
  const evidenceRows = await db.select().from(hotspotEvidences);
  const candidateRows = await db.select().from(candidateDocuments);
  const candidateMap = new Map(candidateRows.map((row) => [row.id, row]));

  const mappedRows = hotspotRows.map((row) => {
    const metadata = safeJsonParse<Record<string, unknown>>(row.metadata, {});
    const mappedEvidence = evidenceRows
      .filter((item) => item.hotspotId === row.id)
      .map((item) => {
        const candidate = candidateMap.get(item.candidateId);
        const candidateMetadata = safeJsonParse<Record<string, unknown>>(candidate?.metadata ?? "{}", {});
        const freshness = evaluateFreshness(item.publishedAt);
        return {
          sourceKey: item.sourceKey,
          sourceLabel: normalizeText(item.sourceLabel),
          evidenceFamily: item.evidenceFamily as HotspotEvidenceRecord["evidenceFamily"],
          discoverySource: normalizeText(item.discoverySource),
          url: item.url,
          title: normalizeText(item.title),
          snippet: normalizeText(item.snippet),
          author: item.author ? normalizeText(item.author) : null,
          publishedAt: item.publishedAt,
          capturedAt: candidate?.createdAt ?? null,
          freshnessState: freshness.freshnessState as FreshnessState,
          isFreshEvidence: freshness.isFresh,
          weight: item.weight,
          qualityScore: item.qualityScore,
          interactionMetrics: parseInteractionMetrics(candidateMetadata.tweetMetrics ?? candidateMetadata.interactionMetrics),
          authorSignals: parseAuthorSignals(candidateMetadata.authorSignals)
        };
      });

    const latestPublishedAt = getLatestPublishedAt({ evidence: mappedEvidence });
    const hotspot: HotspotView = {
      id: row.id,
      fingerprint: row.fingerprint,
      title: normalizeText(row.title),
      canonicalUrl: row.canonicalUrl,
      summary: normalizeText(row.summary),
      rawSnippet: metadata.rawSnippet ? normalizeText(String(metadata.rawSnippet)) : mappedEvidence.find((item) => item.snippet.trim().length > 0)?.snippet ?? null,
      reasoning: metadata.reasoning ? normalizeText(String(metadata.reasoning)) : null,
      credibilityReasoning: metadata.credibilityReasoning ? normalizeText(String(metadata.credibilityReasoning)) : null,
      notifyLevel: row.notifyLevel as NotificationLevel,
      relevanceScore: row.relevanceScore,
      credibilityRisk: row.credibilityRisk,
      noveltyScore: row.noveltyScore,
      freshnessScore: Number(metadata.freshnessScore ?? 0),
      heatScore: 0,
      sourceDiversityScore: row.sourceDiversityScore,
      sourceAuthorityScore: row.sourceAuthorityScore,
      sourceReliabilityScore: row.sourceReliabilityScore,
      velocityScore: row.velocityScore,
      finalScore: row.finalScore,
      evidenceCount: row.evidenceCount,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      latestPublishedAt,
      notified: row.notified,
      hasFreshPrimaryEvidence: Boolean(metadata.hasFreshPrimaryEvidence ?? false),
      candidateState: (metadata.candidateState as HotspotView["candidateState"] | undefined) ?? "stale_or_unknown_date_candidate",
      monitorLabels: safeJsonParse<string[]>(row.monitorLabels, []).map((item) => normalizeText(item)),
      evidence: mappedEvidence
    };

    return {
      ...hotspot,
      heatScore: computeHotspotHeatScore(hotspot)
    };
  });

  return applyHotspotListQuery(mappedRows, query, mode);
}

export async function createNotification(payload: Omit<NotificationView, "id" | "createdAt">) {
  const db = await ready();
  const row = {
    id: createId("ntf"),
    hotspotId: payload.hotspotId,
    channel: payload.channel,
    level: payload.level,
    status: payload.status,
    recipient: payload.recipient,
    subject: payload.subject,
    body: payload.body,
    sentAt: payload.sentAt,
    errorMessage: payload.errorMessage,
    createdAt: nowIso()
  };
  await db.insert(notifications).values(row);
  return row;
}

export async function listNotifications(): Promise<NotificationView[]> {
  const db = await ready();
  return (await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100)).map((row) => ({
    id: row.id,
    hotspotId: row.hotspotId,
    channel: row.channel as NotificationView["channel"],
    level: row.level as NotificationLevel,
    status: row.status as NotificationView["status"],
    recipient: row.recipient,
    subject: normalizeText(row.subject),
    body: normalizeText(row.body),
    sentAt: row.sentAt,
    errorMessage: row.errorMessage ? normalizeText(row.errorMessage) : null,
    createdAt: row.createdAt
  }));
}

export async function createScanRun(trigger: ScanTrigger) {
  const db = await ready();
  const row = {
    id: createId("run"),
    trigger,
    status: "running" as const,
    startedAt: nowIso(),
    finishedAt: null,
    summary: toJson({ candidates: 0, hotspots: 0, notifications: 0 }),
    errorMessage: null
  };
  await db.insert(scanRuns).values(row);
  return row;
}

export async function completeScanRun(id: string, status: "completed" | "failed", summary: ScanRunView["summary"], errorMessage: string | null = null) {
  const db = await ready();
  await db
    .update(scanRuns)
    .set({
      status,
      summary: toJson(summary),
      errorMessage,
      finishedAt: nowIso()
    })
    .where(eq(scanRuns.id, id));
}

export async function listRecentRuns(): Promise<ScanRunView[]> {
  const db = await ready();
  return (await db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(20)).map((row) => ({
    id: row.id,
    trigger: row.trigger as ScanTrigger,
    status: row.status as ScanRunView["status"],
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    summary: safeJsonParse(row.summary, { candidates: 0, hotspots: 0, notifications: 0 }),
    errorMessage: row.errorMessage
  }));
}

export async function getSourceByKey(key: string) {
  const db = await ready();
  const rows = await db.select().from(sources).where(eq(sources.key, key)).limit(1);
  return rows[0] ? mapSource(rows[0]) : null;
}

export async function getDashboardData(hotspotQuery?: Partial<HotspotListQuery>): Promise<DashboardData> {
  const [monitorRows, sourceRows, hotspotRows, notificationRows, recentRuns] = await Promise.all([
    listMonitors(),
    listSources(),
    listHotspots(hotspotQuery, "dashboard"),
    listNotifications(),
    listRecentRuns()
  ]);
  return {
    monitors: monitorRows,
    sources: sourceRows,
    hotspots: hotspotRows,
    notifications: notificationRows,
    recentRuns,
    env: getEnvFlags()
  };
}
