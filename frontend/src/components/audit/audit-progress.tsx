"use client";

import { useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Globe,
  Link2,
  ExternalLink,
  AlertTriangle,
  ArrowRightLeft,
  Gauge,
  Clock,
  CheckCircle2,
  ListTodo,
  ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/types/audit";

export interface ActivityEntry {
  id: string;
  type: "url" | "stage" | "analyzer" | "analyzer_done";
  label: string;
  statusCode?: number;
  responseTime?: number;
}

interface AuditProgressViewProps {
  progress: ProgressEvent | null;
  activityLog: ActivityEntry[];
  status?: string | null;
  connected?: boolean;
  isPolling?: boolean;
}

/* ── Animated number ─────────────────────────────────────── */

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value) return;

    const diff = value - prev;
    const steps = Math.min(Math.abs(diff), 20);
    if (steps === 0) {
      setDisplay(value);
      return;
    }

    const stepSize = diff / steps;
    let step = 0;

    const id = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(id);
      } else {
        setDisplay(Math.round(prev + stepSize * step));
      }
    }, 30);

    return () => clearInterval(id);
  }, [value]);

  return (
    <>
      {display}
      {suffix}
    </>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

type Stage = "crawling" | "analyzing" | "report";

function normalizeStage(raw?: string | null): Stage {
  if (!raw) return "crawling";
  if (raw === "generating_report" || raw === "report") return "report";
  if (raw === "analyzing") return "analyzing";
  return "crawling";
}

function getPipelineStage(progress: ProgressEvent | null): Stage {
  if (!progress) return "crawling";
  return normalizeStage(progress.stage);
}

function getStageState(current: Stage, target: Stage): "done" | "active" | "upcoming" {
  const order: Stage[] = ["crawling", "analyzing", "report"];
  const ci = order.indexOf(current);
  const ti = order.indexOf(target);
  if (ti < ci) return "done";
  if (ti === ci) return "active";
  return "upcoming";
}

function getPhaseLabel(progress: ProgressEvent | null, t: ReturnType<typeof useTranslations<"audit">>): string {
  if (!progress) return t("progressConnecting");

  const speedIsBlocking =
    progress.speed_blocking || (progress.current_task_type === "speed" && progress.analyzer_phase === "running");
  if (speedIsBlocking) return t("progressSpeedBlocking");

  switch (progress.stage) {
    case "crawling":
      return t("stageCrawling");
    case "analyzing":
      return t("stageAnalyzing");
    case "report":
    case "generating_report":
      return t("stageGeneratingReport");
    default:
      return t("progressConnecting");
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/* ── Main Component ────────────────────────────────────────── */

export function AuditProgressView({ progress, activityLog, status, connected, isPolling }: AuditProgressViewProps) {
  const t = useTranslations("audit");
  const pct = progress?.progress || 0;
  const currentStage = getPipelineStage(progress);
  const isRunning = status !== "completed" && status !== "failed";
  const phaseLabel = getPhaseLabel(progress, t);

  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pipelineStages: { key: Stage; label: string; icon: typeof Globe }[] = [
    { key: "crawling", label: t("stageCrawling"), icon: Globe },
    { key: "analyzing", label: t("stageAnalyzing"), icon: ScanSearch },
    { key: "report", label: t("stageGeneratingReport"), icon: ListTodo },
  ];

  return (
    <div className="space-y-4">
      {/* ── Top: Progress bar + phase + stepper ── */}
      <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 sm:p-6">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{phaseLabel}</h2>
            {progress?.stage === "analyzing" && progress.analyzers_total ? (
              <span className="text-sm text-gray-400">
                {progress.analyzers_completed ?? 0} / {progress.analyzers_total}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {/* Estimated time */}
            {progress?.estimated_seconds != null && progress.estimated_seconds > 0 && (
              <span className="text-xs text-gray-500">~{formatElapsed(progress.estimated_seconds)}</span>
            )}
            {/* Connection indicator */}
            {connected && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400">{t("transportLive")}</span>
              </div>
            )}
            {!connected && isPolling && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-400">{t("transportPolling")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mb-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                currentStage === "crawling" && pct === 0
                  ? "animate-progress-indeterminate bg-gradient-to-r from-transparent via-copper-light to-transparent"
                  : "bg-copper-light",
              )}
              style={currentStage === "crawling" && pct === 0 ? { width: "100%" } : { width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        </div>

        {/* Step indicator — two layers: line underneath, steps on top */}
        <div className="relative w-full">
          {/* Bottom layer: full-width connecting line */}
          <div className="absolute top-4 left-[16px] right-[16px] h-px bg-gray-800">
            <div
              className="absolute top-0 left-0 h-px transition-all duration-700"
              style={{
                width: currentStage === "crawling" ? "0%" : currentStage === "analyzing" ? "50%" : "100%",
                background: status === "completed" ? "rgba(16,185,129,0.6)" : "rgba(217,171,111,0.6)",
              }}
            />
          </div>

          {/* Top layer: three steps — left, center, right */}
          <div className="relative flex w-full items-center justify-between">
            {pipelineStages.map((stage) => {
              const state = getStageState(currentStage, stage.key);
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex shrink-0 items-center">
                  <div className="relative flex items-center justify-center">
                    {/* Spinning arc for active step */}
                    {state === "active" && (
                      <div className="absolute inset-[-3px] animate-step-spin rounded-full border-2 border-transparent border-t-copper-light border-r-copper-light border-b-copper-light" />
                    )}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors bg-gray-950",
                        state === "done" && status === "completed" && "border-emerald-500 bg-emerald-900",
                        state === "done" && status !== "completed" && "border-copper-light bg-amber-950",
                        state === "active" && "border-transparent bg-amber-950",
                        state === "upcoming" && "border-gray-700",
                      )}
                    >
                      {state === "done" ? (
                        <CheckCircle2
                          className={cn("h-4 w-4 shrink-0", status === "completed" ? "text-emerald-400" : "text-copper-light")}
                        />
                      ) : (
                        <Icon className={cn("h-4 w-4 shrink-0", state === "active" ? "text-copper-light" : "text-gray-600")} />
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm whitespace-nowrap hidden sm:inline px-2 bg-gray-950",
                      state === "done" && "text-gray-400",
                      state === "active" && "font-medium text-white",
                      state === "upcoming" && "text-gray-600",
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Middle: Metric cards grid ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard icon={Globe} value={progress?.pages_crawled || 0} label={t("statPagesCrawled")} />
        <MetricCard icon={Link2} value={progress?.links_found || 0} label={t("statLinksFound")} />
        <MetricCard icon={ExternalLink} value={progress?.external_links_count || 0} label={t("statExternalLinks")} />
        <MetricCard
          icon={AlertTriangle}
          value={(progress?.errors_4xx || 0) + (progress?.errors_5xx || 0)}
          label={t("statErrors")}
          accent={(progress?.errors_4xx || 0) + (progress?.errors_5xx || 0) > 0 ? "red" : undefined}
        />
        <MetricCard
          icon={ArrowRightLeft}
          value={progress?.redirects_3xx || 0}
          label={t("statRedirects")}
          accent={(progress?.redirects_3xx || 0) > 0 ? "yellow" : undefined}
        />
        <MetricCard
          icon={progress?.avg_response_time != null ? Gauge : Clock}
          value={progress?.avg_response_time != null ? Math.round(progress.avg_response_time) : elapsed}
          label={progress?.avg_response_time != null ? t("statAvgResponse") : t("statElapsed")}
          suffix={progress?.avg_response_time != null ? "ms" : undefined}
          formatValue={progress?.avg_response_time == null ? formatElapsed : undefined}
          accent={
            progress?.avg_response_time != null
              ? progress.avg_response_time > 3000
                ? "red"
                : progress.avg_response_time > 1000
                  ? "yellow"
                  : "green"
              : undefined
          }
        />
      </div>

      {/* ── Live Activity URL log ── */}
      {activityLog.length > 0 && <ActivityLog entries={activityLog} />}

      {/* CSS animations */}
      <style jsx>{`
        @keyframes progress-indeterminate {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-progress-indeterminate {
          animation: progress-indeterminate 1.5s ease-in-out infinite;
        }
        @keyframes step-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-step-spin {
          animation: step-spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}

/* ── Metric Card ──────────────────────────────────────────── */

function MetricCard({
  icon: Icon,
  value,
  label,
  accent,
  suffix,
  formatValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  accent?: "green" | "yellow" | "red";
  suffix?: string;
  formatValue?: (v: number) => string;
}) {
  const accentColors = {
    green: {
      icon: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    yellow: {
      icon: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
    },
    red: {
      icon: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
  };

  const colors = accent ? accentColors[accent] : null;

  return (
    <div
      className={cn("rounded-xl border bg-gray-950 p-4 transition-colors", colors ? colors.border : "border-gray-800")}
    >
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", colors ? colors.bg : "bg-gray-900")}>
          <Icon className={cn("h-5 w-5", colors ? colors.icon : "text-white")} />
        </div>
        <div>
          <p className={cn("text-2xl font-bold leading-none", colors ? colors.icon : "text-white")}>
            {formatValue ? formatValue(value) : <AnimatedNumber value={value} suffix={suffix ? ` ${suffix}` : ""} />}
          </p>
          <p className="mt-1 text-xs text-gray-400 truncate leading-tight">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Activity Log ─────────────────────────────────────────── */

function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const statusColor = (code?: number) => {
    if (!code || code === 0) return "text-red-400";
    if (code >= 200 && code < 300) return "text-emerald-400";
    if (code >= 300 && code < 400) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 sm:p-6">
      <div ref={scrollRef} className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2">
            {entry.type === "url" && (
              <>
                {entry.statusCode != null && (
                  <span className={cn("w-8 shrink-0 text-right uppercase", statusColor(entry.statusCode))}>
                    {entry.statusCode === 0 ? "ERR" : entry.statusCode}
                  </span>
                )}
                <span className="truncate text-gray-300">{entry.label}</span>
                {entry.responseTime != null && (
                  <span className="ml-auto shrink-0 text-gray-600">{entry.responseTime}ms</span>
                )}
              </>
            )}
            {entry.type === "stage" && <span className="font-semibold text-copper-light">▸ {entry.label}</span>}
            {entry.type === "analyzer" && <span className="text-gray-400">◆ {entry.label}</span>}
            {entry.type === "analyzer_done" && <span className="text-emerald-400/70">{entry.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
