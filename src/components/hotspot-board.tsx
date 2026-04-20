"use client";

import { useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  ChevronDown,
  Clock3,
  Eye,
  Filter,
  Flame,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  ThumbsUp,
  Waves,
  XCircle
} from "lucide-react";
import type {
  AuthorSignals,
  HotspotEvidenceRecord,
  HotspotListQuery,
  HotspotSort,
  HotspotTimeRange,
  HotspotView,
  InteractionMetrics,
  MonitorRecord,
  NotificationLevel,
  SourceRecord
} from "@/core/contracts";
import { buildHotspotQueryString, getDefaultHotspotListQuery, normalizeHotspotListQuery } from "@/core/hotspot-query";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

const levelBadgeStyles: Record<NotificationLevel, string> = {
  high: "border-amber-300 bg-amber-100 text-amber-700",
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

const matchTypeLabels: Record<HotspotView["matchType"], string> = {
  exact: "直接提及",
  alias: "别名命中",
  adjacent: "相邻概念",
  weak: "弱相关",
  none: "未命中"
};

const matchTypeStyles: Record<HotspotView["matchType"], string> = {
  exact: "border-violet-200 bg-violet-50 text-violet-700",
  alias: "border-sky-200 bg-sky-50 text-sky-700",
  adjacent: "border-stone-200 bg-paper-50 text-stone-600",
  weak: "border-amber-200 bg-amber-50 text-amber-700",
  none: "border-rose-200 bg-rose-50 text-rose-700"
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
  const [expandedHotspotId, setExpandedHotspotId] = useState<string | null>(null);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<string[]>([]);

  const sourceOptions = useMemo(
    () => sources.map((source) => ({ value: source.key, label: source.label })).sort((left, right) => left.label.localeCompare(right.label, "zh-CN")),
    [sources]
  );
  const sourceLabelMap = useMemo(() => new Map(sourceOptions.map((item) => [item.value, item.label])), [sourceOptions]);
  const monitorOptions = useMemo(() => {
    const labels = new Set(monitors.map((item) => item.label));
    for (const hotspot of hotspots) {
      for (const label of hotspot.monitorLabels) labels.add(label);
    }
    return [...labels].sort((left, right) => left.localeCompare(right, "zh-CN"));
  }, [hotspots, monitors]);

  const totalPages = Math.max(1, Math.ceil(hotspots.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(query.page, 1), totalPages);
  const pagedHotspots = hotspots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleReasoningIds = pagedHotspots.filter((item) => hasAnyReasoning(item)).map((item) => item.id);
  const allReasoningsExpanded =
    visibleReasoningIds.length > 0 && visibleReasoningIds.every((item) => expandedReasoningIds.includes(item));

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

  function toggleReasoning(hotspotId: string) {
    setExpandedReasoningIds((current) =>
      current.includes(hotspotId) ? current.filter((item) => item !== hotspotId) : [...current, hotspotId]
    );
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 rounded-[32px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">
              <Flame className="h-3.5 w-3.5" />
              实时热点流
            </div>
            <h2 className="font-display text-3xl tracking-[-0.05em] text-ink-950 md:text-[2.5rem]">先看它和关键词什么关系，再决定要不要点开</h2>
            <p className="max-w-3xl text-sm leading-7 text-stone-600">
              AI 摘要会直接解释这条内容与监控词的关系，旁边同时展示直接提及状态、匹配类型、命中词和缺失词，尽量把第一轮判断留在站内完成。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-stone-200 bg-paper-50 px-4 py-2 text-sm text-stone-600">当前结果 {hotspots.length} 条</span>
            {visibleReasoningIds.length > 0 ? (
              <button
                className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-ink-950 transition hover:border-stone-300 hover:bg-paper-50"
                disabled={pending}
                onClick={() =>
                  setExpandedReasoningIds((current) =>
                    allReasoningsExpanded
                      ? current.filter((item) => !visibleReasoningIds.includes(item))
                      : [...new Set([...current, ...visibleReasoningIds])]
                  )
                }
                type="button"
              >
                <Sparkles className="h-4 w-4" />
                {allReasoningsExpanded ? "收起本页 AI 理由" : "展开本页 AI 理由"}
              </button>
            ) : null}
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
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                  query.sort === sort
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-stone-200 bg-paper-50 text-stone-600 hover:border-stone-300 hover:bg-white"
                )}
                disabled={pending}
                onClick={() => replaceQuery({ sort })}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {sortLabels[sort]}
              </button>
            ))}

            <button
              className="inline-flex h-11 items-center gap-2 rounded-full border border-transparent px-2 text-sm text-stone-500 transition hover:text-ink-950"
              disabled={pending}
              onClick={resetFilters}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              重置
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <SelectionMenu label="来源" summary={query.sources.length === 0 ? "全部来源" : summarizeOptions(query.sources, sourceLabelMap)}>
              {sourceOptions.map((source) => (
                <ToggleRow
                  key={source.value}
                  active={query.sources.includes(source.value)}
                  label={source.label}
                  onClick={() => toggleValue("sources", source.value)}
                />
              ))}
            </SelectionMenu>

            <SelectionMenu
              label="重要性"
              summary={query.levels.length === 3 ? "全部等级" : query.levels.map((level) => level.toUpperCase()).join(" / ")}
            >
              {(["high", "medium", "low"] as NotificationLevel[]).map((level) => (
                <ToggleRow
                  key={level}
                  active={query.levels.includes(level)}
                  label={level.toUpperCase()}
                  onClick={() => toggleValue("levels", level)}
                />
              ))}
            </SelectionMenu>

            <SelectionMenu label="关键词" summary={query.monitors.length === 0 ? "全部关键词" : `${query.monitors.length} 个已选`}>
              {monitorOptions.map((label) => (
                <ToggleRow
                  key={label}
                  active={query.monitors.includes(label)}
                  label={label}
                  onClick={() => toggleValue("monitors", label)}
                />
              ))}
            </SelectionMenu>

            <SelectionMenu label="时间范围" summary={timeRangeLabels[query.timeRange]}>
              {Object.entries(timeRangeLabels).map(([value, label]) => (
                <button
                  key={value}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2 text-left text-sm transition",
                    query.timeRange === value ? "bg-blue-50 text-blue-700" : "text-stone-600 hover:bg-stone-100"
                  )}
                  onClick={() => replaceQuery({ timeRange: value as HotspotTimeRange })}
                  type="button"
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

      {hotspots.length === 0 ? (
        <div className="rounded-[32px] border border-stone-200 bg-white/90 p-8 shadow-[0_24px_70px_rgba(35,31,27,0.08)]">
          <h3 className="font-display text-3xl tracking-[-0.04em] text-ink-950">当前视图下暂无值得立即处理的热点</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            这通常意味着当前筛选条件已经把噪音压得很低。你可以先放宽时间窗口，或者切回默认视图看看全局热点。
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 2xl:grid-cols-2">
            {pagedHotspots.map((hotspot) => (
              <HotspotCard
                key={hotspot.id}
                expanded={expandedHotspotId === hotspot.id}
                hotspot={hotspot}
                reasoningExpanded={expandedReasoningIds.includes(hotspot.id)}
                onToggle={() => setExpandedHotspotId((current) => (current === hotspot.id ? null : hotspot.id))}
                onToggleReasoning={() => toggleReasoning(hotspot.id)}
              />
            ))}
          </div>

          <PaginationBar
            currentPage={currentPage}
            end={Math.min(currentPage * PAGE_SIZE, hotspots.length)}
            onChange={(page) => replaceQuery({ page }, { preservePage: true })}
            start={hotspots.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
            total={hotspots.length}
            totalPages={totalPages}
          />
        </>
      )}
    </section>
  );
}

function HotspotCard({
  hotspot,
  expanded,
  reasoningExpanded,
  onToggle,
  onToggleReasoning
}: {
  hotspot: HotspotView;
  expanded: boolean;
  reasoningExpanded: boolean;
  onToggle: () => void;
  onToggleReasoning: () => void;
}) {
  const leadEvidence = getLeadEvidence(hotspot);
  const interactionMetrics = leadEvidence?.interactionMetrics ?? null;
  const authorSignals = leadEvidence?.authorSignals ?? null;
  const distinctRawExcerpt = getDistinctRawExcerpt(hotspot);

  return (
    <article className="rounded-[32px] border border-stone-200 bg-white/92 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] transition hover:border-stone-300 md:p-6">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-2xl border px-3 py-2 text-xs font-semibold tracking-[0.18em]", levelBadgeStyles[hotspot.notifyLevel])}>
                {levelLabels[hotspot.notifyLevel]}
              </span>
              {leadEvidence ? <MetaTag>{leadEvidence.sourceLabel}</MetaTag> : null}
              {hotspot.monitorLabels.slice(0, 2).map((label) => (
                <MetaTag key={`${hotspot.id}-${label}`}>{label}</MetaTag>
              ))}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs",
                  hotspot.keywordMentioned ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-paper-50 text-stone-600"
                )}
              >
                <Tag className="h-3.5 w-3.5" />
                {hotspot.keywordMentioned ? "直接提及" : "未直接提及"}
              </span>
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs", matchTypeStyles[hotspot.matchType])}>
                {matchTypeLabels[hotspot.matchType]}
              </span>
              {hotspot.notified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  <Bell className="h-3.5 w-3.5" />
                  已通知
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              <h3 className="text-balance font-display text-[1.8rem] leading-tight tracking-[-0.04em] text-ink-950 md:text-[2rem]">{hotspot.title}</h3>

              <ContentBlock label="AI 摘要" tone="ai">
                {hotspot.summary}
              </ContentBlock>

              {distinctRawExcerpt ? (
                <ContentBlock label="原始摘录" tone="source">
                  {distinctRawExcerpt}
                </ContentBlock>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {hotspot.matchedTerms.map((term) => (
                <TagChip key={`${hotspot.id}-match-${term}`} tone="good">
                  命中 {term}
                </TagChip>
              ))}
              {hotspot.missingRequiredTerms.map((term) => (
                <TagChip key={`${hotspot.id}-missing-${term}`} tone="warn">
                  缺失 {term}
                </TagChip>
              ))}
            </div>

            <div className="grid gap-3 text-sm text-stone-600">
              <div className="flex flex-wrap gap-2">
                <InfoPill icon={CalendarClock} label="发布时间" value={formatDateTime(hotspot.latestPublishedAt)} />
                <InfoPill icon={Clock3} label="抓取时间" value={formatDateTime(hotspot.firstSeenAt)} />
                <InfoPill icon={Search} label="最近活跃" value={formatDateTime(hotspot.lastSeenAt)} />
              </div>

              {interactionMetrics ? <InteractionRow metrics={interactionMetrics} /> : null}

              <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500">
                <MetricPill icon={Eye} label={`相关性 ${hotspot.relevanceScore}%`} />
                <MetricPill icon={Waves} label={`热度 ${hotspot.heatScore}`} />
                <MetricPill icon={ShieldCheck} label={`可信度 ${100 - hotspot.credibilityRisk}%`} />
                <MetricPill icon={Sparkles} label={`多源 ${hotspot.evidenceCount} 条`} />
              </div>

              {authorSignals ? <AuthorSignalRow author={leadEvidence?.author ?? null} signals={authorSignals} /> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasAnyReasoning(hotspot) ? (
              <button
                className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm font-medium text-ink-950 transition hover:bg-white"
                onClick={onToggleReasoning}
                type="button"
              >
                {reasoningExpanded ? "收起 AI 理由" : "展开 AI 理由"}
                <ChevronDown className={cn("h-4 w-4 transition", reasoningExpanded && "rotate-180")} />
              </button>
            ) : null}

            <button
              className="inline-flex h-11 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-ink-950 transition hover:border-stone-300 hover:bg-paper-50"
              onClick={onToggle}
              type="button"
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

        {reasoningExpanded ? <ReasoningPanel hotspot={hotspot} /> : null}
        {expanded ? <HotspotDetailPanel hotspot={hotspot} /> : null}
      </div>
    </article>
  );
}

function ReasoningPanel({ hotspot }: { hotspot: HotspotView }) {
  return (
    <div className="grid gap-4 rounded-[28px] border border-stone-200 bg-paper-50 p-5 md:grid-cols-3">
      <ReasonCard icon={Sparkles} title="为什么相关" description={hotspot.whyRelevant ?? hotspot.reasoning ?? "当前还没有可展示的相关性说明。"} />
      <ReasonCard icon={XCircle} title="为什么可能不稳" description={hotspot.whyNotRelevant ?? "当前还没有可展示的风险说明。"} />
      <ReasonCard icon={ShieldCheck} title="真实性判断" description={hotspot.credibilityReasoning ?? "当前还没有可展示的真实性判断理由。"} />
    </div>
  );
}

function HotspotDetailPanel({ hotspot }: { hotspot: HotspotView }) {
  const leadEvidence = getLeadEvidence(hotspot);

  return (
    <div className="grid gap-4 border-t border-stone-200 pt-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4">
        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
            <Sparkles className="h-4 w-4 text-blue-600" />
            编辑判断
          </div>
          <div className="mt-4 grid gap-3">
            <ScoreRow label="重要程度" value={importanceText(hotspot.notifyLevel)} />
            <ScoreRow label="相关性" value={`${hotspot.relevanceScore}%`} />
            <ScoreRow label="匹配类型" value={matchTypeLabels[hotspot.matchType]} />
            <ScoreRow label="直接提及" value={hotspot.keywordMentioned ? "是" : "否"} />
            <ScoreRow label="热度综合" value={String(hotspot.heatScore)} />
            <ScoreRow label="是否已通知" value={hotspot.notified ? "已发送通知" : "尚未通知"} />
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">匹配证据</p>
              <p className="mt-1 text-sm text-stone-600">你可以先看命中词、缺失词和查询扩展，再决定要不要回到原站继续深挖。</p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">{hotspot.evidenceCount} 条证据</span>
          </div>

          <div className="mt-4 grid gap-3">
            <TermGroup label="命中词" terms={hotspot.matchedTerms} tone="good" />
            <TermGroup label="缺失词" terms={hotspot.missingRequiredTerms} tone="warn" />
            <TermGroup label="查询扩展" terms={hotspot.queryExpansionTerms} tone="neutral" />
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">多源证据</p>
              <p className="mt-1 text-sm text-stone-600">先看来源结构、原始摘录和互动信号，再决定是否需要跳去原站。</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {hotspot.evidence.map((evidence, index) => (
              <EvidenceCard key={`${hotspot.id}-${evidence.sourceKey}-${index}`} evidence={evidence} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">热点时间线</p>
          <div className="mt-4 grid gap-3 text-sm text-stone-700">
            <InfoRow label="发布时间" value={formatDateTime(hotspot.latestPublishedAt)} />
            <InfoRow label="首次抓取" value={formatDateTime(hotspot.firstSeenAt)} />
            <InfoRow label="最近活跃" value={formatDateTime(hotspot.lastSeenAt)} />
            <InfoRow label="主证据新鲜度" value={hotspot.hasFreshPrimaryEvidence ? "新鲜" : "待确认"} />
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-paper-50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">主来源信号</p>
          <div className="mt-4 grid gap-3 text-sm text-stone-700">
            <InfoRow label="来源" value={leadEvidence?.sourceLabel ?? "暂无"} />
            <InfoRow label="作者 / 账号" value={leadEvidence?.author ?? "公开来源"} />
            <InfoRow label="发布时间" value={formatDateTime(leadEvidence?.publishedAt ?? null)} />
            <InfoRow label="抓取时间" value={formatDateTime(leadEvidence?.capturedAt ?? null)} />
            <InfoRow label="证据家族" value={formatEvidenceFamily(leadEvidence?.evidenceFamily ?? "search_discovery")} />
          </div>
          {leadEvidence?.interactionMetrics ? <InteractionRow className="mt-4" metrics={leadEvidence.interactionMetrics} /> : null}
          {leadEvidence?.authorSignals ? <AuthorSignalRow className="mt-4" author={leadEvidence.author} signals={leadEvidence.authorSignals} /> : null}
        </div>
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: HotspotEvidenceRecord }) {
  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink-950">{evidence.sourceLabel}</p>
            <span className="rounded-full border border-stone-200 bg-paper-50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
              {formatEvidenceFamily(evidence.evidenceFamily)}
            </span>
            <span className="rounded-full border border-stone-200 bg-paper-50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-500">
              {evidence.isFreshEvidence ? "Fresh" : formatFreshnessState(evidence.freshnessState)}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500">{evidence.author || "公开来源"}</p>
        </div>
        <span className="text-xs text-stone-500">质量 {Math.round(evidence.qualityScore)}</span>
      </div>

      <p className="mt-3 text-sm leading-7 text-stone-700">{evidence.snippet}</p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
        <MetaTag>发布时间 {formatDateTime(evidence.publishedAt)}</MetaTag>
        <MetaTag>抓取时间 {formatDateTime(evidence.capturedAt)}</MetaTag>
      </div>

      {evidence.interactionMetrics ? <InteractionRow className="mt-3" metrics={evidence.interactionMetrics} /> : null}
      {evidence.authorSignals ? <AuthorSignalRow className="mt-3" author={evidence.author} signals={evidence.authorSignals} /> : null}
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
      className={cn(
        "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition",
        active ? "bg-blue-50 text-blue-700" : "text-stone-600 hover:bg-stone-100"
      )}
      onClick={onClick}
      type="button"
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
          className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={currentPage <= 1}
          onClick={() => onChange(currentPage - 1)}
          type="button"
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
              className={cn(
                "inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm transition",
                currentPage === page ? "border-blue-200 bg-blue-50 text-blue-700" : "border-stone-200 bg-white text-stone-600 hover:bg-paper-50"
              )}
              onClick={() => onChange(page)}
              type="button"
            >
              {page}
            </button>
          )
        )}

        <button
          className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
          disabled={currentPage >= totalPages}
          onClick={() => onChange(currentPage + 1)}
          type="button"
        >
          下一页
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ContentBlock({
  label,
  tone,
  children
}: {
  label: string;
  tone: "ai" | "source";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-4 py-3",
        tone === "ai" ? "border-blue-100 bg-blue-50/70" : "border-stone-200 bg-paper-50"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-stone-700">{children}</p>
    </div>
  );
}

function ReasonCard({
  icon: Icon,
  title,
  description
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-950">
        <Icon className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      <p className="mt-3 text-sm leading-7 text-stone-700">{description}</p>
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

function InfoPill({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600">
      <Icon className="h-3.5 w-3.5 text-stone-400" />
      <span className="font-medium text-ink-950">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function InteractionRow({
  metrics,
  className
}: {
  metrics: InteractionMetrics;
  className?: string;
}) {
  const items = [
    metrics.likes ? { key: "likes", icon: ThumbsUp, label: "点赞", value: metrics.likes } : null,
    metrics.replies ? { key: "replies", icon: MessageCircle, label: "回复", value: metrics.replies } : null,
    metrics.reposts ? { key: "reposts", icon: Repeat2, label: "转发", value: metrics.reposts } : null,
    metrics.views ? { key: "views", icon: Eye, label: "浏览", value: metrics.views } : null,
    metrics.comments ? { key: "comments", icon: MessageCircle, label: "评论", value: metrics.comments } : null,
    metrics.upvotes ? { key: "upvotes", icon: ThumbsUp, label: "顶票", value: metrics.upvotes } : null
  ].filter(Boolean) as Array<{ key: string; icon: typeof Eye; label: string; value: number }>;

  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600">
          <item.icon className="h-3.5 w-3.5 text-stone-400" />
          <span>{item.label}</span>
          <span className="font-medium text-ink-950">{formatMetricValue(item.value)}</span>
        </span>
      ))}
    </div>
  );
}

function AuthorSignalRow({
  author,
  signals,
  className
}: {
  author: string | null;
  signals: AuthorSignals;
  className?: string;
}) {
  const tags: string[] = [];
  if (author) tags.push(author);
  if (signals.trustedAccount) tags.push("白名单账号");
  if (signals.isBlueVerified) tags.push("已认证");
  if (signals.followers) tags.push(`粉丝 ${formatMetricValue(signals.followers)}`);
  if (signals.verifiedType) tags.push(String(signals.verifiedType));

  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <MetaTag key={tag}>{tag}</MetaTag>
      ))}
    </div>
  );
}

function TagChip({
  tone,
  children
}: {
  tone: "good" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs",
        tone === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : tone === "warn"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-stone-200 bg-paper-50 text-stone-600"
      )}
    >
      {children}
    </span>
  );
}

function TermGroup({
  label,
  terms,
  tone
}: {
  label: string;
  terms: string[];
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className="grid gap-2 rounded-[22px] border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink-950">{label}</p>
      <div className="flex flex-wrap gap-2">
        {terms.length > 0 ? terms.map((term) => <TagChip key={`${label}-${term}`} tone={tone}>{term}</TagChip>) : <MetaTag>暂无</MetaTag>}
      </div>
    </div>
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

function getLeadEvidence(hotspot: HotspotView) {
  return hotspot.evidence.find((item) => item.interactionMetrics || item.authorSignals) ?? hotspot.evidence[0] ?? null;
}

function getDistinctRawExcerpt(hotspot: HotspotView) {
  const candidates = [hotspot.rawSnippet, ...hotspot.evidence.map((item) => item.snippet)];
  return candidates.find((candidate) => isDistinctExcerpt(candidate, hotspot)) ?? null;
}

function isDistinctExcerpt(candidate: string | null | undefined, hotspot: HotspotView) {
  if (!candidate) return false;

  const excerpt = normalizeComparableText(candidate);
  if (excerpt.length < 24) return false;

  const summary = normalizeComparableText(hotspot.summary);
  const title = normalizeComparableText(hotspot.title);

  if (excerpt === summary || excerpt === title) return false;
  if (summary.includes(excerpt) || excerpt.includes(summary)) return false;
  if (title.includes(excerpt) || excerpt.includes(title)) return false;

  return true;
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function hasAnyReasoning(hotspot: HotspotView) {
  return Boolean(hotspot.whyRelevant || hotspot.whyNotRelevant || hotspot.reasoning || hotspot.credibilityReasoning);
}

function formatEvidenceFamily(family: HotspotView["evidence"][number]["evidenceFamily"]) {
  switch (family) {
    case "official":
      return "官方";
    case "community":
      return "社区";
    case "social":
      return "社交";
    case "search_discovery":
    default:
      return "搜索";
  }
}

function formatFreshnessState(state: HotspotEvidenceRecord["freshnessState"]) {
  switch (state) {
    case "fresh":
      return "新鲜";
    case "stale":
      return "过时";
    case "unknown":
    default:
      return "时间未知";
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

function formatMetricValue(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
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
