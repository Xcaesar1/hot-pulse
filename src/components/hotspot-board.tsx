"use client";

import { useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  Eye,
  Filter,
  Flame,
  RefreshCw,
  Search,
  Sparkles,
  Waves
} from "lucide-react";
import type {
  HotspotListQuery,
  HotspotSort,
  HotspotTimeRange,
  HotspotView,
  MonitorRecord,
  NotificationLevel,
  SourceRecord
} from "@/core/contracts";
import { buildHotspotQueryString, getDefaultHotspotListQuery, normalizeHotspotListQuery } from "@/core/hotspot-query";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

const levelBadgeStyles: Record<NotificationLevel, string> = {
  high: "border-amber-300 bg-amber-100 text-amber-500",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  low: "border-stone-200 bg-white text-stone-600"
};

const levelLabels: Record<NotificationLevel, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW"
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

  const totalPages = Math.max(1, Math.ceil(hotspots.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(query.page, 1), totalPages);
  const pagedHotspots = hotspots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const [expandedHotspotId, setExpandedHotspotId] = useState<string | null>(null);
  const resolvedExpandedHotspotId =
    expandedHotspotId && pagedHotspots.some((item) => item.id === expandedHotspotId) ? expandedHotspotId : pagedHotspots[0]?.id ?? null;

  const activeTags = useMemo(() => {
    const defaults = getDefaultHotspotListQuery("dashboard");
    const tags: string[] = [];

    if (query.timeRange !== defaults.timeRange) tags.push(timeRangeLabels[query.timeRange]);
    if (query.levels.join(",") !== defaults.levels.join(",")) {
      tags.push(`重要性 ${query.levels.map((level) => level.toUpperCase()).join(" / ")}`);
    }
    if (query.sources.length > 0) tags.push(...query.sources.map((item) => sourceLabelMap.get(item) ?? item));
    if (query.monitors.length > 0) tags.push(...query.monitors);
    if (query.sort !== defaults.sort) tags.push(sortLabels[query.sort]);

    return tags;
  }, [query, sourceLabelMap]);

  function replaceQuery(patch: Partial<HotspotListQuery>, options?: { preservePage?: boolean }) {
    const nextQuery = normalizeHotspotListQuery(
      {
        ...query,
        ...patch,
        page: options?.preservePage ? patch.page ?? query.page : patch.page ?? 1
      },
      "dashboard"
    );
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

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 rounded-[32px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">
              <Flame className="h-3.5 w-3.5" />
              实时热点流
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-3xl tracking-[-0.05em] text-ink-950 md:text-[2.5rem]">先扫读，再判断，再开写</h2>
              <p className="max-w-3xl text-sm leading-7 text-stone-600">
                默认聚焦最近 24 小时内值得优先处理的内容。排序、筛选和分页都围绕“快速判断是否值得发”来组织，不让信息把你淹没。
              </p>
            </div>
          </div>

          <div className="rounded-full border border-stone-200 bg-paper-50 px-4 py-2 text-sm text-stone-600">
            当前结果 {hotspots.length} 条
          </div>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["discovered", Search],
                ["published", CalendarClock],
                ["importance", Flame],
                ["relevance", Eye],
                ["heat", Waves]
              ] as const
            ).map(([sort, Icon]) => (
              <button
                key={sort}
                type="button"
                disabled={pending}
                onClick={() => replaceQuery({ sort })}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                  query.sort === sort
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-stone-200 bg-paper-50 text-stone-600 hover:border-stone-300 hover:bg-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {sortLabels[sort]}
              </button>
            ))}

            <button
              type="button"
              disabled={pending}
              onClick={resetFilters}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-transparent px-2 text-sm text-stone-500 transition hover:text-ink-950"
            >
              <RefreshCw className="h-4 w-4" />
              重置
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <SelectionMenu
              label="信息来源"
              summary={query.sources.length === 0 ? "全部来源" : summarizeOptions(query.sources, sourceLabelMap)}
            >
              {sourceOptions.map((source) => {
                const active = query.sources.includes(source.value);
                return (
                  <ToggleRow key={source.value} active={active} label={source.label} onClick={() => toggleValue("sources", source.value)} />
                );
              })}
            </SelectionMenu>

            <SelectionMenu
              label="重要性"
              summary={query.levels.length === 3 ? "全部等级" : query.levels.map((level) => level.toUpperCase()).join(" / ")}
            >
              {(["high", "medium", "low"] as NotificationLevel[]).map((level) => {
                const active = query.levels.includes(level);
                return <ToggleRow key={level} active={active} label={level.toUpperCase()} onClick={() => toggleValue("levels", level)} />;
              })}
            </SelectionMenu>

            <SelectionMenu label="关键词" summary={query.monitors.length === 0 ? "全部关键词" : `${query.monitors.length} 个已选`}>
              {monitorOptions.map((label) => {
                const active = query.monitors.includes(label);
                return <ToggleRow key={label} active={active} label={label} onClick={() => toggleValue("monitors", label)} />;
              })}
            </SelectionMenu>

            <SelectionMenu label="时间范围" summary={timeRangeLabels[query.timeRange]}>
              {Object.entries(timeRangeLabels).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => replaceQuery({ timeRange: value as HotspotTimeRange })}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2 text-left text-sm transition",
                    query.timeRange === value ? "bg-blue-50 text-blue-700" : "text-stone-600 hover:bg-stone-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </SelectionMenu>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeTags.length === 0 ? (
              <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5 text-xs text-stone-500">当前使用默认视图</span>
            ) : (
              activeTags.map((tag) => (
                <span key={tag} className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5 text-xs text-stone-600">
                  {tag}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {hotspots.length === 0 ? (
          <div className="rounded-[32px] border border-stone-200 bg-white/90 p-8 shadow-[0_24px_70px_rgba(35,31,27,0.08)]">
            <h3 className="font-display text-3xl tracking-[-0.04em] text-ink-950">当前视图下暂无值得立即处理的热点</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              这通常意味着你把时间窗口压得比较窄，或者当前来源里还没有足够新、足够重要的内容。你可以先放宽时间范围，或者恢复默认视图再看一轮全局机会。
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 2xl:grid-cols-2">
              {pagedHotspots.map((hotspot) => (
                <HotspotCard
                  key={hotspot.id}
                  expanded={resolvedExpandedHotspotId === hotspot.id}
                  hotspot={hotspot}
                  onToggle={() => setExpandedHotspotId((current) => (current === hotspot.id ? null : hotspot.id))}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={currentPage}
              end={Math.min(currentPage * PAGE_SIZE, hotspots.length)}
              start={hotspots.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
              total={hotspots.length}
              totalPages={totalPages}
              onChange={(page) => replaceQuery({ page }, { preservePage: true })}
            />
          </>
        )}
      </div>
    </section>
  );
}

function HotspotCard({
  hotspot,
  expanded,
  onToggle
}: {
  hotspot: HotspotView;
  expanded: boolean;
  onToggle: () => void;
}) {
  const primarySource = hotspot.evidence[0];

  return (
    <article className="rounded-[32px] border border-stone-200 bg-white/92 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] transition hover:border-stone-300 md:p-6">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-2xl border px-3 py-2 text-xs font-semibold tracking-[0.18em]", levelBadgeStyles[hotspot.notifyLevel])}>
                {levelLabels[hotspot.notifyLevel]}
              </span>
              {primarySource ? <MetaTag>{primarySource.sourceLabel}</MetaTag> : null}
              {hotspot.monitorLabels.slice(0, 2).map((label) => (
                <MetaTag key={`${hotspot.id}-${label}`}>{label}</MetaTag>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-balance font-display text-[1.8rem] leading-tight tracking-[-0.04em] text-ink-950 md:text-[2rem]">{hotspot.title}</h3>
              <p className="text-base leading-8 text-stone-600">{hotspot.summary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
              <MetricPill icon={Eye} label={`相关性 ${hotspot.relevanceScore}%`} />
              <MetricPill icon={Sparkles} label={`热度 ${hotspot.heatScore}`} />
              <MetricPill
                icon={CalendarClock}
                label={`${hotspot.latestPublishedAt ? "发布时间" : "发现时间"} ${formatDateTime(hotspot.latestPublishedAt ?? hotspot.firstSeenAt)}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm font-medium text-ink-950 transition hover:bg-white"
            >
              {expanded ? "收起详情" : "展开详情"}
              <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
            </button>

            <a
              className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-ink-950 transition hover:border-stone-300 hover:bg-paper-50"
              href={hotspot.canonicalUrl}
              rel="noreferrer"
              target="_blank"
            >
              查看原文
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {expanded ? <HotspotDetailPanel hotspot={hotspot} /> : null}
      </div>
    </article>
  );
}

function HotspotDetailPanel({ hotspot }: { hotspot: HotspotView }) {
  return (
    <div className="grid gap-4 border-t border-stone-200 pt-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-4">
        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
            <Sparkles className="h-4 w-4 text-blue-600" />
            AI 判断
          </div>
          <p className="mt-3 text-sm leading-7 text-stone-700">{hotspot.summary}</p>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">多源证据</p>
              <p className="mt-1 text-sm text-stone-600">先看来源结构，再决定这条热点要不要立刻做成内容。</p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">{hotspot.evidenceCount} 条证据</span>
          </div>

          <div className="mt-4 grid gap-3">
            {hotspot.evidence.map((evidence, index) => (
              <div key={`${hotspot.id}-${evidence.sourceKey}-${index}`} className="rounded-[22px] border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-950">{evidence.sourceLabel}</p>
                      <span className="rounded-full border border-stone-200 bg-paper-50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        {formatEvidenceFamily(evidence.evidenceFamily)}
                      </span>
                      <span className="rounded-full border border-stone-200 bg-paper-50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                        {evidence.isFreshEvidence ? "Fresh" : evidence.freshnessState}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">{evidence.author || "公开来源"}</p>
                  </div>
                  <span className="text-xs text-stone-500">质量 {Math.round(evidence.qualityScore)}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-stone-700">{evidence.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">编辑判断</p>
          <div className="mt-4 grid gap-3">
            <ScoreRow label="重要程度" value={importanceText(hotspot.notifyLevel)} />
            <ScoreRow label="相关性" value={`${hotspot.relevanceScore}%`} />
            <ScoreRow label="热度综合" value={String(hotspot.heatScore)} />
            <ScoreRow label="可信度" value={`${100 - hotspot.credibilityRisk}%`} />
            <ScoreRow label="多源确认" value={`${hotspot.sourceDiversityScore}`} />
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">稿件信息</p>
          <div className="mt-4 grid gap-3 text-sm text-stone-700">
            <InfoRow label="发布时间" value={formatDateTime(hotspot.latestPublishedAt)} />
            <InfoRow label="首次发现" value={formatDateTime(hotspot.firstSeenAt)} />
            <InfoRow label="最近活跃" value={formatDateTime(hotspot.lastSeenAt)} />
            <InfoRow label="主证据新鲜度" value={hotspot.hasFreshPrimaryEvidence ? "有" : "无"} />
            <InfoRow label="通知状态" value={hotspot.notified ? "已发送" : "未发送"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectionMenu({
  label,
  summary,
  children
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="flex h-12 cursor-pointer list-none items-center gap-3 rounded-full border border-stone-200 bg-white px-4 text-sm text-ink-950 transition hover:border-stone-300">
        <Filter className="h-4 w-4 text-stone-400" />
        <span className="font-medium">{summary}</span>
        <span className="text-stone-400">{label}</span>
        <ChevronDown className="ml-auto h-4 w-4 text-stone-400 transition group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+0.75rem)] z-20 grid min-w-[17rem] gap-1 rounded-[24px] border border-stone-200 bg-white p-3 shadow-[0_24px_70px_rgba(35,31,27,0.08)]">
        {children}
      </div>
    </details>
  );
}

function ToggleRow({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition",
        active ? "bg-blue-50 text-blue-700" : "text-stone-600 hover:bg-stone-100"
      )}
    >
      <span>{label}</span>
      <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-blue-600" : "bg-stone-300")} />
    </button>
  );
}

function PaginationBar({
  currentPage,
  totalPages,
  total,
  start,
  end,
  onChange
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onChange: (page: number) => void;
}) {
  const pages = buildPageList(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-stone-200 bg-white/90 p-4 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-stone-600">
        显示第 <span className="font-semibold text-ink-950">{start}</span> - <span className="font-semibold text-ink-950">{end}</span> 条，共{" "}
        <span className="font-semibold text-ink-950">{total}</span> 条
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <ArrowLeft className="h-4 w-4" />
          上一页
        </button>

        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-2 text-stone-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onChange(page)}
              className={cn(
                "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm transition",
                currentPage === page ? "border-blue-200 bg-blue-50 text-blue-700" : "border-stone-200 bg-white text-stone-600 hover:bg-paper-50"
              )}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onChange(currentPage + 1)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          下一页
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MetaTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1 text-xs text-stone-600">{children}</span>;
}

function MetricPill({
  icon: Icon,
  label
}: {
  icon: typeof Eye;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5">
      <Icon className="h-4 w-4 text-stone-400" />
      {label}
    </span>
  );
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <span className="text-sm text-stone-600">{label}</span>
      <span className="font-semibold text-ink-950">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200/70 pb-3 last:border-b-0 last:pb-0">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-medium text-ink-950">{value}</span>
    </div>
  );
}

function summarizeOptions(values: string[], labelMap: Map<string, string>) {
  if (values.length === 1) return labelMap.get(values[0]) ?? values[0];
  return `已选 ${values.length} 项`;
}

function buildPageList(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];

  if (currentPage > 3) pages.push("ellipsis");

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 2) pages.push("ellipsis");

  pages.push(totalPages);

  return pages;
}

function formatEvidenceFamily(family: HotspotView["evidence"][number]["evidenceFamily"]) {
  switch (family) {
    case "official":
      return "Official";
    case "community":
      return "Community";
    case "social":
      return "Social";
    case "search_discovery":
    default:
      return "Search";
  }
}

function importanceText(level: NotificationLevel) {
  switch (level) {
    case "high":
      return "高优先级";
    case "medium":
      return "中优先级";
    case "low":
    default:
      return "低优先级";
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
