import { analyzeCandidate } from "@/core/ai/openrouter";
import { buildHotspotFingerprint, computeScores } from "@/core/analysis/scoring";
import type { CandidateDocument, HotspotEvidenceRecord, HotspotView, MonitorRecord, ScanTrigger, SourceRecord } from "@/core/contracts";
import { annotateCandidateFreshness, getDocumentFreshness } from "@/core/freshness";
import { getCandidateCanonicalUrl, getEvidenceFamily, getEvidenceIdentity, getEvidenceQuality } from "@/core/source-signals";
import { getDiscoveryPriority } from "@/core/source-signals";
import {
  completeScanRun,
  createScanRun,
  getDashboardData,
  insertCandidate,
  insertEvidence,
  listHotspots,
  listMonitors,
  listSources,
  setSourceHealth,
  upsertHotspot
} from "@/core/db";
import { dispatchHotspotNotifications } from "@/core/notifications";
import { getSourceAdapter } from "@/core/sources";
import { nowIso } from "@/core/utils";

interface PendingHotspot {
  title: string;
  canonicalUrl: string;
  summary: string;
  analyses: number[];
  risk: number[];
  novelty: number[];
  reasonings: string[];
  credibilityReasonings: string[];
  evidence: Map<string, HotspotEvidenceRecord>;
  monitorLabels: string[];
  suggestedNotify: Array<HotspotView["notifyLevel"]>;
}

export interface ScanResultSummary {
  candidates: number;
  hotspots: number;
  notifications: number;
}

async function collectCandidatesForMonitor(monitor: MonitorRecord, availableSources: SourceRecord[]) {
  const candidates: Array<{ source: SourceRecord; documents: CandidateDocument[] }> = [];
  const orderedSources = [...availableSources].sort(
    (left, right) => getDiscoveryPriority(right.key, right.config) - getDiscoveryPriority(left.key, left.config)
  );
  for (const source of orderedSources) {
    const adapter = getSourceAdapter(source.key);
    if (!adapter) continue;
    try {
      const documents = (await adapter.fetch({ monitor, source })).map((document) => annotateCandidateFreshness(document, source));
      candidates.push({ source, documents });
      await setSourceHealth(source.key, "ok", null);
    } catch (error) {
      await setSourceHealth(source.key, "error", error instanceof Error ? error.message : "Unknown source error");
    }
  }
  return candidates;
}

export async function runScanCycle(trigger: ScanTrigger): Promise<ScanResultSummary> {
  const run = await createScanRun(trigger);
  const enabledMonitors = (await listMonitors()).filter((item) => item.enabled);
  const enabledSources = (await listSources()).filter((item) => item.enabled);

  const summary: ScanResultSummary = {
    candidates: 0,
    hotspots: 0,
    notifications: 0
  };

  try {
    const buckets = new Map<string, PendingHotspot>();

    for (const monitor of enabledMonitors) {
      const sourceDocuments = await collectCandidatesForMonitor(monitor, enabledSources);
      for (const { source, documents } of sourceDocuments) {
        for (const document of documents) {
          const freshness = getDocumentFreshness(document);
          summary.candidates += 1;
          const persistedCandidate = await insertCandidate(source.id, {
            externalId: document.externalId,
            title: document.title,
            url: document.url,
            snippet: document.snippet,
            content: document.content,
            author: document.author,
            publishedAt: document.publishedAt,
            metadata: document.metadata
          });

          const analysis = await analyzeCandidate({
            query: monitor.query,
            title: document.title,
            body: document.content || document.snippet || document.title,
            sourceLabel: source.label,
            url: document.url
          });

          if (!analysis.isRelevant || analysis.relevanceScore < monitor.minRelevanceScore) {
            continue;
          }

          const fingerprint = buildHotspotFingerprint(document, monitor.query);
          const evidence: HotspotEvidenceRecord = {
            sourceKey: document.sourceKey,
            sourceLabel: document.sourceLabel,
            evidenceFamily: getEvidenceFamily(document.sourceKey),
            discoverySource: String(document.metadata.discoveryEngine ?? document.sourceKey),
            url: getCandidateCanonicalUrl(document),
            title: document.title,
            snippet: document.snippet,
            author: document.author,
            publishedAt: document.publishedAt,
            capturedAt: nowIso(),
            freshnessState: freshness.freshnessState,
            isFreshEvidence: freshness.isFresh,
            weight: 1,
            qualityScore: getEvidenceQuality(document),
            interactionMetrics:
              (document.metadata.tweetMetrics as HotspotEvidenceRecord["interactionMetrics"] | undefined) ??
              (document.metadata.interactionMetrics as HotspotEvidenceRecord["interactionMetrics"] | undefined) ??
              null,
            authorSignals: (document.metadata.authorSignals as HotspotEvidenceRecord["authorSignals"] | undefined) ?? null
          };

          const pending = buckets.get(fingerprint) ?? {
            title: document.title,
            canonicalUrl: getCandidateCanonicalUrl(document),
            summary: analysis.summary,
            analyses: [],
            risk: [],
            novelty: [],
            reasonings: [],
            credibilityReasonings: [],
            evidence: new Map<string, HotspotEvidenceRecord>(),
            monitorLabels: [],
            suggestedNotify: []
          };

          pending.title = pending.title.length >= document.title.length ? pending.title : document.title;
          pending.canonicalUrl = pending.canonicalUrl || getCandidateCanonicalUrl(document);
          pending.summary = pending.summary.length >= analysis.summary.length ? pending.summary : analysis.summary;
          pending.analyses.push(analysis.relevanceScore);
          pending.risk.push(analysis.credibilityRisk);
          pending.novelty.push(analysis.noveltyScore);
          pending.reasonings.push(analysis.reasoning);
          pending.credibilityReasonings.push(analysis.credibilityReasoning);
          const evidenceIdentity = getEvidenceIdentity(evidence);
          const existingEvidence = pending.evidence.get(evidenceIdentity);
          if (!existingEvidence || evidence.qualityScore > existingEvidence.qualityScore) {
            pending.evidence.set(evidenceIdentity, evidence);
          }
          pending.monitorLabels = [...new Set([...pending.monitorLabels, monitor.label])];
          pending.suggestedNotify.push(analysis.suggestedNotify);
          buckets.set(fingerprint, pending);

          await insertEvidence(
            await upsertHotspot({
              fingerprint,
              title: pending.title,
              canonicalUrl: pending.canonicalUrl,
              summary: pending.summary,
              notifyLevel: "low",
              relevanceScore: 0,
              credibilityRisk: 100,
              noveltyScore: 0,
              sourceDiversityScore: 0,
              sourceAuthorityScore: 0,
              sourceReliabilityScore: 0,
              velocityScore: 0,
              finalScore: 0,
              monitorLabels: pending.monitorLabels,
              evidenceCount: pending.evidence.size,
              metadata: {
                provisional: true,
                rawSnippet: document.snippet,
                reasoning: analysis.reasoning,
                credibilityReasoning: analysis.credibilityReasoning,
                freshnessScore: freshness.isFresh ? 100 : freshness.freshnessState === "unknown" ? 36 : 18,
                hasFreshPrimaryEvidence: document.sourceKey === "twitter-api" && freshness.isFresh,
                candidateState: freshness.isFresh ? "fresh_hotspot_candidate" : "stale_or_unknown_date_candidate",
                lastProcessedAt: nowIso()
              }
            }),
            persistedCandidate.id,
            evidence
          );
        }
      }
    }

    for (const [fingerprint, pending] of buckets) {
      const avg = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
      const evidenceList = [...pending.evidence.values()];
      const scores = computeScores({
        analysis: {
          isRelevant: true,
          relevanceScore: avg(pending.analyses),
          credibilityRisk: avg(pending.risk),
          noveltyScore: avg(pending.novelty),
          summary: pending.summary,
          reasoning: pending.reasonings.sort((left, right) => right.length - left.length)[0] ?? "Merged multi-source evidence",
          credibilityReasoning:
            pending.credibilityReasonings.sort((left, right) => right.length - left.length)[0] ?? "Merged multi-source credibility evidence",
          suggestedNotify: pending.suggestedNotify.includes("high") ? "high" : pending.suggestedNotify.includes("medium") ? "medium" : "low"
        },
        evidence: evidenceList
      });

      await upsertHotspot({
        fingerprint,
        title: pending.title,
        canonicalUrl: pending.canonicalUrl,
        summary: pending.summary,
        notifyLevel: scores.notifyLevel,
        relevanceScore: avg(pending.analyses),
        credibilityRisk: avg(pending.risk),
        noveltyScore: avg(pending.novelty),
        sourceDiversityScore: scores.sourceDiversityScore,
        sourceAuthorityScore: scores.sourceAuthorityScore,
        sourceReliabilityScore: scores.sourceReliabilityScore,
        velocityScore: scores.velocityScore,
        finalScore: scores.finalScore,
        monitorLabels: pending.monitorLabels,
        evidenceCount: evidenceList.length,
        metadata: {
          evidenceSources: [...new Set(evidenceList.map((item) => item.sourceKey))],
          evidenceFamilies: [...new Set(evidenceList.map((item) => item.evidenceFamily))],
          rawSnippet: evidenceList.find((item) => item.snippet.trim().length > 0)?.snippet ?? null,
          reasoning: pending.reasonings.sort((left, right) => right.length - left.length)[0] ?? null,
          credibilityReasoning: pending.credibilityReasonings.sort((left, right) => right.length - left.length)[0] ?? null,
          freshnessScore: scores.freshnessScore,
          hasFreshPrimaryEvidence: scores.hasFreshPrimaryEvidence,
          candidateState: scores.candidateState,
          mergedAt: nowIso()
        }
      });
      summary.hotspots += 1;
    }

    const allHotspots = await listHotspots();
    for (const hotspot of allHotspots.filter((item) => item.notifyLevel !== "low" && !item.notified)) {
      summary.notifications += await dispatchHotspotNotifications(hotspot);
    }

    await completeScanRun(run.id, "completed", summary, null);
    return summary;
  } catch (error) {
    await completeScanRun(run.id, "failed", summary, error instanceof Error ? error.message : "Unknown scan error");
    throw error;
  }
}

export async function getDashboardSnapshot() {
  return getDashboardData();
}
