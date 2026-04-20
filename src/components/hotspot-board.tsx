"use client";

import { useMemo, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, ExternalLink, Filter, Flame, Layers3, RadioTower, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { HotspotListQuery, HotspotSort, HotspotTimeRange, HotspotView, MonitorRecord, NotificationLevel, SourceRecord } from "@/core/contracts";
import { buildHotspotQueryString, getDefaultHotspotListQuery, normalizeHotspotListQuery } from "@/core/hotspot-query";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";

const levelStyles: Record<NotificationLevel, string> = {
  high: "border-amber-300/30 bg-amber-300/14 text-amber-100",
  medium: "border-cyan-300/25 bg-cyan-300/12 text-cyan-100",
  low: "border-white/14 bg-white/6 text-slate-200"
};

const sortLabels: Record<HotspotSort, string> = {
  heat: "热度综合",
  relevance: "相关性",
  published: "最新发布",
  discovered: "最新发现",
  importance: "重要程度"
};

const timeRangeLabels: Record<HotspotTimeRange, string> = {
  "1h": "最近 1 小时",
  "6h": "最近 6 小时",
  "24h": "最近 24 小时",
  "7d": "最近 7 天",
  all: "全部"
};

export function HotspotBoard({
  hotspots,
  sources,
  monitors,
  query
}: {
  hotspots: HotspotView[];
  sources: SourceRecord[];
  monitors: MonitorRecord[];
  query: HotspotListQuery;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const sourceOptions = useMemo(
    () =>
      sources
        .map((source) => ({ value: source.key, label: source.label }))
        .sort((left, right) => left.label.localeCompare(right.label, "zh-CN")),
    [sources]
  );

  const monitorOptions = useMemo(() => {
    const labels = new Set(monitors.map((item) => item.label));
    for (const hotspot of hotspots) {
      for (const label of hotspot.monitorLabels) labels.add(label);
    }
    return [...labels].sort((left, right) => left.localeCompare(right, "zh-CN"));
  }, [hotspots, monitors]);

  const sourceLabelMap = useMemo(
    () => new Map(sourceOptions.map((option) => [option.value, option.label])),
    [sourceOptions]
  );

  const activeTags = useMemo(() => {
    const defaults = getDefaultHotspotListQuery("dashboard");
    const tags: string[] = [];

    if (query.timeRange !== defaults.timeRange) tags.push(timeRangeLabels[query.timeRange]);
    if (query.levels.join(",") !== defaults.levels.join(",")) tags.push(`重要性: ${query.levels.join(" / ") || "全部"}`);
    if (query.sources.length > 0) tags.push(...query.sources.map((item) => `来源: ${sourceLabelMap.get(item) ?? item}`));
    if (query.monitors.length > 0) tags.push(...query.monitors.map((item) => `关键词: ${item}`));
    if (query.sort !== defaults.sort) tags.push(`排序: ${sortLabels[query.sort]}`);

    return tags;
  }, [query, sourceLabelMap]);

  function replaceQuery(patch: Partial<HotspotListQuery>) {
    const nextQuery = normalizeHotspotListQuery({ ...query, ...patch }, "dashboard");
    const search = buildHotspotQueryString(nextQuery, "dashboard");

    startTransition(() => {
      const target = search ? `${pathname}?${search}` : pathname;
      router.replace(target as Route);
    });
  }

  function toggleValue(key: "sources" | "levels" | "monitors", value: string) {
    const current = query[key];
    const exists = current.includes(value as never);
    const next = exists ? current.filter((item) => item !== value) : [...current, value];
    replaceQuery({ [key]: next } as Partial<HotspotListQuery>);
  }

  function resetFilters() {
    startTransition(() => {
      router.replace(pathname as Route);
    });
  }

  const sourceSummary =
    query.sources.length === 0
      ? "全部来源"
      : query.sources.length === 1
        ? sourceLabelMap.get(query.sources[0]) ?? query.sources[0]
        : `已选 ${query.sources.length} 个来源`;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">实时热点流</p>
          <h2 className="mt-2 font-display text-3xl tracking-[-0.04em] text-white">先筛，再判，再开写</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
            默认只看最近 24 小时内的 high / medium 热点。你可以快速切换来源、重要性和关键词，让列表更贴近你现在要抢的内容窗口。
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
          当前结果 {hotspots.length} 条
        </div>
      </div>

      <CardSpotlight className="p-5">
        <div className="grid gap-4">
          <div className="grid gap-3 xl:grid-cols-[1.05fr_1fr_1.1fr_0.95fr]">
            <QuickSelect
              label="排序"
              value={query.sort}
              disabled={pending}
              onChange={(value) => replaceQuery({ sort: value as HotspotSort })}
              options={Object.entries(sortLabels).map(([value, label]) => ({ value, label }))}
            />

            <QuickSelect
              label="时间范围"
              value={query.timeRange}
              disabled={pending}
              onChange={(value) => replaceQuery({ timeRange: value as HotspotTimeRange })}
              options={Object.entries(timeRangeLabels).map(([value, label]) => ({ value, label }))}
            />

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-slate-400">
                <Flame className="h-4 w-4 text-amber-200" />
                重要性
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["high", "medium", "low"] as NotificationLevel[]).map((level) => {
                  const active = query.levels.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                        active ? levelStyles[level] : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                      disabled={pending}
                      onClick={() => toggleValue("levels", level)}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            <details className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-slate-400">
                    <RadioTower className="h-4 w-4 text-cyan-200" />
                    信息来源
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">{sourceSummary}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </summary>
              <div className="mt-4 grid gap-2">
                {sourceOptions.map((source) => {
                  const active = query.sources.includes(source.value);
                  return (
                    <label
                      key={source.value}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
                        active ? "border-cyan-300/30 bg-cyan-300/10 text-white" : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      <span>{source.label}</span>
                      <input
                        checked={active}
                        className="h-4 w-4 accent-cyan-300"
                        onChange={() => toggleValue("sources", source.value)}
                        type="checkbox"
                      />
                    </label>
                  );
                })}
              </div>
            </details>
          </div>

          <details className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">高级筛选</p>
                  <p className="text-xs text-slate-400">按监控关键词多选，同时保留完整来源面板和一键重置。</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </summary>

            <div className="mt-4 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-slate-400">
                  <Filter className="h-4 w-4 text-violet-200" />
                  关键词
                </div>
                <div className="flex flex-wrap gap-2">
                  {monitorOptions.map((label) => {
                    const active = query.monitors.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`rounded-full border px-3 py-2 text-sm transition ${
                          active ? "border-violet-300/30 bg-violet-300/12 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        disabled={pending}
                        onClick={() => toggleValue("monitors", label)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-slate-400">
                  <Layers3 className="h-4 w-4 text-emerald-200" />
                  当前视图
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                  <p>排序：{sortLabels[query.sort]}</p>
                  <p className="mt-2">时间：{timeRangeLabels[query.timeRange]}</p>
                  <p className="mt-2">重要性：{query.levels.length > 0 ? query.levels.join(" / ") : "全部"}</p>
                  <p className="mt-2">来源：{sourceSummary}</p>
                  <p className="mt-2">关键词：{query.monitors.length > 0 ? `${query.monitors.length} 个` : "全部"}</p>
                </div>

                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:border-cyan-300/35 hover:bg-cyan-300/10"
                  disabled={pending}
                  onClick={resetFilters}
                  type="button"
                >
                  <RotateCcw className="h-4 w-4" />
                  恢复默认
                </button>
              </div>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            {activeTags.length === 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">当前使用默认视图</span>
            ) : (
              activeTags.map((tag) => (
                <span key={tag} className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100">
                  {tag}
                </span>
              ))
            )}
          </div>
        </div>
      </CardSpotlight>

      <div className="grid gap-4">
        {hotspots.length === 0 ? (
          <CardSpotlight className="p-6">
            <div className="rounded-[24px] border border-dashed border-white/14 bg-white/[0.03] px-5 py-8">
              <h3 className="font-display text-2xl text-white">当前筛选下没有热点</h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                这通常意味着当前窗口过窄，或者这批来源暂时没有足够新鲜、足够重要的内容。你可以放宽时间范围，或恢复默认视图先看全局机会。
              </p>
            </div>
          </CardSpotlight>
        ) : (
          hotspots.map((hotspot, index) => (
            <CardSpotlight key={hotspot.id} className="p-5 md:p-6" color={index === 0 ? "rgba(34, 211, 238, 0.14)" : undefined}>
              <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-4xl space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${levelStyles[hotspot.notifyLevel]}`}>
                        {hotspot.notifyLevel}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                        热度 {hotspot.heatScore}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                        发现于 {formatDateTime(hotspot.firstSeenAt)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
                        发布于 {formatDateTime(hotspot.latestPublishedAt)}
                      </span>
                      {hotspot.notified ? (
                        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] text-cyan-100">已通知</span>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <h3 className="max-w-4xl font-display text-2xl leading-tight tracking-[-0.03em] text-white md:text-[2rem]">{hotspot.title}</h3>
                      <p className="max-w-3xl text-sm leading-7 text-slate-300">{hotspot.summary}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {hotspot.monitorLabels.map((label) => (
                        <span key={`${hotspot.id}-${label}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                    href={hotspot.canonicalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    查看原文
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">多源证据</p>
                        <p className="mt-1 text-sm text-slate-300">你可以先看来源结构，再决定是不是立刻写。</p>
                      </div>
                      <span className="text-xs text-slate-400">最近活跃 {formatDateTime(hotspot.lastSeenAt)}</span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {hotspot.evidence.map((evidence, evidenceIndex) => (
                        <div key={`${hotspot.id}-${evidence.sourceKey}-${evidenceIndex}`} className="rounded-[20px] border border-white/8 bg-slate-950/45 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-white">{evidence.sourceLabel}</p>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                                  {evidence.evidenceFamily}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">{evidence.author || "匿名来源"}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">质量 {Math.round(evidence.qualityScore)}</span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                                {evidence.isFreshEvidence ? "fresh" : evidence.freshnessState}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-300">{evidence.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <ScorePanel title="综合热度" value={hotspot.heatScore} tone="amber" />
                    <ScorePanel title="相关性" value={hotspot.relevanceScore} tone="cyan" />
                    <ScorePanel title="可信度" value={100 - hotspot.credibilityRisk} tone="emerald" />
                    <ScorePanel title="重要程度" value={importanceToScore(hotspot.notifyLevel)} tone="violet" />
                  </div>
                </div>
              </div>
            </CardSpotlight>
          ))
        )}
      </div>
    </div>
  );
}

function QuickSelect({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-slate-400">
        <CalendarClock className="h-4 w-4 text-cyan-200" />
        {label}
      </span>
      <select
        className="h-11 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition focus:border-cyan-300/50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScorePanel({
  title,
  value,
  tone
}: {
  title: string;
  value: number;
  tone: "amber" | "cyan" | "emerald" | "violet";
}) {
  const barTone = {
    amber: "from-amber-300 via-amber-200 to-white",
    cyan: "from-cyan-300 via-cyan-200 to-white",
    emerald: "from-emerald-300 via-emerald-200 to-white",
    violet: "from-violet-300 via-violet-200 to-white"
  } as const;

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">{title}</p>
        <span className="font-display text-2xl tracking-[-0.03em] text-white">{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full bg-gradient-to-r ${barTone[tone]}`} style={{ width: `${Math.max(10, value)}%` }} />
      </div>
    </div>
  );
}

function importanceToScore(level: NotificationLevel) {
  switch (level) {
    case "high":
      return 100;
    case "medium":
      return 68;
    case "low":
    default:
      return 36;
  }
}

function formatDateTime(input: string | null) {
  if (!input) return "暂无";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(input));
}
