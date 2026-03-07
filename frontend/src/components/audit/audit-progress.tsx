"use client";

import { useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Globe, Link2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/types/audit";

interface AuditProgressViewProps {
  progress: ProgressEvent | null;
  connected: boolean;
  isPolling: boolean;
}

/* ── Progress Ring ─────────────────────────────────────────── */

function ProgressRing({ pct, size = 200 }: { pct: number; size?: number }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#262626"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-copper-light)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-3xl font-bold text-white">
        {Math.round(pct)}%
      </span>
    </div>
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

function formatEstimate(seconds: number, t: ReturnType<typeof useTranslations<"audit">>): string {
  if (seconds < 60) return t("estimateSeconds", { count: seconds });
  const mins = Math.ceil(seconds / 60);
  return t("estimateMinutes", { count: mins });
}

function formatUrlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function getProgressMessage(progress: ProgressEvent | null, t: ReturnType<typeof useTranslations<"audit">>): string {
  if (!progress) return t("progressConnecting");

  const speedIsBlocking =
    progress.speed_blocking ||
    (progress.current_task_type === "speed" && progress.analyzer_phase === "running");
  if (speedIsBlocking) return t("progressSpeedBlocking");

  switch (progress.stage) {
    case "crawling":
      return progress.pages_crawled
        ? t("progressCrawling", { count: progress.pages_crawled })
        : t("progressCrawlingStart");
    case "analyzing":
      return progress.current_task_type === "analyzing" &&
        progress.analyzer_name &&
        progress.analyzer_phase === "running"
        ? t("progressAnalyzingName", { name: progress.analyzer_name })
        : t("progressAnalyzing");
    case "report":
    case "generating_report":
      return t("progressGeneratingReport");
    default:
      return t("progressConnecting");
  }
}

/* ── Activity Log Entry ────────────────────────────────────── */

interface ActivityEntry {
  id: string;
  type: "url" | "stage" | "analyzer" | "analyzer_done";
  label: string;
}

/* ── Main Component ────────────────────────────────────────── */

export function AuditProgressView({ progress, connected, isPolling }: AuditProgressViewProps) {
  const t = useTranslations("audit");
  const pct = progress?.progress || 0;
  const logRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<ActivityEntry[]>([]);
  const lastUrlRef = useRef<string | null>(null);
  const lastStageRef = useRef<string | null>(null);
  const lastAnalyzerRef = useRef<string | null>(null);
  const lastAnalyzerCompleteRef = useRef<string | null>(null);
  const entryIdRef = useRef(0);

  // Build activity log from progress changes
  if (progress) {
    // Track URL changes
    if (progress.current_url && progress.current_url !== lastUrlRef.current) {
      lastUrlRef.current = progress.current_url;
      activityRef.current = [
        ...activityRef.current,
        { id: String(++entryIdRef.current), type: "url", label: formatUrlPath(progress.current_url) },
      ];
      if (activityRef.current.length > 20) {
        activityRef.current = activityRef.current.slice(-20);
      }
    }

    // Track stage changes
    if (progress.stage && progress.stage !== lastStageRef.current) {
      lastStageRef.current = progress.stage;
      const stageLabel =
        progress.stage === "crawling" ? t("stageCrawling") :
        progress.stage === "analyzing" ? t("stageAnalyzing") :
        t("stageGeneratingReport");
      activityRef.current = [
        ...activityRef.current,
        { id: String(++entryIdRef.current), type: "stage", label: stageLabel },
      ];
      if (activityRef.current.length > 20) {
        activityRef.current = activityRef.current.slice(-20);
      }
    }

    // Track analyzer starts
    if (
      progress.analyzer_name &&
      progress.analyzer_phase === "running" &&
      progress.analyzer_name !== lastAnalyzerRef.current
    ) {
      lastAnalyzerRef.current = progress.analyzer_name;
      activityRef.current = [
        ...activityRef.current,
        { id: String(++entryIdRef.current), type: "analyzer", label: progress.analyzer_name },
      ];
      if (activityRef.current.length > 20) {
        activityRef.current = activityRef.current.slice(-20);
      }
    }

    // Track analyzer completions
    if (
      progress.analyzer_name &&
      progress.analyzer_phase === "completed" &&
      `completed-${progress.analyzer_name}` !== lastAnalyzerCompleteRef.current
    ) {
      lastAnalyzerCompleteRef.current = `completed-${progress.analyzer_name}`;
      activityRef.current = [
        ...activityRef.current,
        { id: String(++entryIdRef.current), type: "analyzer_done", label: `✓ ${progress.analyzer_name}` },
      ];
      if (activityRef.current.length > 20) {
        activityRef.current = activityRef.current.slice(-20);
      }
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayLog = useMemo(() => activityRef.current.slice(-20), [progress]);

  // Auto-scroll activity feed
  const prevLenRef = useRef(0);
  if (displayLog.length !== prevLenRef.current) {
    prevLenRef.current = displayLog.length;
    queueMicrotask(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }

  const currentStage = getPipelineStage(progress);

  // Connection badge
  const connectionMeta = connected && !isPolling
    ? { dotClass: "bg-emerald-400 animate-pulse", label: t("transportLive") }
    : isPolling
      ? { dotClass: "bg-amber-400", label: t("transportPolling") }
      : { dotClass: "bg-copper-light animate-pulse", label: t("transportReconnecting") };

  // Analyzer progress description for pipeline
  function getAnalyzerDescription(): string {
    if (currentStage !== "analyzing" || !progress) return "";
    const completed = progress.analyzers_completed ?? 0;
    const total = progress.analyzers_total ?? 0;
    const count = total > 0 ? ` (${completed}/${total})` : "";
    if (progress.analyzer_name) return `${progress.analyzer_name}${count}`;
    if (total > 0) return `${completed}/${total} analyzers`;
    return "";
  }

  const pipelineStages: { key: Stage; label: string; description: string }[] = [
    { key: "crawling", label: t("stageCrawling"), description: currentStage === "crawling" ? getProgressMessage(progress, t) : "" },
    { key: "analyzing", label: t("stageAnalyzing"), description: getAnalyzerDescription() },
    { key: "report", label: t("stageGeneratingReport"), description: "" },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("auditInProgress")}</h2>
          <p className="mt-0.5 text-sm text-gray-400">{getProgressMessage(progress, t)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300">
            <span className={cn("h-1.5 w-1.5 rounded-full", connectionMeta.dotClass)} />
            {connectionMeta.label}
          </span>
          {/* Stage badge */}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300">
            <span className="h-1.5 w-1.5 rounded-full bg-copper-light animate-pulse" />
            {currentStage === "crawling" ? t("stageCrawling") : currentStage === "analyzing" ? t("stageAnalyzing") : t("stageGeneratingReport")}
          </span>
          {/* ETA badge */}
          {progress?.estimated_seconds != null && progress.estimated_seconds > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300">
              <Clock className="h-3 w-3 text-gray-500" />
              {formatEstimate(progress.estimated_seconds, t)}
            </span>
          )}
        </div>
      </div>

      {/* Body: two-column grid */}
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
        {/* Left column: ring + metrics + pipeline */}
        <div className="space-y-6">
          {/* Progress ring */}
          <div className="flex justify-center">
            <ProgressRing pct={pct} size={200} />
          </div>

          {/* Metric cards */}
          {progress && (
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                icon={Globe}
                value={String(progress.pages_crawled || 0)}
                label={t("statPagesCrawled")}
              />
              <MetricCard
                icon={Link2}
                value={String(progress.links_found || 0)}
                label={t("statLinksFound")}
              />
              {progress.estimated_seconds != null && progress.estimated_seconds > 0 ? (
                <MetricCard
                  icon={Clock}
                  value={formatEstimate(progress.estimated_seconds, t)}
                  label={t("statTimeRemaining")}
                />
              ) : (
                <MetricCard
                  icon={Clock}
                  value="--"
                  label={t("statTimeRemaining")}
                />
              )}
            </div>
          )}

          {/* Pipeline stepper */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="space-y-3">
              {pipelineStages.map((stage, i) => {
                const state = getStageState(currentStage, stage.key);
                return (
                  <div key={stage.key} className="flex items-start gap-3">
                    {/* Dot + connector line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full border-2 mt-0.5",
                          state === "done" && "border-green-500 bg-green-500",
                          state === "active" && "border-copper-light bg-copper-light",
                          state === "upcoming" && "border-gray-600 bg-transparent"
                        )}
                      />
                      {i < pipelineStages.length - 1 && (
                        <div
                          className={cn(
                            "mt-1 h-5 w-px",
                            state === "done" ? "bg-green-500/40" : "bg-gray-700"
                          )}
                        />
                      )}
                    </div>
                    {/* Text */}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          state === "done" && "text-gray-400",
                          state === "active" && "text-white",
                          state === "upcoming" && "text-gray-600"
                        )}
                      >
                        {stage.label}
                      </p>
                      {state === "active" && stage.description && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{stage.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: activity feed */}
        <div className="flex flex-col">
          <h3 className="mb-3 text-sm font-medium text-gray-400">Live Activity</h3>
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-3 max-h-[500px]"
          >
            {displayLog.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">{t("noActivityYet")}</p>
            ) : (
              <div className="space-y-1.5">
                {displayLog.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        entry.type === "url" && "bg-emerald-400",
                        entry.type === "stage" && "bg-gray-400",
                        entry.type === "analyzer" && "bg-copper-light",
                        entry.type === "analyzer_done" && "bg-emerald-400"
                      )}
                    />
                    <span
                      className={cn(
                        "truncate",
                        entry.type === "stage" ? "font-medium text-gray-300" : "text-gray-500"
                      )}
                    >
                      {entry.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Metric Card (matches StatCard from audit-results) ───── */

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-gray-900 p-2">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-white leading-tight">{value}</p>
          <p className="text-[11px] text-gray-500 leading-tight truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}
