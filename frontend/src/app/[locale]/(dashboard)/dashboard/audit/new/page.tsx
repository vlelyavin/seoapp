"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Globe, Play, ChevronDown, ChevronUp } from "lucide-react";
import { ANALYZER_NAMES, ANALYZER_LABELS } from "@/types/audit";
import { cn } from "@/lib/utils";

const REAL_ANALYZER_NAMES = ANALYZER_NAMES.filter((n) => n !== "speed_screenshots");

export default function NewAuditPage() {
  const t = useTranslations("audit");
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();

  const [url, setUrl] = useState("");
  const [selectedAnalyzers, setSelectedAnalyzers] = useState<string[]>([...REAL_ANALYZER_NAMES]);
  const [showAnalyzers, setShowAnalyzers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPagesCrawled, setShowPagesCrawled] = useState(false);

  // Custom page limit state
  const [maxPages, setMaxPages] = useState<number>(10); // Default to Free plan limit
  const [planLimit, setPlanLimit] = useState<number>(10); // User's plan max limit

  // Fetch user's plan on mount
  useEffect(() => {
    async function fetchUserPlan() {
      try {
        const res = await fetch("/api/user/plan");
        if (res.ok) {
          const data = await res.json();
          const limit = data.plan.maxPages || 10;
          setPlanLimit(limit);
          setMaxPages(limit); // Set default to plan max
        }
      } catch (err) {
        console.error("Failed to fetch user plan:", err);
      }
    }
    fetchUserPlan();
  }, []);

  function toggleAnalyzer(name: string) {
    setSelectedAnalyzers((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  const realSelected = useMemo(
    () => selectedAnalyzers.filter((a) => a !== "speed_screenshots"),
    [selectedAnalyzers]
  );
  const includeScreenshots = selectedAnalyzers.includes("speed_screenshots");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          language: "en",
          progressLanguage: locale,
          analyzers: realSelected.length === REAL_ANALYZER_NAMES.length ? null : realSelected,
          maxPages,
          includeScreenshots,
          showPagesCrawled,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start audit");
        return;
      }

      // Navigate to progress page
      router.push(`/${locale}/dashboard/audit/${data.id}?fastApiId=${data.fastApiId}`);
    } catch {
      setError("Connection error. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        {t("newAudit")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* URL input */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("enterUrl")}
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder={t("urlPlaceholder")}
                className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
              />
            </div>
          </div>

          {/* Max Pages Input */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("maxPages")}
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                (1-{planLimit})
              </span>
            </label>
            <input
              type="number"
              min="1"
              max={planLimit}
              value={maxPages}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value >= 1 && value <= planLimit) {
                  setMaxPages(value);
                }
              }}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("maxPagesHint", { limit: planLimit })}
            </p>
          </div>

          {/* Analyzers */}
          <div>
            <button
              type="button"
              onClick={() => setShowAnalyzers(!showAnalyzers)}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <span>
                {t("analyzers")} ({realSelected.length}/{REAL_ANALYZER_NAMES.length})
              </span>
              {showAnalyzers ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showAnalyzers && (
              <div className="mt-2 rounded-lg border p-3 dark:border-gray-700">
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAnalyzers((prev) => {
                        const extras = prev.filter((a) => !REAL_ANALYZER_NAMES.includes(a as typeof REAL_ANALYZER_NAMES[number]));
                        return [...REAL_ANALYZER_NAMES, ...extras];
                      })
                    }
                    className="text-xs text-gray-900 underline dark:text-white"
                  >
                    {t("selectAll")}
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAnalyzers([])}
                    className="text-xs text-gray-900 underline dark:text-white"
                  >
                    {t("deselectAll")}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {REAL_ANALYZER_NAMES.map((name) => (
                    <label
                      key={name}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAnalyzers.includes(name)}
                        onChange={() => toggleAnalyzer(name)}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-600 dark:text-white dark:focus:ring-white"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {ANALYZER_LABELS[name]}
                      </span>
                    </label>
                  ))}
                </div>

                {/* PageSpeed Screenshots option */}
                <div className="mt-3 border-t pt-3 dark:border-gray-700">
                  <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeScreenshots}
                      onChange={() => toggleAnalyzer("speed_screenshots")}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-600 dark:text-white dark:focus:ring-white"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {ANALYZER_LABELS["speed_screenshots"]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t("screenshotsHint")}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Show pages crawled option */}
          <div className="mt-4">
            <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={showPagesCrawled}
                onChange={() => setShowPagesCrawled((prev) => !prev)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-600 dark:text-white dark:focus:ring-white"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {t("showPagesCrawled")}
              </span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !url || realSelected.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 px-4 py-3 text-sm font-medium dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <Play className="h-4 w-4" />
          {loading ? "..." : t("startAudit")}
        </button>
      </form>
    </div>
  );
}
