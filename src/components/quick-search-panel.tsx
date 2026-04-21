"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarClock, Clock3, Eye, MessageCircle, Repeat2, Search, ShieldCheck, Sparkles, Tag, ThumbsUp } from "lucide-react";
import type { MonitorRecord, QuickSearchResponse, QuickSearchResult } from "@/core/contracts";
import { cn } from "@/lib/utils";

type SearchStatus = "idle" | "loading" | "success" | "error";

export function QuickSearchPanel({
  existingMonitors,
  onCreateMonitor
}: {
  existingMonitors: MonitorRecord[];
  onCreateMonitor: (query: string, mode: QuickSearchResponse["mode"]) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QuickSearchResponse | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const monitorExists = existingMonitors.some((item) => item.query.trim().toLowerCase() === query.trim().toLowerCase());

  const resetSearchState = useCallback(() => {
    controllerRef.current?.abort();
    setStatus("idle");
    setError(null);
    setResponse(null);
    setExpandedIds([]);
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (!value.trim()) {
      resetSearchState();
    }
  }, [resetSearchState]);

  const runSearch = useCallback(async (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      resetSearchState();
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("loading");
    setError(null);

    try {
      const result = await fetch("/api/search/quick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: trimmed }),
        signal: controller.signal
      });

      const payload = (await result.json()) as QuickSearchResponse & { error?: string };
      if (!result.ok) {
        throw new Error(payload.error ?? "快速搜索失败");
      }

      if (controller.signal.aborted) return;
      setResponse(payload);
      setStatus("success");
      setExpandedIds([]);
    } catch (searchError) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setResponse(null);
      setExpandedIds([]);
      setError(searchError instanceof Error ? searchError.message : "快速搜索失败");
    }
  }, [resetSearchState]);

  useEffect(() => {
    if (!query.trim()) return;

    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 rounded-[32px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:p-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
            <Search className="h-3.5 w-3.5" />
            快速搜索
          </div>
          <h2 className="font-display text-3xl tracking-[-0.05em] text-ink-950 md:text-[2.5rem]">输入问题，立即联网搜索并做一次临时审核</h2>
          <p className="max-w-3xl text-sm leading-7 text-stone-600">
            这里不会写入正式热点库，也不会触发通知。系统会自动判断你的问题更像实体关键词还是主题问题，再复用现有搜索源和 AI 审核链路返回临时结果。
          </p>
        </div>

        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">搜索问题</span>
            <input
              className="h-14 rounded-[22px] border border-stone-200 bg-white px-5 text-base text-ink-950 outline-none transition placeholder:text-stone-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="例如：Claude Sonnet 4.6 最近有哪些可信新消息？"
              value={query}
            />
          </label>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-transparent">搜索</span>
            <button
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "loading" || query.trim().length === 0}
              type="submit"
            >
              <Search className={cn("h-4 w-4", status === "loading" && "animate-pulse")} />
              {status === "loading" ? "搜索中" : "立即搜索"}
            </button>
          </div>

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-transparent">监控</span>
            <button
              className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] border border-stone-200 bg-white px-5 text-sm font-semibold text-ink-950 transition hover:bg-paper-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={query.trim().length === 0 || !response || monitorExists}
              onClick={() => {
                if (!response) return;
                onCreateMonitor(response.query, response.mode);
              }}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              {monitorExists ? "已存在监控词" : "加入监控词"}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 text-xs text-stone-500">
          <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5">实时联网搜索</span>
          <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5">默认不入库</span>
          {response ? (
            <>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
                审核模式 {response.mode === "keyword" ? "关键词" : "主题"}
              </span>
              <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5">搜索源 {response.sourceCount} 个</span>
            </>
          ) : null}
        </div>
      </div>

      {status === "idle" ? (
        <SearchStateCard
          title="输入问题后会自动开始搜索"
          description="适合用来临时验证一个新话题、一个模型版本，或一条你刚看到但还不想直接写进正式监控规则的问题。"
        />
      ) : null}

      {status === "loading" ? (
        <SearchStateCard
          title="正在联网抓取与审核"
          description="系统会先向已启用的信息源请求结果，再用现有的关键词/主题审核链路筛掉低相关内容。"
        />
      ) : null}

      {status === "error" ? (
        <SearchStateCard title="这次搜索没有成功完成" description={error ?? "快速搜索失败，请稍后重试。"} tone="error" />
      ) : null}

      {status === "success" && response && response.results.length === 0 ? (
        <SearchStateCard
          title="这次没有找到足够相关的结果"
          description="你可以换一种问法，或者把问题改成更明确的实体名称、版本号、品牌名，再试一次。"
        />
      ) : null}

      {status === "success" && response && response.results.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {response.results.map((result) => (
            <QuickSearchResultCard
              key={result.id}
              expanded={expandedIds.includes(result.id)}
              onCreateMonitor={() => onCreateMonitor(response.query, response.mode)}
              onToggleExpanded={() =>
                setExpandedIds((current) => (current.includes(result.id) ? current.filter((item) => item !== result.id) : [...current, result.id]))
              }
              result={result}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function QuickSearchResultCard({
  result,
  expanded,
  onToggleExpanded,
  onCreateMonitor
}: {
  result: QuickSearchResult;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCreateMonitor: () => void;
}) {
  const leadEvidence = result.evidence[0] ?? null;
  const rawExcerpt = getDistinctExcerpt(result);

  return (
    <article className="grid gap-5 rounded-[32px] border border-stone-200 bg-white/92 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag tone="neutral">临时搜索结果</StatusTag>
          <StatusTag tone={result.keywordMentioned ? "good" : "neutral"}>{result.keywordMentioned ? "直接提及" : "未直接提及"}</StatusTag>
          <StatusTag tone={result.matchType === "exact" || result.matchType === "alias" ? "good" : "warn"}>
            {formatMatchType(result.matchType)}
          </StatusTag>
          {leadEvidence ? <StatusTag tone="neutral">{leadEvidence.sourceLabel}</StatusTag> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 transition hover:bg-white"
            onClick={onToggleExpanded}
            type="button"
          >
            {expanded ? "收起理由" : "展开理由"}
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm text-ink-950 transition hover:bg-paper-50"
            onClick={onCreateMonitor}
            type="button"
          >
            <Tag className="h-4 w-4" />
            转成监控词
          </button>
          <a
            className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm text-ink-950 transition hover:bg-paper-50"
            href={result.canonicalUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ArrowUpRight className="h-4 w-4" />
            查看原文
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-balance font-display text-[1.8rem] leading-tight tracking-[-0.04em] text-ink-950">{result.title}</h3>
        <ContentBlock label="AI 摘要" tone="ai">
          {result.summary}
        </ContentBlock>
        {rawExcerpt ? (
          <ContentBlock label="原始摘录" tone="source">
            {rawExcerpt}
          </ContentBlock>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {result.matchedTerms.map((term) => (
          <StatusTag key={`${result.id}-matched-${term}`} tone="good">
            命中 {term}
          </StatusTag>
        ))}
        {result.missingRequiredTerms.map((term) => (
          <StatusTag key={`${result.id}-missing-${term}`} tone="warn">
            缺失 {term}
          </StatusTag>
        ))}
      </div>

      <div className="grid gap-3 text-sm text-stone-600">
        <div className="flex flex-wrap gap-2">
          <InfoPill icon={CalendarClock} label="发布时间" value={formatDateTime(result.latestPublishedAt)} />
          <InfoPill icon={Clock3} label="抓取时间" value={formatDateTime(result.capturedAt)} />
        </div>

        {leadEvidence?.interactionMetrics ? <InteractionRow metrics={leadEvidence.interactionMetrics} /> : null}

        <div className="flex flex-wrap gap-2 text-sm text-stone-500">
          <MetricPill icon={Eye} label={`相关性 ${result.relevanceScore}%`} />
          <MetricPill icon={Sparkles} label={`热度 ${result.heatScore}`} />
          <MetricPill icon={ShieldCheck} label={`可信度 ${100 - result.credibilityRisk}%`} />
        </div>
      </div>

      {expanded ? (
        <div className="grid gap-3 rounded-[24px] border border-stone-200 bg-paper-50 p-4">
          {result.whyRelevant ? (
            <ReasonBlock title="AI 相关性分析">
              {result.whyRelevant}
            </ReasonBlock>
          ) : null}
          {result.whyNotRelevant ? (
            <ReasonBlock title="AI 风险提醒">
              {result.whyNotRelevant}
            </ReasonBlock>
          ) : null}
          {result.credibilityReasoning ? (
            <ReasonBlock title="AI 真实性判断">
              {result.credibilityReasoning}
            </ReasonBlock>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function SearchStateCard({
  title,
  description,
  tone = "default"
}: {
  title: string;
  description: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] border p-8 shadow-[0_24px_70px_rgba(35,31,27,0.08)]",
        tone === "error" ? "border-rose-200 bg-rose-50/80" : "border-stone-200 bg-white/90"
      )}
    >
      <h3 className="font-display text-3xl tracking-[-0.04em] text-ink-950">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">{description}</p>
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
    <div className={cn("rounded-[24px] border px-4 py-3", tone === "ai" ? "border-blue-100 bg-blue-50/70" : "border-stone-200 bg-paper-50")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-stone-700">{children}</p>
    </div>
  );
}

function ReasonBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-stone-700">{children}</p>
    </div>
  );
}

function StatusTag({
  tone,
  children
}: {
  tone: "neutral" | "good" | "warn";
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
  metrics: NonNullable<QuickSearchResult["evidence"][number]["interactionMetrics"]>;
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

function getDistinctExcerpt(result: QuickSearchResult) {
  const candidates = [result.rawSnippet, ...result.evidence.map((item) => item.snippet)];
  return candidates.find((candidate) => isDistinctExcerpt(candidate, result)) ?? null;
}

function isDistinctExcerpt(candidate: string | null | undefined, result: QuickSearchResult) {
  if (!candidate) return false;
  const excerpt = normalizeComparableText(candidate);
  if (excerpt.length < 24) return false;

  const summary = normalizeComparableText(result.summary);
  const title = normalizeComparableText(result.title);
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

function formatMatchType(value: QuickSearchResult["matchType"]) {
  switch (value) {
    case "exact":
      return "严格命中";
    case "alias":
      return "别名命中";
    case "adjacent":
      return "相邻概念";
    case "weak":
      return "弱相关";
    case "none":
    default:
      return "未命中";
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
