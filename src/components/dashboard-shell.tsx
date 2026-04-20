"use client";

import { useMemo, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bot, Clock3, Mail, RefreshCw, Sparkles } from "lucide-react";
import type { DashboardData, HotspotListQuery } from "@/core/contracts";
import { HotspotBoard } from "@/components/hotspot-board";
import { cn } from "@/lib/utils";

export function DashboardShell({
  initialData,
  hotspotQuery
}: {
  initialData: DashboardData;
  hotspotQuery: HotspotListQuery;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  async function triggerScan() {
    await fetch("/api/scan/run", { method: "POST" });
  }

  async function triggerTestEmail() {
    await fetch("/api/notifications/test", { method: "POST" });
  }

  function runMutation(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
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
                    <Sparkles className="h-3.5 w-3.5" />
                    Hot Pulse
                  </span>
                  <StatusChip active icon={Clock3} label="每 30 分钟自动扫描" />
                  <StatusChip active={initialData.env.hasOpenRouter} icon={Bot} label={initialData.env.hasOpenRouter ? "OpenRouter 已就绪" : "OpenRouter 待配置"} />
                  <StatusChip active={initialData.env.hasEmail} icon={Mail} label={initialData.env.hasEmail ? "邮件通知可用" : "邮件通知待配置"} />
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-5xl font-display text-4xl leading-none tracking-[-0.06em] text-ink-950 md:text-[4.25rem]">更快判断，少跳站点</h1>
                  <p className="max-w-4xl text-sm leading-7 text-stone-600 md:text-base">
                    首页只保留热点流和必要动作。重点是让你在站内完成第一轮判断，快速定位值得写、值得发、值得继续核验的内容。
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
