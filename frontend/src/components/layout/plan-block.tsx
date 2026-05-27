"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { IndexatorUsage, AuditorUsage } from "@/hooks/use-plan-usage";

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-gray-800">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct > 95 ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-copper"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface PlanBlockProps {
  context: "auditor" | "indexator" | "other";
  indexatorUsage: IndexatorUsage | null;
  auditorUsage: AuditorUsage | null;
  onNavigate?: () => void;
}

// Billing disabled: this is now a slim usage panel (no plan name / upgrade UI).
// It only surfaces the indexator's real Google API quotas, which are hard
// per-day limits imposed by Google and apply to every user regardless of plan.
export function PlanBlock({ context, indexatorUsage }: PlanBlockProps) {
  const tNav = useTranslations("nav");

  if (context !== "indexator" || !indexatorUsage) return null;

  return (
    <div className="border-t border-gray-800 p-3">
      <div className="space-y-2.5 rounded-lg bg-gray-950 p-3">
        {/* Google submissions */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-400">{tNav("googleQuota")}</span>
            <span className="text-gray-300">
              {indexatorUsage.googleSubmissions.used}/{indexatorUsage.googleSubmissions.limit}
            </span>
          </div>
          <ProgressBar
            used={indexatorUsage.googleSubmissions.used}
            limit={indexatorUsage.googleSubmissions.limit}
          />
        </div>

        {/* Inspections */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-400">{tNav("inspections")}</span>
            <span className="text-gray-300">
              {indexatorUsage.inspections.used}/{indexatorUsage.inspections.limit}
            </span>
          </div>
          <ProgressBar
            used={indexatorUsage.inspections.used}
            limit={indexatorUsage.inspections.limit}
          />
        </div>
      </div>
    </div>
  );
}
