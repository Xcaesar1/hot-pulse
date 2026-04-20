"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Bot,
  Clock3,
  Mail,
  PencilLine,
  RefreshCw,
  Settings2,
  Sparkles,
  Waves
} from "lucide-react";
import type { DashboardData, HotspotListQuery, NotificationLevel, SourceRecord } from "@/core/contracts";
import { HotspotBoard } from "@/components/hotspot-board";
import { cn } from "@/lib/utils";

const sourceKinds: Record<SourceRecord["kind"], string> = {
  search: "网页搜索",
  social: "社交来源",
  structured: "结构化来源",
  custom: "自定义来源"
};

const statusStyles: Record<SourceRecord["lastStatus"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  idle: "border-stone-200 bg-white text-stone-600",
  error: "border-red-200 bg-red-50 text-red-600"
};

const levelStyles: Record<NotificationLevel, string> = {
  high: "border-amber-300 bg-amber-100 text-amber-500",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  low: "border-stone-200 bg-white text-stone-600"
};

export function DashboardShell({
  initialData,
  hotspotQuery
}: {
  initialData: DashboardData;
  hotspotQuery: HotspotListQuery;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [monitorForm, setMonitorForm] = useState({
    label: "",
    query: "",
    mode: "keyword",
    aliases: ""
  });
  const [sourceDrafts, setSourceDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialData.sources.map((item) => [item.id, JSON.stringify(item.config, null, 2)]))
  );

  const metrics = useMemo(() => {
    const highCount = initialData.hotspots.filter((item) => item.notifyLevel === "high").length;
    return {
      highCount,
      healthySources: initialData.sources.filter((item) => item.lastStatus === "ok" || item.lastStatus === "idle").length,
      totalMonitors: initialData.monitors.length,
      breaking: initialData.hotspots[0]
    };
  }, [initialData]);

  async function createMonitor() {
    await fetch("/api/monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: monitorForm.label,
        query: monitorForm.query,
        mode: monitorForm.mode,
        aliases: monitorForm.aliases
      })
    });
  }

  async function toggleSource(source: SourceRecord) {
    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !source.enabled
      })
    });
  }

  async function saveSourceConfig(source: SourceRecord) {
    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: JSON.parse(sourceDrafts[source.id] || "{}")
      })
    });
  }

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
        <header className="rounded-[36px] border border-stone-200 bg-white/85 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)] backdrop-blur md:p-6">
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
                <h1 className="max-w-5xl font-display text-4xl leading-none tracking-[-0.06em] text-ink-950 md:text-[4.25rem]">
                  你的 AI 内容编辑台
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
                  这里不是一个会分散注意力的后台，而是一张专门给你判断选题的首页。首屏只保留最值得立刻处理的热点，其余规则、通知和来源配置都收进次级面板，让你先看见内容，再做动作。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton icon={RefreshCw} loading={pending} onClick={() => runMutation(triggerScan)}>
                立即扫描
              </ActionButton>
              <ActionButton icon={Mail} loading={pending} onClick={() => runMutation(triggerTestEmail)} variant="secondary">
                发送测试通知
              </ActionButton>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <MetricCard label="高优先级热点" value={String(metrics.highCount)} hint="适合优先判断是否做成内容" />
            <MetricCard
              label="来源健康"
              value={`${metrics.healthySources}/${initialData.sources.length}`}
              hint="当前可用的信息来源数量"
            />
            <MetricCard label="监控规则" value={String(metrics.totalMonitors)} hint="你正在持续跟踪的关键词与主题" />
            <MetricCard
              label="编辑建议"
              value={metrics.breaking ? "有" : "无"}
              hint={metrics.breaking ? "当前已有值得优先查看的候选热点" : "先执行一次扫描，建立今天的选题面"}
            />
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_23rem]">
          <HotspotBoard hotspots={initialData.hotspots} monitors={initialData.monitors} query={hotspotQuery} sources={initialData.sources} />

          <aside className="grid h-fit gap-4 xl:sticky xl:top-5">
            <SidebarCard
              title="编辑简报"
              subtitle="把系统状态压缩成几个你真正会看的信号"
              icon={Waves}
            >
              <div className="grid gap-3">
                <ReadinessRow label="OpenRouter" value={initialData.env.hasOpenRouter ? "已连接" : "待配置"} active={initialData.env.hasOpenRouter} />
                <ReadinessRow label="twitterapi.io" value={initialData.env.hasTwitterApi ? "已连接" : "待配置"} active={initialData.env.hasTwitterApi} />
                <ReadinessRow label="邮件提醒" value={initialData.env.hasEmail ? "可发送" : "待配置"} active={initialData.env.hasEmail} />
              </div>
            </SidebarCard>

            <SidebarCard title="新增监控规则" subtitle="先把你最近最想抢的主题盯住" icon={PencilLine}>
              <div className="grid gap-3">
                <InputField
                  label="规则名称"
                  value={monitorForm.label}
                  onChange={(value) => setMonitorForm((state) => ({ ...state, label: value }))}
                  placeholder="例如：OpenAI 新模型"
                />
                <InputField
                  label="监控查询"
                  value={monitorForm.query}
                  onChange={(value) => setMonitorForm((state) => ({ ...state, query: value }))}
                  placeholder="例如：OpenAI release OR new model"
                />
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">监控模式</span>
                  <select
                    className="h-12 rounded-[18px] border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 outline-none transition focus:border-blue-300"
                    onChange={(event) => setMonitorForm((state) => ({ ...state, mode: event.target.value }))}
                    value={monitorForm.mode}
                  >
                    <option value="keyword">关键词</option>
                    <option value="topic">主题</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">别名 / 同义写法</span>
                  <textarea
                    className="min-h-24 rounded-[18px] border border-stone-200 bg-paper-50 px-4 py-3 text-sm text-ink-950 outline-none transition placeholder:text-stone-400 focus:border-blue-300"
                    onChange={(event) => setMonitorForm((state) => ({ ...state, aliases: event.target.value }))}
                    placeholder="例如：GPT-5.4, GPT 5.4, OpenAI GPT"
                    value={monitorForm.aliases}
                  />
                </label>
                <button
                  className="inline-flex h-12 items-center justify-center rounded-full bg-ink-950 px-4 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:opacity-50"
                  disabled={pending || !monitorForm.label || !monitorForm.query}
                  onClick={() =>
                    runMutation(async () => {
                      await createMonitor();
                      setMonitorForm({ label: "", query: "", mode: "keyword", aliases: "" });
                    })
                  }
                >
                  添加规则
                </button>
              </div>
            </SidebarCard>

            <SidebarCard title="通知收件箱" subtitle="高优先级提醒先落在这里" icon={Bell}>
              <div className="grid gap-3">
                {initialData.notifications.length === 0 ? (
                  <EmptySidebar text="还没有通知记录。满足条件的热点会先进入这里，方便你稍后统一处理。" />
                ) : (
                  initialData.notifications.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-stone-200 bg-paper-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-950">{item.subject}</p>
                          <p className="mt-1 text-xs text-stone-500">{formatDateTime(item.createdAt)}</p>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", levelStyles[item.level])}>
                          {item.level}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-stone-600">{item.body}</p>
                    </div>
                  ))
                )}
              </div>
            </SidebarCard>

            <SidebarCard title="最近运行" subtitle="只看最近几次扫描有没有异常" icon={Activity}>
              <div className="grid gap-3">
                {initialData.recentRuns.length === 0 ? (
                  <EmptySidebar text="这里会显示最近扫描的结果和异常信息，方便你快速确认链路是否正常。" />
                ) : (
                  initialData.recentRuns.map((run) => (
                    <div key={run.id} className="rounded-[22px] border border-stone-200 bg-paper-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-ink-950">
                          {run.trigger === "api" ? "API 触发" : run.trigger === "scheduled" ? "定时任务" : "手动触发"}
                        </div>
                        <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600">{run.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-stone-600">
                        候选 {run.summary.candidates} / 热点 {run.summary.hotspots} / 通知 {run.summary.notifications}
                      </p>
                      {run.errorMessage ? <p className="mt-2 text-sm text-red-600">{run.errorMessage}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </SidebarCard>

            <SidebarCard title="来源面板" subtitle="配置入口还在，但不再挤占首页主视线" icon={Settings2}>
              <div className="grid gap-3">
                {initialData.sources.map((source) => (
                  <details key={source.id} className="rounded-[22px] border border-stone-200 bg-paper-50 p-4">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink-950">{source.label}</p>
                          <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", statusStyles[source.lastStatus])}>{source.lastStatus}</span>
                        </div>
                        <p className="text-xs text-stone-500">
                          {sourceKinds[source.kind]} · {source.key}
                        </p>
                      </div>
                      <span className="text-xs text-stone-500">{source.enabled ? "已启用" : "已停用"}</span>
                    </summary>

                    <div className="mt-4 grid gap-3">
                      {source.errorMessage ? <p className="text-sm text-red-600">{source.errorMessage}</p> : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={cn(
                            "rounded-full px-3 py-2 text-xs font-semibold transition",
                            source.enabled
                              ? "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                          )}
                          onClick={() => runMutation(() => toggleSource(source))}
                        >
                          {source.enabled ? "停用来源" : "启用来源"}
                        </button>
                      </div>

                      <textarea
                        className="min-h-36 rounded-[18px] border border-stone-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-ink-950 outline-none transition focus:border-blue-300"
                        onChange={(event) => setSourceDrafts((drafts) => ({ ...drafts, [source.id]: event.target.value }))}
                        value={sourceDrafts[source.id] || ""}
                      />
                      <button
                        className="inline-flex h-11 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-ink-950 transition hover:bg-paper-50"
                        onClick={() => runMutation(() => saveSourceConfig(source))}
                      >
                        保存来源配置
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            </SidebarCard>
          </aside>
        </section>
      </div>
    </main>
  );
}

function SidebarCard({
  title,
  subtitle,
  icon: Icon,
  children
}: {
  title: string;
  subtitle: string;
  icon: typeof Waves;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(35,31,27,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{subtitle}</p>
          <h2 className="mt-2 font-display text-2xl tracking-[-0.04em] text-ink-950">{title}</h2>
        </div>
        <span className="rounded-full border border-stone-200 bg-paper-50 p-3 text-stone-600">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className="mt-4">{children}</div>
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

function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[26px] border border-stone-200 bg-paper-50 p-4">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm font-semibold text-ink-950">{label}</p>
        <span className="font-display text-3xl tracking-[-0.04em] text-ink-950">{value}</span>
      </div>
      <p className="mt-2 text-xs leading-6 text-stone-500">{hint}</p>
    </div>
  );
}

function ReadinessRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-stone-200 bg-paper-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-950">{label}</p>
        <p className="mt-1 text-xs text-stone-500">{value}</p>
      </div>
      <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-emerald-500" : "bg-stone-300")} />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{label}</span>
      <input
        className="h-12 rounded-[18px] border border-stone-200 bg-paper-50 px-4 text-sm text-ink-950 outline-none transition placeholder:text-stone-400 focus:border-blue-300"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function EmptySidebar({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-stone-300 bg-paper-50 p-4 text-sm leading-7 text-stone-500">
      {text}
    </div>
  );
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
