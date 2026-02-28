"use client";

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

export function AuditProgressView({ progress }: AuditProgressViewProps) {
  const t = useTranslations("audit");
  const pct = progress?.progress || 0;

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

        {/* Stage indicators — hidden */}

        {/* Current URL */}
        {progress?.current_url && (
          <div className="mt-4 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-400">
            {progress.current_url}
          </div>
        )}
      </div>
    </div>
  );
}
