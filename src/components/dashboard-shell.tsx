"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Clock3, Flame, Mail, Plus, RefreshCw, Search, Target } from "lucide-react";
import type { DashboardData, HotspotListQuery, MonitorMode, MonitorRecord } from "@/core/contracts";
import { HotspotBoard } from "@/components/hotspot-board";
import { buildHotspotQueryString, normalizeHotspotListQuery } from "@/core/hotspot-query";
import { cn } from "@/lib/utils";

export function DashboardShell({
  initialData,
  hotspotQuery
}: {
  initialData: DashboardData;
  hotspotQuery: HotspotListQuery;
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

  async function createNewMonitor() {
    const query = newMonitorQuery.trim();
    if (!query) return;

    await fetch("/api/monitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        label: query,
        query,
        mode: newMonitorMode,
        aliases: ""
      })
    });

    setNewMonitorQuery("");
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

  function toggleMonitorFilter(label: string) {
    const nextMonitors = hotspotQuery.monitors.includes(label)
      ? hotspotQuery.monitors.filter((item) => item !== label)
      : [label];

    const nextQuery = normalizeHotspotListQuery(
      {
        ...hotspotQuery,
        monitors: nextMonitors,
        page: 1
      },
      "dashboard"
    );
    const search = buildHotspotQueryString(nextQuery, "dashboard");

    startTransition(() => {
      router.replace((search ? `${pathname}?${search}` : pathname) as Route);
    });
  }

  return (
    <main className="editor-paper min-h-screen px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1520px] gap-6">
        <header className="rounded-[36px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] backdrop-blur md:p-6">
          <div className="grid gap-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
                    <Target className="h-3.5 w-3.5" />
                    Hot Pulse
                  </span>
                  <StatusChip active icon={Clock3} label="每 30 分钟自动扫描" />
                  <StatusChip active={initialData.env.hasOpenRouter} icon={Bot} label={initialData.env.hasOpenRouter ? "OpenRouter 已连接" : "OpenRouter 待配置"} />
                  <StatusChip active={initialData.env.hasEmail} icon={Mail} label={initialData.env.hasEmail ? "邮件通知可用" : "邮件通知待配置"} />
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-5xl font-display text-4xl leading-none tracking-[-0.06em] text-ink-950 md:text-[4.25rem]">先盯住关键词，再快速筛掉伪相关</h1>
                  <p className="max-w-4xl text-sm leading-7 text-stone-600 md:text-base">
                    监控台负责管理你真正关心的词，热点流负责告诉你它们是否被直接提及、缺了哪些核心词，以及为什么值得继续看。
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton icon={RefreshCw} loading={pending} onClick={() => runMutation(triggerScan)}>
                  立即扫描
                </ActionButton>
                <ActionButton icon={Mail} loading={pending} onClick={() => runMutation(triggerTestEmail)} variant="secondary">
                  测试通知
                </ActionButton>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <SummaryPill label="高优先级" value={`${metrics.highCount} 条`} />
              <SummaryPill label="中优先级" value={`${metrics.mediumCount} 条`} />
              <SummaryPill label="来源健康" value={`${metrics.healthySources}/${metrics.totalSources}`} />
              <SummaryPill label="监控规则" value={`${metrics.totalMonitors} 条`} />
            </div>
          </div>
        </header>

        <section className="grid gap-5 rounded-[36px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <ViewChip active icon={Flame} label="热点雷达" />
            <ViewChip active icon={Target} label="监控词" />
            <ViewChip icon={Search} label="快速搜索" />
          </div>

          <div className="grid gap-4 rounded-[28px] border border-stone-200 bg-paper-50 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">新增监控词</span>
              <input
                className="h-14 rounded-[22px] border border-stone-200 bg-white px-5 text-base text-ink-950 outline-none transition placeholder:text-stone-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setNewMonitorQuery(event.target.value)}
                placeholder="输入要监控的关键词，如：Claude Sonnet 4.6"
                value={newMonitorQuery}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">模式</span>
              <select
                className="h-14 rounded-[22px] border border-stone-200 bg-white px-4 text-sm text-ink-950 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setNewMonitorMode(event.target.value as MonitorMode)}
                value={newMonitorMode}
              >
                <option value="keyword">关键词</option>
                <option value="topic">主题</option>
              </select>
            </label>

            <div className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-transparent">操作</span>
              <button
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[22px] bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending || newMonitorQuery.trim().length === 0}
                onClick={() => runMutation(createNewMonitor)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                添加
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {initialData.monitors.map((monitor) => {
              const activeFilter = hotspotQuery.monitors.includes(monitor.label);
              return (
                <div
                  aria-pressed={activeFilter}
                  key={monitor.id}
                  className={cn(
                    "grid gap-4 rounded-[28px] border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 focus:ring-offset-paper-50",
                    activeFilter ? "border-blue-200 bg-blue-50/70" : "border-stone-200 bg-white hover:border-stone-300"
                  )}
                  onClick={() => toggleMonitorFilter(monitor.label)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleMonitorFilter(monitor.label);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-600">
                          {monitor.mode === "keyword" ? "关键词" : "主题"}
                        </span>
                        {monitor.enabled ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                            已启用
                          </span>
                        ) : (
                          <span className="rounded-full border border-stone-200 bg-paper-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                            已暂停
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-[1.9rem] leading-none tracking-[-0.05em] text-ink-950">{monitor.label}</h2>
                      <p className="text-sm text-stone-600">{monitor.query}</p>
                    </div>

                    <button
                      aria-pressed={monitor.enabled}
                      className={cn(
                        "relative inline-flex h-10 w-18 items-center rounded-full p-1 transition",
                        monitor.enabled ? "bg-ink-950" : "bg-stone-300"
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        runMutation(() => toggleMonitorEnabled(monitor));
                      }}
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
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <HotspotBoard hotspots={initialData.hotspots} monitors={initialData.monitors} query={hotspotQuery} sources={initialData.sources} />
        </section>
      </div>
    </main>
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

function ViewChip({
  label,
  icon: Icon,
  active = false
}: {
  label: string;
  icon: typeof Flame;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
        active ? "border-stone-200 bg-white text-ink-950" : "border-transparent bg-transparent text-stone-500"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}
