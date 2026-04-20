import { analyzeCandidate } from "@/core/ai/openrouter";
import { buildHotspotFingerprint, computeScores } from "@/core/analysis/scoring";
import type { CandidateDocument, HotspotEvidenceRecord, HotspotView, MonitorRecord, ScanTrigger, SourceRecord } from "@/core/contracts";
import { getCandidateCanonicalUrl, getEvidenceFamily, getEvidenceIdentity, getEvidenceQuality } from "@/core/source-signals";
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
  for (const source of availableSources) {
    const adapter = getSourceAdapter(source.key);
    if (!adapter) continue;
    try {
      const documents = await adapter.fetch({ monitor, source });
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
            weight: 1,
            qualityScore: getEvidenceQuality(document)
          };

          const pending = buckets.get(fingerprint) ?? {
            title: document.title,
            canonicalUrl: getCandidateCanonicalUrl(document),
            summary: analysis.summary,
            analyses: [],
            risk: [],
            novelty: [],
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
          reasoning: "Merged multi-source evidence",
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
