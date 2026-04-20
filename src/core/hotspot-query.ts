import type { HotspotListQuery, HotspotSort, HotspotTimeRange, HotspotView, NotificationLevel } from "@/core/contracts";

type QueryMode = "dashboard" | "all";
type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

const sortValues: HotspotSort[] = ["heat", "relevance", "published", "discovered", "importance"];
const timeRangeValues: HotspotTimeRange[] = ["1h", "6h", "24h", "7d", "all"];
const levelValues: NotificationLevel[] = ["high", "medium", "low"];
const importanceRank: Record<NotificationLevel, number> = {
  high: 3,
  medium: 2,
  low: 1
};

const timeRangeToMs: Record<Exclude<HotspotTimeRange, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function clampPage(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function isSort(value: string): value is HotspotSort {
  return sortValues.includes(value as HotspotSort);
}

function isTimeRange(value: string): value is HotspotTimeRange {
  return timeRangeValues.includes(value as HotspotTimeRange);
}

function isLevel(value: string): value is NotificationLevel {
  return levelValues.includes(value as NotificationLevel);
}

function readValues(input: SearchParamsLike, key: string) {
  if (input instanceof URLSearchParams) {
    return input.getAll(key);
  }

  const raw = input[key];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function splitCsv(values: string[]) {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function compareDateDesc(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : Number.NEGATIVE_INFINITY;
  const rightTime = right ? new Date(right).getTime() : Number.NEGATIVE_INFINITY;
  return rightTime - leftTime;
}

function fallbackCompare(left: HotspotView, right: HotspotView) {
  return compareDateDesc(left.lastSeenAt, right.lastSeenAt) || compareDateDesc(left.firstSeenAt, right.firstSeenAt);
}

export function getDefaultHotspotListQuery(mode: QueryMode = "dashboard"): HotspotListQuery {
  if (mode === "all") {
    return {
      sort: "importance",
      sources: [],
      levels: [],
      monitors: [],
      timeRange: "all",
      page: 1
    };
  }

  return {
    sort: "importance",
    sources: [],
    levels: ["high", "medium"],
    monitors: [],
    timeRange: "24h",
    page: 1
  };
}

export function normalizeHotspotListQuery(input: Partial<HotspotListQuery> = {}, mode: QueryMode = "dashboard"): HotspotListQuery {
  const defaults = getDefaultHotspotListQuery(mode);
  const normalizedLevels = [...new Set((input.levels ?? defaults.levels).filter(isLevel))].sort(
    (left, right) => levelValues.indexOf(left) - levelValues.indexOf(right)
  );

  return {
    sort: input.sort && isSort(input.sort) ? input.sort : defaults.sort,
    sources: [...new Set((input.sources ?? []).map((value) => value.trim()).filter(Boolean))],
    levels: normalizedLevels,
    monitors: [...new Set((input.monitors ?? []).map((value) => value.trim()).filter(Boolean))],
    timeRange: input.timeRange && isTimeRange(input.timeRange) ? input.timeRange : defaults.timeRange,
    page: clampPage(input.page ?? defaults.page)
  };
}

export function parseHotspotListQuery(input: SearchParamsLike, mode: QueryMode = "dashboard"): HotspotListQuery {
  const sort = splitCsv(readValues(input, "sort"))[0];
  const timeRange = splitCsv(readValues(input, "timeRange"))[0];
  const page = splitCsv(readValues(input, "page"))[0];
  const parsedLevels = splitCsv(readValues(input, "levels")).filter(isLevel);

  return normalizeHotspotListQuery(
    {
      sort: sort && isSort(sort) ? sort : undefined,
      sources: splitCsv(readValues(input, "sources")),
      levels: parsedLevels.length > 0 ? parsedLevels : undefined,
      monitors: splitCsv(readValues(input, "monitors")),
      timeRange: timeRange && isTimeRange(timeRange) ? timeRange : undefined,
      page: page ? Number(page) : undefined
    },
    mode
  );
}

export function buildHotspotQueryString(input: Partial<HotspotListQuery>, mode: QueryMode = "dashboard") {
  const query = normalizeHotspotListQuery(input, mode);
  const defaults = getDefaultHotspotListQuery(mode);
  const params = new URLSearchParams();

  if (query.sort !== defaults.sort) params.set("sort", query.sort);
  if (query.timeRange !== defaults.timeRange) params.set("timeRange", query.timeRange);
  if (query.sources.length > 0) params.set("sources", query.sources.join(","));
  if (query.monitors.length > 0) params.set("monitors", query.monitors.join(","));
  if (query.levels.join(",") !== defaults.levels.join(",")) params.set("levels", query.levels.join(","));
  if (query.page !== defaults.page) params.set("page", String(query.page));

  return params.toString();
}

export function getLatestPublishedAt(hotspot: Pick<HotspotView, "evidence">) {
  const published = hotspot.evidence.map((item) => item.publishedAt).filter((value): value is string => Boolean(value));
  if (published.length === 0) return null;

  return [...published].sort((left, right) => compareDateDesc(left, right))[0];
}

export function computeHotspotHeatScore(
  hotspot: Pick<
    HotspotView,
    | "evidence"
    | "evidenceCount"
    | "sourceDiversityScore"
    | "sourceReliabilityScore"
    | "sourceAuthorityScore"
    | "velocityScore"
    | "freshnessScore"
  >
) {
  const evidenceQualityAverage =
    hotspot.evidence.length === 0
      ? 0
      : hotspot.evidence.reduce((sum, item) => sum + item.qualityScore, 0) / hotspot.evidence.length;
  const socialEvidence = hotspot.evidence.filter((item) => item.evidenceFamily === "social");
  const socialQualityAverage =
    socialEvidence.length === 0 ? 0 : socialEvidence.reduce((sum, item) => sum + item.qualityScore, 0) / socialEvidence.length;
  const evidenceCountBoost = hotspot.evidenceCount >= 5 ? 12 : hotspot.evidenceCount >= 3 ? 8 : hotspot.evidenceCount >= 2 ? 4 : 0;

  const score =
    hotspot.velocityScore * 0.28 +
    hotspot.sourceDiversityScore * 0.16 +
    hotspot.sourceReliabilityScore * 0.18 +
    hotspot.sourceAuthorityScore * 0.12 +
    hotspot.freshnessScore * 0.1 +
    evidenceQualityAverage * 0.1 +
    socialQualityAverage * 0.06 +
    evidenceCountBoost;

  return clamp(Math.round(score));
}

function decorateHotspot(hotspot: HotspotView): HotspotView {
  const latestPublishedAt = hotspot.latestPublishedAt ?? getLatestPublishedAt(hotspot);
  const heatScore = hotspot.heatScore > 0 ? hotspot.heatScore : computeHotspotHeatScore(hotspot);
  return {
    ...hotspot,
    latestPublishedAt,
    heatScore
  };
}

function matchesTimeRange(hotspot: HotspotView, timeRange: HotspotTimeRange, now: number) {
  if (timeRange === "all") return true;
  const seenAt = new Date(hotspot.firstSeenAt).getTime();
  if (Number.isNaN(seenAt)) return false;
  return now - seenAt <= timeRangeToMs[timeRange];
}

function sortHotspots(left: HotspotView, right: HotspotView, sort: HotspotSort) {
  switch (sort) {
    case "heat":
      return right.heatScore - left.heatScore || right.velocityScore - left.velocityScore || fallbackCompare(left, right);
    case "relevance":
      return right.relevanceScore - left.relevanceScore || right.finalScore - left.finalScore || fallbackCompare(left, right);
    case "published":
      return compareDateDesc(left.latestPublishedAt, right.latestPublishedAt) || fallbackCompare(left, right);
    case "discovered":
      return compareDateDesc(left.firstSeenAt, right.firstSeenAt) || right.finalScore - left.finalScore;
    case "importance":
    default:
      return (
        importanceRank[right.notifyLevel] - importanceRank[left.notifyLevel] ||
        right.finalScore - left.finalScore ||
        right.freshnessScore - left.freshnessScore ||
        fallbackCompare(left, right)
      );
  }
}

export function applyHotspotListQuery(
  hotspots: HotspotView[],
  input: Partial<HotspotListQuery> = {},
  mode: QueryMode = "dashboard"
) {
  const query = normalizeHotspotListQuery(input, mode);
  const now = Date.now();

  return hotspots
    .map(decorateHotspot)
    .filter((hotspot) => {
      if (query.sources.length > 0 && !hotspot.evidence.some((item) => query.sources.includes(item.sourceKey))) {
        return false;
      }

      if (query.levels.length > 0 && !query.levels.includes(hotspot.notifyLevel)) {
        return false;
      }

      if (query.monitors.length > 0 && !hotspot.monitorLabels.some((label) => query.monitors.includes(label))) {
        return false;
      }

      return matchesTimeRange(hotspot, query.timeRange, now);
    })
    .sort((left, right) => sortHotspots(left, right, query.sort));
}
