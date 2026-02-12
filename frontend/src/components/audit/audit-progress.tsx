"use client";

import { Loader2, ArrowLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/types/audit";

interface AuditProgressViewProps {
  progress: ProgressEvent | null;
}

export function AuditProgressView({ progress }: AuditProgressViewProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("audit");
  const pct = progress?.progress || 0;
  const message = progress?.message || "Connecting...";
  const stage = progress?.stage || "crawling";
  const pagesCrawled = progress?.pages_crawled || 0;

  const stages = [
    { key: "crawling", label: t("stageCrawling") },
    { key: "analyzing", label: t("stageAnalyzing") },
    { key: "report", label: t("stageGeneratingReport") },
  ];

  return (
    <div className="mx-auto max-w-xl py-16">
      <button
        onClick={() => router.push(`/${locale}/dashboard`)}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToDashboard")}
      </button>
      <div className="rounded-xl border bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-gray-900 dark:text-white" />
        </div>

        <h2 className="mb-2 text-center text-lg font-semibold text-gray-900 dark:text-white">
          {t("auditInProgress")}
        </h2>

        <p className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {message}
        </p>

        {/* Unified Progress Bar with Milestones */}
        <div className="mb-6">
          {/* Percentage and page count labels */}
          <div className="mb-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{Math.round(pct)}%</span>
            {pagesCrawled > 0 && <span>{pagesCrawled} pages</span>}
          </div>

          {/* Progress track with embedded milestones */}
          <div className="relative pb-10">
            {/* Background track */}
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              {/* Animated progress fill */}
              <div
                className="h-full rounded-full bg-gray-900 dark:bg-white transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Connecting lines between milestones */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ height: '8px', top: '0' }}
            >
              {stages.slice(0, -1).map((s, i) => {
                const startPos = ((i + 1) / stages.length) * 100;
                const endPos = ((i + 2) / stages.length) * 100;
                const currentStageIndex = stages.findIndex((x) => x.key === stage);
                const isCompleted = currentStageIndex > i;

                return (
                  <line
                    key={`line-${i}`}
                    x1={`${startPos}%`}
                    y1="50%"
                    x2={`${endPos}%`}
                    y2="50%"
                    stroke={isCompleted ? "#16a34a" : "#d1d5db"}
                    strokeWidth="2"
                    className="transition-colors duration-300 dark:stroke-gray-600"
                    style={isCompleted ? {} : { stroke: 'currentColor' }}
                  />
                );
              })}
            </svg>

            {/* Milestone markers positioned absolutely */}
            <div className="absolute inset-0 flex items-start">
              {stages.map((s, i) => {
                const isActive = s.key === stage;
                const currentStageIndex = stages.findIndex((x) => x.key === stage);
                const isPast = currentStageIndex > i;
                const position = ((i + 1) / stages.length) * 100;

                return (
                  <div
                    key={s.key}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                  >
                    {/* Milestone circle */}
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300",
                        isPast
                          ? "border-green-600 bg-green-600 text-white dark:border-green-400 dark:bg-green-400"
                          : isActive
                            ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-black animate-pulse"
                            : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900"
                      )}
                    >
                      {isPast ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="text-xs font-semibold">{i + 1}</span>
                      )}
                    </div>

                    {/* Stage label below */}
                    <span
                      className={cn(
                        "absolute top-8 whitespace-nowrap text-xs",
                        isActive
                          ? "font-medium text-gray-900 dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current URL */}
        {progress?.current_url && (
          <div className="mt-4 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {progress.current_url}
          </div>
        )}
      </div>
    </div>
  );
}
