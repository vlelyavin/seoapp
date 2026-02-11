"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  Plus,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditSummary } from "@/types/audit";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tAudit = useTranslations("audit");
  const locale = useLocale();
  const { data: session } = useSession();
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/audit/list");
        if (res.ok) {
          setAudits(await res.json());
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, []);

  // Aggregate stats from completed audits
  const completedAudits = audits.filter((a) => a.status === "completed");
  const totalPages = completedAudits.reduce((s, a) => s + a.pagesCrawled, 0);
  const totalPassed = completedAudits.reduce((s, a) => s + a.passedChecks, 0);
  const totalWarnings = completedAudits.reduce((s, a) => s + a.warnings, 0);
  const totalCritical = completedAudits.reduce((s, a) => s + a.criticalIssues, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("title")}
          </h1>
          {session?.user && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("welcome")}, {session.user.name || session.user.email}
            </p>
          )}
        </div>
        <Link
          href={`/${locale}/dashboard/audit/new`}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("startAudit")}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BarChart3} label={tAudit("pagesCrawled")} value={totalPages} color="blue" />
        <StatCard icon={CheckCircle} label={tAudit("passedChecks")} value={totalPassed} color="green" />
        <StatCard icon={AlertTriangle} label={tAudit("warnings")} value={totalWarnings} color="yellow" />
        <StatCard icon={XCircle} label={tAudit("criticalIssues")} value={totalCritical} color="red" />
      </div>

      {/* Recent audits */}
      <div className="rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b p-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("recentAudits")}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("noAudits")}
            </p>
            <Link
              href={`/${locale}/dashboard/audit/new`}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("startAudit")}
            </Link>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-800">
            {audits.map((audit) => (
              <Link
                key={audit.id}
                href={`/${locale}/dashboard/audit/${audit.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <StatusDot status={audit.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {audit.url}
                  </p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(audit.startedAt).toLocaleDateString()}
                    </span>
                    {audit.status === "completed" && (
                      <>
                        <span>{audit.pagesCrawled} pages</span>
                        {audit.criticalIssues > 0 && (
                          <span className="text-red-500">
                            {audit.criticalIssues} critical
                          </span>
                        )}
                        {audit.warnings > 0 && (
                          <span className="text-yellow-500">
                            {audit.warnings} warnings
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", {
        "bg-green-500": status === "completed",
        "bg-red-500": status === "failed",
        "bg-yellow-500 animate-pulse": status === "crawling" || status === "analyzing",
        "bg-gray-400": status === "pending",
        "bg-blue-500": status === "generating_report",
      })}
    />
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
    red: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  };

  return (
    <div className="rounded-xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
