"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Bolt,
  Clock3,
  Mail,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from "lucide-react";
import type { DashboardData, HotspotListQuery, NotificationLevel, SourceRecord } from "@/core/contracts";
import { HotspotBoard } from "@/components/hotspot-board";
import { BackgroundBeams } from "@/components/ui/aceternity/background-beams";
import { CardSpotlight } from "@/components/ui/aceternity/card-spotlight";
import { Spotlight } from "@/components/ui/aceternity/spotlight";

const levelStyles: Record<NotificationLevel, string> = {
  high: "border-amber-300/30 bg-amber-300/14 text-amber-100",
  medium: "border-cyan-300/25 bg-cyan-300/12 text-cyan-100",
  low: "border-white/14 bg-white/6 text-slate-200"
};

const sourceKinds: Record<SourceRecord["kind"], string> = {
  search: "网页搜索",
  social: "社交来源",
  structured: "结构化来源",
  custom: "自定义来源"
};

const statusStyles: Record<SourceRecord["lastStatus"], string> = {
  ok: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  idle: "border-white/10 bg-white/6 text-slate-300",
  error: "border-red-300/30 bg-red-300/12 text-red-100"
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
    const breaking = initialData.hotspots[0];
    return {
      highCount,
      healthySources: initialData.sources.filter((item) => item.lastStatus === "ok" || item.lastStatus === "idle").length,
      totalMonitors: initialData.monitors.length,
      averageConfidence:
        initialData.hotspots.length === 0
          ? 0
          : Math.round(
              initialData.hotspots.reduce((sum, item) => sum + (100 - item.credibilityRisk), 0) / initialData.hotspots.length
            ),
      breaking
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
    <main className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,18,0.96),rgba(5,9,16,0.92))] px-5 py-5 shadow-[0_30px_120px_rgba(2,6,23,0.45)] md:px-7 md:py-7">
          <BackgroundBeams className="opacity-90" />
          <Spotlight />
          <div className="radar-grid absolute inset-0 opacity-60" />

          <div className="relative z-10 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
            <CardSpotlight className="min-h-[28rem] p-6 md:p-8">
              <div className="flex h-full flex-col justify-between gap-8">
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.34em] text-slate-300/80">
                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100">
                      <Radar className="h-3.5 w-3.5" />
                      Radar Desk
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      每 30 分钟自动巡检
                    </span>
                  </div>

                  <div className="max-w-4xl space-y-4">
                    <h1 className="font-display text-4xl leading-none tracking-[-0.05em] text-white md:text-6xl xl:text-7xl">Hot Pulse</h1>
                    <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                      一个为 AI 创作者打造的热点指挥台。我们把 X、搜索、社区与官方信号压缩进一条情报流，让你更快判断什么值得立刻追、立刻写、立刻发。
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <SignalMetric icon={Bolt} label="高优先级热点" value={String(metrics.highCount)} hint="适合优先判断是否立即开写" tone="amber" />
                    <SignalMetric
                      icon={ShieldCheck}
                      label="来源健康"
                      value={`${metrics.healthySources}/${initialData.sources.length}`}
                      hint="当前可用采集源"
                      tone="cyan"
                    />
                    <SignalMetric icon={Search} label="监控规则" value={String(metrics.totalMonitors)} hint="关键词与主题并行追踪" tone="emerald" />
                    <SignalMetric
                      icon={TrendingUp}
                      label="平均可信"
                      value={`${metrics.averageConfidence}%`}
                      hint="综合风险后的参考值"
                      tone="violet"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-400">建议动作</p>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-white">
                        {metrics.breaking ? `优先处理：${metrics.breaking.title}` : "先执行一次扫描，开始建立你的热点雷达。"}
                      </p>
                      <p className="max-w-2xl text-sm text-slate-300">
                        {metrics.breaking
                          ? `它当前拥有 ${metrics.breaking.evidenceCount} 条证据，综合分 ${metrics.breaking.finalScore}，适合先看证据再决定是否对外分享。`
                          : "系统会自动聚合多源重复出现的内容，避免你在多个信息流之间来回切换。"}
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
              </div>
            </CardSpotlight>

            <div className="grid gap-4">
              <CardSpotlight className="p-5">
                <SectionHeader title="作战状态" subtitle="关键能力是否已经就绪" icon={Activity} compact />
                <div className="mt-5 grid gap-3">
                  <ReadinessRow label="OpenRouter 分析" value={initialData.env.hasOpenRouter ? "已连接" : "缺少密钥"} active={initialData.env.hasOpenRouter} />
                  <ReadinessRow label="twitterapi.io" value={initialData.env.hasTwitterApi ? "已连接" : "缺少密钥"} active={initialData.env.hasTwitterApi} />
                  <ReadinessRow label="邮件提醒" value={initialData.env.hasEmail ? "可发送" : "未配置"} active={initialData.env.hasEmail} />
                </div>
              </CardSpotlight>

              <CardSpotlight className="p-5">
                <SectionHeader title="新增监控规则" subtitle="先把你最想抢的选题盯住" icon={Sparkles} compact />
                <div className="mt-5 grid gap-3">
                  <InputField
                    label="规则名称"
                    onChange={(value) => setMonitorForm((state) => ({ ...state, label: value }))}
                    placeholder="例如：OpenAI 新模型"
                    value={monitorForm.label}
                  />
                  <InputField
                    label="监控查询"
                    onChange={(value) => setMonitorForm((state) => ({ ...state, query: value }))}
                    placeholder="例如：OpenAI release OR new model"
                    value={monitorForm.query}
                  />
                  <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.26em] text-slate-400">监控模式</span>
                    <select
                      className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition focus:border-cyan-300/50"
                      onChange={(event) => setMonitorForm((state) => ({ ...state, mode: event.target.value }))}
                      value={monitorForm.mode}
                    >
                      <option value="keyword">关键词</option>
                      <option value="topic">主题</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.26em] text-slate-400">别名 / 同义写法</span>
                    <textarea
                      className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                      onChange={(event) => setMonitorForm((state) => ({ ...state, aliases: event.target.value }))}
                      placeholder="例如：GPT-5.4, GPT 5.4, OpenAI GPT"
                      value={monitorForm.aliases}
                    />
                  </label>
                  <button
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50"
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
              </CardSpotlight>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.28fr_0.72fr]">
          <HotspotBoard hotspots={initialData.hotspots} monitors={initialData.monitors} query={hotspotQuery} sources={initialData.sources} />

          <div className="grid gap-5">
            <SectionHeader title="通知与运行" subtitle="盯住输出节奏，避免漏掉最佳发布窗口" icon={Bell} />

            <CardSpotlight className="p-5">
              <SectionHeader title="通知收件箱" subtitle="高优先级热点会先落这里" icon={Mail} compact />
              <div className="mt-4 grid gap-3">
                {initialData.notifications.length === 0 ? (
                  <EmptyPanel
                    compact
                    description="一旦高优先级热点满足推送条件，系统会先写入站内收件箱，再按配置发送邮件。"
                    title="还没有通知记录"
                  />
                ) : (
                  initialData.notifications.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">{item.subject}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${levelStyles[item.level]}`}>
                          {item.level}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
                    </div>
                  ))
                )}
              </div>
            </CardSpotlight>

            <CardSpotlight className="p-5">
              <SectionHeader title="运行时间线" subtitle="最近的扫描执行情况" icon={Clock3} compact />
              <div className="mt-5 space-y-4">
                {initialData.recentRuns.length === 0 ? (
                  <EmptyPanel compact description="点击“立即扫描”后，这里会出现最近一次任务的状态、候选数和通知数。" title="还没有运行记录" />
                ) : (
                  initialData.recentRuns.map((run) => (
                    <div key={run.id} className="relative pl-6">
                      <span className="absolute left-2 top-1 h-full w-px bg-white/10" />
                      <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border border-cyan-300/40 bg-cyan-300/10" />
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <ShieldAlert className="h-4 w-4 text-amber-200" />
                            {run.trigger === "api" ? "API 触发" : run.trigger === "scheduled" ? "定时任务" : "手动触发"}
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">{run.status}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          候选 {run.summary.candidates} / 热点 {run.summary.hotspots} / 通知 {run.summary.notifications}
                        </p>
                        {run.errorMessage ? <p className="mt-2 text-sm text-red-200">{run.errorMessage}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardSpotlight>
          </div>
        </section>

        <section className="grid gap-5">
          <SectionHeader title="来源控制台" subtitle="调整采集策略，但保持第一屏专注于热点判断" icon={Settings2} />
          <div className="grid gap-4 lg:grid-cols-2">
            {initialData.sources.map((source) => (
              <CardSpotlight key={source.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl text-white">{source.label}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusStyles[source.lastStatus]}`}>{source.lastStatus}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">{sourceKinds[source.kind]}</span>
                    </div>
                    <p className="text-sm text-slate-400">{source.key}</p>
                    {source.errorMessage ? <p className="text-sm text-red-200">{source.errorMessage}</p> : null}
                  </div>

                  <button
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      source.enabled
                        ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/18"
                        : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                    onClick={() => runMutation(() => toggleSource(source))}
                  >
                    {source.enabled ? "已启用" : "已停用"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  <details className="group rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                    <summary className="cursor-pointer list-none text-sm font-medium text-white">查看与编辑 JSON 配置</summary>
                    <p className="mt-2 text-xs leading-6 text-slate-400">这里保留高级配置入口，避免日常操作被大段 JSON 打断。</p>
                    <textarea
                      className="mt-4 min-h-40 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none transition focus:border-cyan-300/50"
                      onChange={(event) => setSourceDrafts((drafts) => ({ ...drafts, [source.id]: event.target.value }))}
                      value={sourceDrafts[source.id] || ""}
                    />
                  </details>

                  <button
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:border-cyan-300/35 hover:bg-cyan-300/10"
                    onClick={() => runMutation(() => saveSourceConfig(source))}
                  >
                    保存来源配置
                  </button>
                </div>
              </CardSpotlight>
            ))}
          </div>
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
  children: React.ReactNode;
  loading: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      className={`inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-50 ${
        variant === "primary"
          ? "bg-white text-slate-950 hover:bg-cyan-100"
          : "border border-white/12 bg-white/6 text-white hover:border-cyan-300/35 hover:bg-cyan-300/10"
      }`}
      disabled={loading}
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {children}
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  compact = false
}: {
  title: string;
  subtitle: string;
  icon: typeof Bolt;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${compact ? "" : "mb-1"}`}>
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{subtitle}</p>
        <h2 className="mt-2 font-display text-2xl tracking-[-0.03em] text-white">{title}</h2>
      </div>
      <div className="rounded-full border border-white/10 bg-white/5 p-3 text-cyan-100">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function SignalMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone
}: {
  icon: typeof Bolt;
  label: string;
  value: string;
  hint: string;
  tone: "amber" | "cyan" | "emerald" | "violet";
}) {
  const accentMap = {
    amber: "text-amber-200 border-amber-300/20 bg-amber-300/10",
    cyan: "text-cyan-100 border-cyan-300/20 bg-cyan-300/10",
    emerald: "text-emerald-100 border-emerald-300/20 bg-emerald-300/10",
    violet: "text-violet-100 border-violet-300/20 bg-violet-300/10"
  } as const;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border px-2.5 py-1 ${accentMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-display text-3xl tracking-[-0.04em] text-white">{value}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-100">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{hint}</p>
    </div>
  );
}

function ReadinessRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-1 text-xs text-slate-400">{value}</p>
      </div>
      <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.85)]" : "bg-slate-500"}`} />
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
      <span className="text-[11px] uppercase tracking-[0.26em] text-slate-400">{label}</span>
      <input
        className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function EmptyPanel({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-start justify-center rounded-[24px] border border-dashed border-white/14 bg-white/[0.03] px-5 py-6 ${
        compact ? "" : "min-h-52"
      }`}
    >
      <h3 className="font-display text-xl text-white">{title}</h3>
      <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">{description}</p>
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
