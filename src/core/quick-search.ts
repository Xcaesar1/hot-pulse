import { analyzeCandidate, compareAnalysisStrength } from "@/core/ai/openrouter";
import { buildRelevancePrefilter } from "@/core/ai/relevance";
import { computeScores } from "@/core/analysis/scoring";
import { listSources } from "@/core/db";
import { annotateCandidateFreshness, getDocumentFreshness } from "@/core/freshness";
import { computeHotspotHeatScore, getLatestPublishedAt } from "@/core/hotspot-query";
import { getCandidateCanonicalUrl, getDiscoveryPriority, getEvidenceFamily, getEvidenceIdentity, getEvidenceQuality } from "@/core/source-signals";
import { getSourceAdapter } from "@/core/sources";
import type {
  AIAnalysisResult,
  HotspotEvidenceRecord,
  MonitorMode,
  MonitorRecord,
  QuickSearchResponse,
  QuickSearchResult,
  SourceRecord
} from "@/core/contracts";
import { createId, nowIso, uniqueStrings } from "@/core/utils";

const QUICK_SEARCH_MAX_RESULTS_PER_SOURCE = 3;
const QUICK_SEARCH_MAX_RESULTS = 12;
const QUICK_SEARCH_TOPIC_MIN_RELEVANCE = 50;
const TOPIC_SIGNALS = [
  /\?/,
  /？/,
  /\b(how|what|why|which|latest|recent|compare|comparison|best|ideas|trend|trends)\b/i,
  /(怎么|如何|哪些|有什么|最新|最近|对比|哪个好|推荐|有没有|帮我找|请问|趋势)/
];

interface PendingQuickResult {
  title: string;
  canonicalUrl: string;
  analyses: Array<{ analysis: AIAnalysisResult; evidenceQuality: number }>;
  evidence: Map<string, HotspotEvidenceRecord>;
  queryExpansionTerms: string[];
  capturedAt: string;
}

function pickBestAnalysis(reviews: Array<{ analysis: AIAnalysisResult; evidenceQuality: number }>) {
  return [...reviews].sort(
    (left, right) => compareAnalysisStrength(left.analysis, right.analysis) || right.evidenceQuality - left.evidenceQuality
  )[0]?.analysis;
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1));
}

function clampQuickSearchSource(source: SourceRecord): SourceRecord {
  const currentMaxResults = Number(source.config.maxResults ?? QUICK_SEARCH_MAX_RESULTS_PER_SOURCE);
  const maxResults =
    Number.isFinite(currentMaxResults) && currentMaxResults > 0
      ? Math.min(currentMaxResults, QUICK_SEARCH_MAX_RESULTS_PER_SOURCE)
      : QUICK_SEARCH_MAX_RESULTS_PER_SOURCE;

  return {
    ...source,
    config: {
      ...source.config,
      maxResults,
      requestDelayMs: Math.max(Number(source.config.requestDelayMs ?? 120), 120)
    }
  };
}

function buildTemporaryMonitor(query: string, mode: MonitorMode): MonitorRecord {
  return {
    id: createId("qmon"),
    label: query,
    query,
    mode,
    aliases: [],
    checkIntervalMinutes: 30,
    minRelevanceScore: mode === "keyword" ? 60 : QUICK_SEARCH_TOPIC_MIN_RELEVANCE,
    notifyEmail: false,
    notifyInApp: false,
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function isTopicLikeQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return true;
  if (TOPIC_SIGNALS.some((pattern) => pattern.test(normalized))) return true;

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasVersion = /\b\d+(?:\.\d+)+\b/.test(normalized);
  const hasSiteOrHandle = /(https?:\/\/|[@#])/.test(normalized);

  if (hasSiteOrHandle) return false;
  if (hasVersion) return false;
  if (tokenCount >= 5) return true;

  return false;
}

export function inferQuickSearchMode(query: string): MonitorMode {
  return isTopicLikeQuery(query) ? "topic" : "keyword";
}

function toQuickSearchResult(args: {
  query: string;
  mode: MonitorMode;
  capturedAt: string;
  pending: PendingQuickResult;
}): QuickSearchResult | null {
  const bestAnalysis = pickBestAnalysis(args.pending.analyses);
  if (!bestAnalysis) return null;

  const evidence = [...args.pending.evidence.values()];
  if (evidence.length === 0) return null;

  const relevanceValues = args.pending.analyses.map((item) => item.analysis.relevanceScore);
  const credibilityValues = args.pending.analyses.map((item) => item.analysis.credibilityRisk);
  const noveltyValues = args.pending.analyses.map((item) => item.analysis.noveltyScore);
  const scores = computeScores({
    analysis: {
      ...bestAnalysis,
      relevanceScore: average(relevanceValues),
      credibilityRisk: average(credibilityValues),
      noveltyScore: average(noveltyValues)
    },
    evidence,
    monitorMode: args.mode
  });

  const result: QuickSearchResult = {
    id: createId("qsr"),
    query: args.query,
    mode: args.mode,
    title: args.pending.title,
    canonicalUrl: args.pending.canonicalUrl,
    summary: bestAnalysis.summary,
    rawSnippet: evidence.find((item) => item.snippet.trim().length > 0)?.snippet ?? null,
    keywordMentioned: bestAnalysis.keywordMentioned,
    matchType: bestAnalysis.matchType,
    matchedTerms: uniqueStrings(bestAnalysis.matchedTerms),
    missingRequiredTerms: uniqueStrings(bestAnalysis.missingRequiredTerms),
    queryExpansionTerms: uniqueStrings(args.pending.queryExpansionTerms),
    whyRelevant: bestAnalysis.whyRelevant,
    whyNotRelevant: bestAnalysis.whyNotRelevant,
    reasoning: bestAnalysis.reasoning,
    credibilityReasoning: bestAnalysis.credibilityReasoning,
    relevanceScore: average(relevanceValues),
    credibilityRisk: average(credibilityValues),
    noveltyScore: average(noveltyValues),
    freshnessScore: scores.freshnessScore,
    heatScore: 0,
    sourceDiversityScore: scores.sourceDiversityScore,
    sourceAuthorityScore: scores.sourceAuthorityScore,
    sourceReliabilityScore: scores.sourceReliabilityScore,
    velocityScore: scores.velocityScore,
    finalScore: scores.finalScore,
    latestPublishedAt: getLatestPublishedAt({ evidence }),
    capturedAt: args.capturedAt,
    evidenceCount: evidence.length,
    hasFreshPrimaryEvidence: scores.hasFreshPrimaryEvidence,
    candidateState: scores.candidateState,
    evidence
  };

  return {
    ...result,
    heatScore: computeHotspotHeatScore(result)
  };
}

export async function runQuickSearch(query: string): Promise<QuickSearchResponse> {
  const normalizedQuery = query.trim();
  const mode = inferQuickSearchMode(normalizedQuery);
  const searchedAt = nowIso();
  const monitor = buildTemporaryMonitor(normalizedQuery, mode);
  const enabledSources = (await listSources())
    .filter((item) => item.enabled)
    .sort((left, right) => getDiscoveryPriority(right.key, right.config) - getDiscoveryPriority(left.key, left.config))
    .map(clampQuickSearchSource);

  const buckets = new Map<string, PendingQuickResult>();

  for (const source of enabledSources) {
    if (buckets.size >= QUICK_SEARCH_MAX_RESULTS) break;

    const adapter = getSourceAdapter(source.key);
    if (!adapter) continue;

    try {
      const documents = (await adapter.fetch({ monitor, source })).map((document) => annotateCandidateFreshness(document, source));

      for (const document of documents) {
        if (buckets.size >= QUICK_SEARCH_MAX_RESULTS) break;

        const prefilter = buildRelevancePrefilter({
          query: normalizedQuery,
          aliases: [],
          mode,
          document
        });

        if (mode === "keyword" && prefilter.strictReject) {
          continue;
        }

        const analysis = await analyzeCandidate({
          query: normalizedQuery,
          aliases: [],
          monitorMode: mode,
          expandedTerms: prefilter.expandedTerms,
          prefilter,
          title: document.title,
          body: document.content || document.snippet || document.title,
          sourceLabel: source.label,
          url: document.url
        });

        const strictKeywordFilter =
          mode === "keyword" &&
          (!analysis.keywordMentioned && analysis.relevanceScore < 75
            ? true
            : analysis.matchType === "none"
              ? true
              : (analysis.matchType === "adjacent" || analysis.matchType === "weak") && analysis.relevanceScore < 85);
        const effectiveMinRelevance = mode === "keyword" ? 60 : QUICK_SEARCH_TOPIC_MIN_RELEVANCE;

        if (!analysis.isRelevant || analysis.relevanceScore < effectiveMinRelevance || strictKeywordFilter) {
          continue;
        }

        const freshness = getDocumentFreshness(document);
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
          capturedAt: searchedAt,
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

        const fingerprint = `${normalizedQuery.toLowerCase()}::${getCandidateCanonicalUrl(document).toLowerCase()}`;
        const pending = buckets.get(fingerprint) ?? {
          title: document.title,
          canonicalUrl: getCandidateCanonicalUrl(document),
          analyses: [],
          evidence: new Map<string, HotspotEvidenceRecord>(),
          queryExpansionTerms: prefilter.expandedTerms,
          capturedAt: searchedAt
        };

        pending.title = pending.title.length >= document.title.length ? pending.title : document.title;
        pending.canonicalUrl = pending.canonicalUrl || getCandidateCanonicalUrl(document);
        pending.queryExpansionTerms = uniqueStrings([...pending.queryExpansionTerms, ...prefilter.expandedTerms]);
        pending.analyses.push({ analysis, evidenceQuality: evidence.qualityScore });
        const evidenceIdentity = getEvidenceIdentity(evidence);
        const existingEvidence = pending.evidence.get(evidenceIdentity);
        if (!existingEvidence || evidence.qualityScore > existingEvidence.qualityScore) {
          pending.evidence.set(evidenceIdentity, evidence);
        }

        buckets.set(fingerprint, pending);
      }
    } catch {
      continue;
    }
  }

  const results = [...buckets.values()]
    .map((pending) =>
      toQuickSearchResult({
        query: normalizedQuery,
        mode,
        capturedAt: searchedAt,
        pending
      })
    )
    .filter((item): item is QuickSearchResult => Boolean(item))
    .sort((left, right) => right.finalScore - left.finalScore || right.heatScore - left.heatScore)
    .slice(0, QUICK_SEARCH_MAX_RESULTS);

  return {
    query: normalizedQuery,
    mode,
    searchedAt,
    sourceCount: enabledSources.length,
    results
  };
}
