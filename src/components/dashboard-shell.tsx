"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Clock3, Flame, Mail, Plus, RefreshCw, Search, Target } from "lucide-react";
import type { DashboardData, DashboardView, HotspotListQuery, MonitorMode, MonitorRecord } from "@/core/contracts";
import { HotspotBoard } from "@/components/hotspot-board";
import { QuickSearchPanel } from "@/components/quick-search-panel";
import { buildHotspotQueryString } from "@/core/hotspot-query";
import { cn } from "@/lib/utils";

export function DashboardShell({
  initialData,
  hotspotQuery,
  initialView
}: {
  initialData: DashboardData;
  hotspotQuery: HotspotListQuery;
  initialView: DashboardView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [newMonitorQuery, setNewMonitorQuery] = useState("");
  const [newMonitorMode, setNewMonitorMode] = useState<MonitorMode>("keyword");

  const metrics = useMemo(() => {
    const highCount = initialData.hotspots.filter((item) => item.notifyLevel === "high").length;
    const mediumCount = initialData.hotspots.filter((item) => item.notifyLevel === "medium").length;
    const healthySources = initialData.sources.filter((item) => item.lastStatus === "ok" || item.lastStatus === "idle").length;

    return {
      highCount,
      mediumCount,
      healthySources,
      totalSources: initialData.sources.length,
      totalMonitors: initialData.monitors.length
    };
  }, [initialData]);

  const hotspotCountByMonitor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hotspot of initialData.hotspots) {
      for (const label of hotspot.monitorLabels) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return counts;
  }, [initialData.hotspots]);

  function buildDashboardHref(view: DashboardView) {
    const search = buildHotspotQueryString(hotspotQuery, "dashboard");
    const params = new URLSearchParams(search);
    if (view === "radar") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    const query = params.toString();
    return (query ? `${pathname}?${query}` : pathname) as Route;
  }

  function navigateToView(view: DashboardView) {
    startTransition(() => {
      router.replace(buildDashboardHref(view));
    });
  }

  function refreshPage() {
    router.refresh();
  }

  function runMutation(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      refreshPage();
    });
  }

  async function triggerScan() {
    await fetch("/api/scan/run", { method: "POST" });
  }

  async function triggerTestEmail() {
    await fetch("/api/notifications/test", { method: "POST" });
  }

  async function createMonitor(query: string, mode: MonitorMode) {
    const trimmed = query.trim();
    if (!trimmed) return;

    await fetch("/api/monitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        label: trimmed,
        query: trimmed,
        mode,
        aliases: ""
      })
    });
  }

  async function createNewMonitor() {
    await createMonitor(newMonitorQuery, newMonitorMode);
    setNewMonitorQuery("");
  }

  async function ensureMonitorFromQuickSearch(query: string, mode: MonitorMode) {
    const trimmed = query.trim();
    if (!trimmed) return;

    const exists = initialData.monitors.some((monitor) => monitor.query.trim().toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      await createMonitor(trimmed, mode);
    }

    setNewMonitorQuery(trimmed);
    setNewMonitorMode(mode);
    router.replace(buildDashboardHref("monitors"));
    router.refresh();
  }

  async function toggleMonitorEnabled(monitor: MonitorRecord) {
    await fetch(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        enabled: !monitor.enabled
      })
    });
  }

  return (
    <main className="editor-paper min-h-screen px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1520px] gap-6">
        <header className="rounded-[36px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] backdrop-blur md:p-6">
          <div className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
                    <Target className="h-3.5 w-3.5" />
                    Hot Pulse
                  </span>
                  <StatusChip active icon={Clock3} label="每 30 分钟自动扫描" />
                  <StatusChip active={initialData.env.hasOpenRouter} icon={Bot} label={initialData.env.hasOpenRouter ? "OpenRouter 已连接" : "OpenRouter 待配置"} />
                  <StatusChip active={initialData.env.hasEmail} icon={Mail} label={initialData.env.hasEmail ? "邮件通知可用" : "邮件通知待配置"} />
                </div>

                <div className="space-y-2">
                  <h1 className="font-display text-4xl leading-none tracking-[-0.06em] text-ink-950 md:text-[4rem]">把热点、监控词和临时搜索拆开，各自只做一件事</h1>
                  <p className="max-w-4xl text-sm leading-7 text-stone-600 md:text-base">
                    热点雷达负责看正式热点，监控词负责管理关键词启停，快速搜索负责临时联网验证一个问题。这样你能更快进入正确的工作流，而不是在同一页里来回切换心智。
                  </p>
                </div>
              </div>

              {initialView === "radar" ? (
                <div className="flex flex-wrap gap-3">
                  <ActionButton icon={RefreshCw} loading={pending} onClick={() => runMutation(triggerScan)}>
                    立即扫描
                  </ActionButton>
                  <ActionButton icon={Mail} loading={pending} onClick={() => runMutation(triggerTestEmail)} variant="secondary">
                    测试通知
                  </ActionButton>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <TabButton active={initialView === "radar"} icon={Flame} label="热点雷达" onClick={() => navigateToView("radar")} />
              <TabButton active={initialView === "monitors"} icon={Target} label="监控词" onClick={() => navigateToView("monitors")} />
              <TabButton active={initialView === "search"} icon={Search} label="快速搜索" onClick={() => navigateToView("search")} />
            </div>

            {initialView === "radar" ? (
              <div className="flex flex-wrap gap-3">
                <SummaryPill label="高优先级" value={`${metrics.highCount} 条`} />
                <SummaryPill label="中优先级" value={`${metrics.mediumCount} 条`} />
                <SummaryPill label="来源健康" value={`${metrics.healthySources}/${metrics.totalSources}`} />
                <SummaryPill label="监控规则" value={`${metrics.totalMonitors} 条`} />
              </div>
            ) : null}
          </div>
        </header>

        {initialView === "radar" ? (
          <HotspotBoard hotspots={initialData.hotspots} monitors={initialData.monitors} query={hotspotQuery} sources={initialData.sources} />
        ) : null}

        {initialView === "monitors" ? (
          <MonitorPanel
            hotspotCountByMonitor={hotspotCountByMonitor}
            mode={newMonitorMode}
            monitors={initialData.monitors}
            onCreateMonitor={() => runMutation(createNewMonitor)}
            onModeChange={setNewMonitorMode}
            onQueryChange={setNewMonitorQuery}
            onToggleMonitor={(monitor) => runMutation(() => toggleMonitorEnabled(monitor))}
            pending={pending}
            query={newMonitorQuery}
          />
        ) : null}

        {initialView === "search" ? (
          <QuickSearchPanel existingMonitors={initialData.monitors} onCreateMonitor={(query, mode) => runMutation(() => ensureMonitorFromQuickSearch(query, mode))} />
        ) : null}
      </div>
    </main>
  );
}

function MonitorPanel({
  monitors,
  hotspotCountByMonitor,
  query,
  mode,
  pending,
  onQueryChange,
  onModeChange,
  onCreateMonitor,
  onToggleMonitor
}: {
  monitors: MonitorRecord[];
  hotspotCountByMonitor: Map<string, number>;
  query: string;
  mode: MonitorMode;
  pending: boolean;
  onQueryChange: (value: string) => void;
  onModeChange: (value: MonitorMode) => void;
  onCreateMonitor: () => void;
  onToggleMonitor: (monitor: MonitorRecord) => void;
}) {
  return (
    <section className="grid gap-5 rounded-[36px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:p-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
          <Target className="h-3.5 w-3.5" />
          监控词
        </div>
        <h2 className="font-display text-3xl tracking-[-0.05em] text-ink-950 md:text-[2.5rem]">这里只做规则管理，不混入热点流</h2>
        <p className="max-w-3xl text-sm leading-7 text-stone-600">新增监控词、切换启停、查看阈值和频率，都在这一页完成。热点查看回到“热点雷达”，临时验证问题去“快速搜索”。</p>
      </div>

      <div className="grid gap-4 rounded-[28px] border border-stone-200 bg-paper-50 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">新增监控词</span>
          <input
            className="h-14 rounded-[22px] border border-stone-200 bg-white px-5 text-base text-ink-950 outline-none transition placeholder:text-stone-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="输入要监控的关键词，例如：Claude Sonnet 4.6"
            value={query}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">模式</span>
          <select
            className="h-14 rounded-[22px] border border-stone-200 bg-white px-4 text-sm text-ink-950 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => onModeChange(event.target.value as MonitorMode)}
            value={mode}
          >
            <option value="keyword">关键词</option>
            <option value="topic">主题</option>
          </select>
        </label>

        <div className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-transparent">操作</span>
          <button
            className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending || query.trim().length === 0}
            onClick={onCreateMonitor}
            type="button"
          >
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {monitors.map((monitor) => (
          <article
            key={monitor.id}
            className={cn(
              "grid gap-4 rounded-[28px] border p-5 transition",
              monitor.enabled ? "border-stone-200 bg-white" : "border-stone-200 bg-paper-50"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-600">
                    {monitor.mode === "keyword" ? "关键词" : "主题"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]",
                      monitor.enabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 bg-white text-stone-500"
                    )}
                  >
                    {monitor.enabled ? "已启用" : "已暂停"}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-display text-[1.9rem] leading-none tracking-[-0.05em] text-ink-950">{monitor.label}</h3>
                  <p className="text-sm text-stone-600">{monitor.query}</p>
                </div>
              </div>

              <button
                aria-pressed={monitor.enabled}
                className={cn(
                  "relative inline-flex h-10 w-18 items-center rounded-full p-1 transition",
                  monitor.enabled ? "bg-ink-950" : "bg-stone-300"
                )}
                onClick={() => onToggleMonitor(monitor)}
                type="button"
              >
                <span
                  className={cn(
                    "h-8 w-8 rounded-full bg-white shadow transition",
                    monitor.enabled ? "translate-x-8" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
              <SummaryMini label="热点数" value={`${hotspotCountByMonitor.get(monitor.label) ?? 0} 条`} />
              <SummaryMini label="阈值" value={`${monitor.minRelevanceScore}`} />
              <SummaryMini label="频率" value={`${monitor.checkIntervalMinutes} 分钟`} />
              {monitor.aliases.length > 0 ? <SummaryMini label="别名" value={`${monitor.aliases.length} 个`} /> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionButton({
  icon: Icon,
  children,
  loading,
  onClick,
  variant = "primary"
}: {
  icon: typeof RefreshCw;
  children: ReactNode;
  loading: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-50",
        variant === "primary"
          ? "bg-ink-950 text-white hover:bg-ink-900"
          : "border border-stone-200 bg-white text-ink-950 hover:bg-paper-50"
      )}
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      <Icon className={cn("h-4 w-4", loading && "animate-spin")} />
      {children}
    </button>
  );
}

function StatusChip({
  label,
  icon: Icon,
  active
}: {
  label: string;
  icon: typeof Clock3;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.16em]",
        active ? "border-stone-200 bg-white text-stone-600" : "border-red-200 bg-red-50 text-red-600"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-paper-50 px-4 py-2 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-semibold text-ink-950">{value}</span>
    </div>
  );
}

function SummaryMini({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-paper-50 px-3 py-1.5 text-xs text-stone-600">
      <span>{label}</span>
      <span className="font-medium text-ink-950">{value}</span>
    </span>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick
}: {
  label: string;
  icon: typeof Flame;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
        active ? "border-stone-200 bg-white text-ink-950" : "border-stone-200 bg-paper-50 text-stone-500 hover:bg-white"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
