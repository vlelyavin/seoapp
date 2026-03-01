"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  BookOpen,
} from "lucide-react";
import { useTranslations } from "next-intl";
import DOMPurify from "isomorphic-dompurify";
import { IssueCard } from "./issue-card";
import { AnalyzerTable } from "./analyzer-table";
import { cn } from "@/lib/utils";
import type { AnalyzerResult, SeverityLevel } from "@/types/audit";
import { SEVERITY_COLORS } from "@/types/audit";

interface AnalyzerSectionProps {
  result: AnalyzerResult;
}

const severityIcons: Record<SeverityLevel, React.ComponentType<{ className?: string }>> = {
  error: XCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const TOOLTIP_KEYS: Record<string, string> = {
  meta_tags: "tooltipMetaTags",
  headings: "tooltipHeadings",
  page_404: "tooltipPage404",
  images: "tooltipImages",
  links: "tooltipLinks",
  robots: "tooltipRobots",
  security: "tooltipSecurity",
  content: "tooltipContent",
  external_links: "tooltipExternalLinks",
  content_sections: "tooltipContentSections",
  hreflang: "tooltipHreflang",
  cms: "tooltipCms",
  speed: "tooltipSpeed",
  favicon: "tooltipFavicon",
  structure: "tooltipStructure",
  schema: "tooltipSchema",
  social_tags: "tooltipSocialTags",
  mobile: "tooltipMobile",
  url_quality: "tooltipUrlQuality",
  duplicates: "tooltipDuplicates",
  redirects: "tooltipRedirects",
};

export function AnalyzerSection({ result }: AnalyzerSectionProps) {
  const [expanded, setExpanded] = useState(
    result.severity === "error" || result.severity === "warning"
  );
  const [showTheory, setShowTheory] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const t = useTranslations("audit");

  const SevIcon = severityIcons[result.severity];
  const colors = SEVERITY_COLORS[result.severity];
  const issueCount = result.issues.reduce((sum, i) => sum + i.count, 0);
  const tooltipKey = TOOLTIP_KEYS[result.name];

  return (
    <div className={cn("rounded-xl border", colors.border, "overflow-hidden")}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          colors.bg,
          "hover:opacity-90"
        )}
      >
        <SevIcon className={cn("h-5 w-5 shrink-0", colors.text)} />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white">
            {result.display_name}
            {tooltipKey && (
              <span
                className="relative inline-flex"
                onMouseEnter={(e) => { e.stopPropagation(); setShowTooltip(true); }}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 transition-colors" />
                {showTooltip && (
                  <span className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-xs font-normal text-gray-300 shadow-xl z-10">
                    {t(tooltipKey)}
                  </span>
                )}
              </span>
            )}
          </h3>
          {result.summary && (
            <p className="mt-0.5 truncate text-xs text-gray-400">
              {result.summary}
            </p>
          )}
        </div>
        {issueCount > 0 && (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors.bg, colors.text)}>
            {issueCount}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-gray-700 bg-gray-950 p-4">
          {/* Description */}
          {result.description && (
            <p className="mb-3 text-sm text-gray-400">
              {result.description}
            </p>
          )}

          {/* Theory toggle */}
          {result.theory && (
            <div className="mb-4">
              <button
                onClick={() => setShowTheory(!showTheory)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-300 underline hover:text-white"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {showTheory ? t("hideTheory") : t("showTheory")}
              </button>
              {showTheory && (
                <div
                  className="mt-2 whitespace-pre-line rounded-lg border border-gray-700 bg-gray-900 p-3 text-xs leading-relaxed text-gray-300"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.theory) }}
                />
              )}
            </div>
          )}

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              {result.issues.map((issue, idx) => (
                <IssueCard key={idx} issue={issue} />
              ))}
            </div>
          )}

          {/* No issues */}
          {result.issues.length === 0 && result.severity === "success" && (
            <div className="flex items-center gap-2 rounded-lg bg-green-900/10 p-3 text-sm text-green-400">
              <CheckCircle className="h-4 w-4" />
              {t("noIssuesFound")}
            </div>
          )}

          {/* Tables */}
          {result.tables.length > 0 && (
            <div className="mt-4 space-y-4">
              {result.tables.map((table, idx) => (
                <AnalyzerTable key={idx} table={table} analyzerName={result.name} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
