"use client";

import { useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ProgressEvent } from "@/types/audit";

interface AuditProgressViewProps {
  progress: ProgressEvent | null;
}

function CircularArc({ pct }: { pct: number }) {
  const size = 160;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4b5563"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#arcGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-copper)" />
            <stop offset="100%" stopColor="var(--color-copper-light)" />
          </linearGradient>
        </defs>
      </svg>
      {/* Percentage text in center */}
      <span className="absolute text-2xl font-bold text-white">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function formatEstimate(seconds: number, t: ReturnType<typeof useTranslations<"audit">>): string {
  if (seconds < 60) return t("estimateSeconds", { count: seconds });
  const mins = Math.ceil(seconds / 60);
  return t("estimateMinutes", { count: mins });
}

export function AuditProgressView({ progress }: AuditProgressViewProps) {
  const t = useTranslations("audit");
  const pct = progress?.progress || 0;
  const logRef = useRef<HTMLDivElement>(null);
  const urlLogRef = useRef<string[]>([]);

  // Accumulate URLs — mutate ref during render (safe: no side effects, deterministic)
  if (progress?.current_url && urlLogRef.current[urlLogRef.current.length - 1] !== progress.current_url) {
    const next = [...urlLogRef.current, progress.current_url];
    urlLogRef.current = next.length > 50 ? next.slice(-50) : next;
  }

  // Derive display slice from the ref (progress identity change triggers re-render)
  const displayLog = useMemo(() => urlLogRef.current.slice(-10), [progress]);  // eslint-disable-line react-hooks/exhaustive-deps -- intentionally re-derive when progress changes

  // Auto-scroll to bottom after render
  const prevLenRef = useRef(0);
  if (displayLog.length !== prevLenRef.current) {
    prevLenRef.current = displayLog.length;
    queueMicrotask(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }

  function getProgressMessage(): string {
    if (!progress) return t("progressConnecting");

    const speedIsBlocking =
      progress.speed_blocking ||
      (progress.current_task_type === "speed" && progress.analyzer_phase === "running");
    if (speedIsBlocking) {
      return t("progressSpeedBlocking");
    }

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


  return (
    <div>
      <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 sm:p-8">
        {/* Circular arc */}
        <div className="mb-6 flex items-center justify-center">
          <CircularArc pct={pct} />
        </div>

        <h2 className="mb-2 text-center text-lg font-semibold text-white">
          {t("auditInProgress")}
        </h2>

        <p className="mb-6 text-center text-sm text-gray-400">
          {getProgressMessage()}
        </p>

        {/* Stats row */}
        {progress && (
          <div className="mb-6 flex items-center justify-center gap-8 sm:gap-12">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{progress.pages_crawled || 0}</div>
              <div className="text-xs text-gray-500">{t("statPagesCrawled")}</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{progress.links_found || 0}</div>
              <div className="text-xs text-gray-500">{t("statLinksFound")}</div>
            </div>
            {progress.estimated_seconds != null && progress.estimated_seconds > 0 && (
              <div className="text-center">
                <div className="text-xl font-bold text-white">
                  {formatEstimate(progress.estimated_seconds, t)}
                </div>
                <div className="text-xs text-gray-500">{t("statTimeRemaining")}</div>
              </div>
            )}
          </div>
        )}

        {/* Live URL log */}
        {displayLog.length > 0 && (
          <div className="relative">
            <div
              ref={logRef}
              className="max-h-56 overflow-y-auto rounded-lg bg-gray-900 px-3 py-2 font-mono text-xs leading-5 text-gray-500"
            >
              {displayLog.map((url, i) => (
                <div key={`${url}-${i}`} className="truncate">
                  {url}
                </div>
              ))}
            </div>
            {/* Top fade */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-lg bg-gradient-to-b from-gray-900 to-transparent" />
            {/* Bottom fade */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-lg bg-gradient-to-t from-gray-900 to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
