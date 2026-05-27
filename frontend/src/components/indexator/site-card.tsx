"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Play,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
  X,
  Trash2,
  Send,
  ArrowUpDown,
  Globe,
} from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { gscStatusColor, ourStatusColor, logActionColor } from "@/components/indexator/helpers";
import {
  GscStatusBadge,
  ExpandableList,
  StatPill,
  StatBox,
  QuotaBar,
  Toggle,
  IndexNowVerifyModal,
} from "@/components/indexator/ui-components";
import type {
  Site,
  SiteStats,
  Quota,
  RunStatus,
  LastAutoIndexReport,
  UrlPage,
  Report,
  LogPage,
} from "@/types/indexator";

export function SiteCard({
  site,
  expanded,
  gscConnected,
  stats,
  quota,
  syncingUrls,
  running,
  runStatus,
  copied: _copied,
  t,
  onToggle: _onToggle,
  onSyncUrls,
  onRequestSubmit,
  onToggleAutoGoogle,
  onToggleAutoBing,
  onRunNow,
  onCopyKey: _onCopyKey,
  onVerifySuccess,
  onVerifyFail,
  onDelete,
  autoIndexEnabled,
  showToast,
}: {
  site: Site;
  expanded: boolean;
  gscConnected: boolean;
  stats?: SiteStats;
  quota?: Quota;
  syncingUrls: boolean;
  running: boolean;
  runStatus?: RunStatus;
  copied: string | null;
  t: ReturnType<typeof useTranslations<"indexing">>;
  onToggle: () => void;
  onSyncUrls: () => void;
  onRequestSubmit: (siteId: string, urlIds: string[], engines: string[], count: number) => void;
  onToggleAutoGoogle: (v: boolean) => void;
  onToggleAutoBing: (v: boolean) => void;
  onRunNow: () => void;
  onCopyKey: (k: string) => void;
  onVerifySuccess: () => void;
  onVerifyFail: () => void;
  onDelete: () => void;
  autoIndexEnabled: boolean;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "urls" | "report" | "log">("overview");

  // Last auto-index report
  const [lastAutoIndex, setLastAutoIndex] = useState<LastAutoIndexReport | null | undefined>(undefined);

  const loadLastAutoIndex = useCallback(async () => {
    const res = await fetch(`/api/indexing/sites/${site.id}/last-auto-index`);
    if (res.ok) {
      const data = await res.json();
      setLastAutoIndex(data);
    }
  }, [site.id]);

  useEffect(() => {
    void loadLastAutoIndex();
  }, [loadLastAutoIndex]);

  useEffect(() => {
    if (runStatus?.phase === "done") {
      void loadLastAutoIndex();
    }
  }, [runStatus?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL table state
  const [urlPage, setUrlPage] = useState<UrlPage | null>(null);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [urlFilter, setUrlFilter] = useState("all");
  const [urlSearch, setUrlSearch] = useState("");
  const [urlCurrentPage, setUrlCurrentPage] = useState(1);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [inspecting, setInspecting] = useState<Record<string, boolean>>({});
  const [removingUrl, setRemovingUrl] = useState<Record<string, boolean>>({});
  const [urlSortCol, setUrlSortCol] = useState<"url" | "gscStatus" | "ourStatus" | "lastSynced" | null>(null);
  const [urlSortDir, setUrlSortDir] = useState<"asc" | "desc">("asc");

  function handleUrlSort(col: "url" | "gscStatus" | "ourStatus" | "lastSynced") {
    if (urlSortCol === col) {
      setUrlSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setUrlSortCol(col);
      setUrlSortDir("asc");
    }
  }

  const sortedUrls = urlPage
    ? [...urlPage.urls].sort((a, b) => {
        if (!urlSortCol) return 0;
        let aVal: string | null = null;
        let bVal: string | null = null;
        if (urlSortCol === "url") {
          aVal = a.url;
          bVal = b.url;
        } else if (urlSortCol === "gscStatus") {
          aVal = a.gscStatus;
          bVal = b.gscStatus;
        } else if (urlSortCol === "ourStatus") {
          aVal = a.indexingStatus;
          bVal = b.indexingStatus;
        } else if (urlSortCol === "lastSynced") {
          aVal = a.lastSyncedAt;
          bVal = b.lastSyncedAt;
        }
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = aVal.localeCompare(bVal);
        return urlSortDir === "asc" ? cmp : -cmp;
      })
    : [];

  // Report state
  const [report, setReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Log state
  const [logPage, setLogPage] = useState<LogPage | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [logCurrentPage, setLogCurrentPage] = useState(1);

  // IndexNow verification modal state
  const [indexNowModal, setIndexNowModal] = useState<{ action: () => void } | null>(null);

  // Re-verify state
  const [reVerifying, setReVerifying] = useState(false);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastSynced = site.lastSyncedAt ? formatTimestamp(site.lastSyncedAt) : t("never");

  // ── Load URLs
  const loadUrls = useCallback(
    async (filter: string, page: number, search: string) => {
      setLoadingUrls(true);
      try {
        const params = new URLSearchParams({
          status: filter,
          page: String(page),
          q: search,
        });
        const res = await fetch(`/api/indexing/sites/${site.id}/urls?${params}`);
        if (res.ok) setUrlPage(await res.json());
      } finally {
        setLoadingUrls(false);
      }
    },
    [site.id],
  );

  // ── Load report
  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/indexing/sites/${site.id}/report`);
      if (res.ok) setReport(await res.json());
    } finally {
      setLoadingReport(false);
    }
  }, [site.id]);

  // ── Load log
  const loadLog = useCallback(
    async (filter: string, page: number) => {
      setLoadingLog(true);
      try {
        const params = new URLSearchParams({ action: filter, page: String(page) });
        const res = await fetch(`/api/indexing/sites/${site.id}/logs?${params}`);
        if (res.ok) setLogPage(await res.json());
      } finally {
        setLoadingLog(false);
      }
    },
    [site.id],
  );

  // Load URLs/report/log when tabs become active
  useEffect(() => {
    if (!expanded) return;
    if (activeTab === "urls" && !urlPage) loadUrls(urlFilter, 1, urlSearch);
    if (activeTab === "report" && !report) loadReport();
    if (activeTab === "log" && !logPage) loadLog(logFilter, 1);
  }, [expanded, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filter/page changes
  useEffect(() => {
    if (!expanded || activeTab !== "urls") return;
    loadUrls(urlFilter, urlCurrentPage, urlSearch);
  }, [urlFilter, urlCurrentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch log when filter/page changes
  useEffect(() => {
    if (!expanded || activeTab !== "log") return;
    loadLog(logFilter, logCurrentPage);
  }, [logFilter, logCurrentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = (val: string) => {
    setUrlSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setUrlCurrentPage(1);
      loadUrls(urlFilter, 1, val);
    }, 350);
  };

  const handleFilterChange = (f: string) => {
    setUrlFilter(f);
    setUrlCurrentPage(1);
    setSelectedUrls(new Set());
  };

  // ── Inspect URL
  const inspectUrl = async (url: string) => {
    setInspecting((prev) => ({ ...prev, [url]: true }));
    try {
      const res = await fetch(`/api/indexing/sites/${site.id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url] }),
      });
      if (res.status === 429) {
        showToast(t("inspectionLimitReached"), false);
        return;
      }
      if (res.ok) {
        await loadUrls(urlFilter, urlCurrentPage, urlSearch);
        showToast(t("inspectComplete"));
      }
    } finally {
      setInspecting((prev) => ({ ...prev, [url]: false }));
    }
  };

  // ── IndexNow submit guard
  const bingSubmit = async (action: () => void) => {
    if (!site.indexnowKeyVerified) {
      setIndexNowModal({ action });
      return;
    }
    try {
      const res = await fetch(`/api/indexing/sites/${site.id}/verify-key`);
      const data = await res.json();
      if (data.verified) {
        action();
      } else {
        onVerifyFail();
        setIndexNowModal({ action });
      }
    } catch {
      showToast(t("indexnowVerifyNetworkError"), false);
    }
  };

  // ── Re-verify IndexNow key manually
  const reVerify = async () => {
    setReVerifying(true);
    try {
      const res = await fetch(`/api/indexing/sites/${site.id}/verify-key`);
      const data = await res.json();
      if (data.verified) {
        onVerifySuccess();
        showToast(t("indexnowVerifySuccess"), true);
      } else {
        onVerifyFail();
        setIndexNowModal({ action: () => {} });
      }
    } catch {
      showToast(t("indexnowVerifyNetworkError"), false);
    } finally {
      setReVerifying(false);
    }
  };

  // ── Request URL removal from Google
  const requestRemoval = async (urlId: string) => {
    setRemovingUrl((prev) => ({ ...prev, [urlId]: true }));
    try {
      const res = await fetch(`/api/indexing/sites/${site.id}/request-removal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlId }),
      });
      if (res.ok) {
        showToast(t("removalRequestSent"));
        await loadUrls(urlFilter, urlCurrentPage, urlSearch);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? t("removalRequestFailed"), false);
      }
    } finally {
      setRemovingUrl((prev) => ({ ...prev, [urlId]: false }));
    }
  };

  // ── Checkbox helpers
  const allOnPageSelected =
    (urlPage?.urls.length ?? 0) > 0 && (urlPage?.urls.every((u) => selectedUrls.has(u.id)) ?? false);

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(urlPage?.urls.map((u) => u.id) ?? []));
    }
  };

  const toggleUrl = (id: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Tabs
  const TABS = [
    { id: "overview" as const, label: t("tabOverview") },
    { id: "urls" as const, label: t("tabUrls") },
    { id: "log" as const, label: t("tabLog") },
  ];

  const LOG_FILTERS = [
    { id: "all", label: t("logFilterAll") },
    { id: "submitted_google", label: t("logFilterGoogle") },
    { id: "submitted_indexnow", label: t("logFilterBing") },
    { id: "failed", label: t("logFilterFailed") },
    { id: "url_discovered", label: t("logFilterDiscovered") },
    { id: "url_removed", label: t("logFilterRemoved") },
    { id: "url_404", label: t("logFilter404") },
    { id: "removal_requested", label: t("logFilterRemoval") },
  ];

  const URL_FILTERS = [
    { id: "all", label: t("filterAll") },
    { id: "indexed", label: t("filterIndexed") },
    { id: "not_indexed", label: t("filterNotIndexed") },
    { id: "submitted", label: t("filterSubmitted") },
    { id: "failed", label: t("filterFailed") },
    { id: "404", label: t("filter404") },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
      {/* Header row */}
      <div className="flex flex-col px-3 sm:px-6 py-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-copper shrink-0" />
            <div>
              <p className="font-medium text-white">{site.domain}</p>
              <p className="text-xs text-gray-500">
                {t("lastSynced")}: {lastSynced}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-red-950/50 hover:text-red-400"
              title={t("deleteSite")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-800">
          {/* Tabs */}
          <div className="flex overflow-hidden border-b border-gray-800 px-4 sm:px-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "border-copper text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Overview Tab */}
          {activeTab === "overview" && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5">
              {/* Stats Row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
                <StatPill label={t("total")} value={site.totalUrls} color="gray" />
                <StatPill label={t("indexed")} value={site.indexedCount} color="green" />
                <StatPill label={t("notIndexed")} value={Math.max(0, site.totalUrls - site.indexedCount)} color="red" />
                <StatPill label={t("pending")} value={stats?.pending ?? 0} color="yellow" />
                <StatPill
                  label={t("submitted")}
                  value={(stats?.submittedGoogle ?? 0) + (stats?.submittedBing ?? 0)}
                  color="blue"
                />
                {(stats?.failed ?? 0) > 0 && <StatPill label={t("failed")} value={stats!.failed} color="red" />}
                {(stats?.is404s ?? 0) > 0 && <StatPill label={t("pages404")} value={stats!.is404s} color="orange" />}
              </div>
              {/* Manual Actions */}
              <div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onSyncUrls}
                    disabled={syncingUrls}
                    className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", syncingUrls && "animate-spin")} />
                    {t("syncUrls")}
                  </button>

                  <button
                    onClick={() => onRequestSubmit(site.id, [], ["google"], stats?.notIndexed ?? 0)}
                    disabled={!stats?.notIndexed || quota?.googleSubmissions.remaining === 0}
                    className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:opacity-50"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {t("submitAllNotIndexed")} (Google)
                  </button>

                  {site.indexnowKey && (
                    <button
                      onClick={() => bingSubmit(() => onRequestSubmit(site.id, [], ["bing"], stats?.notIndexed ?? 0))}
                      disabled={!stats?.notIndexed}
                      className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t("submitAllNotIndexed")} (Bing)
                    </button>
                  )}
                </div>
              </div>

              {/* Automation */}
              <div className="border-t border-gray-800 pt-4">
                <div className="space-y-3">
                  <Toggle
                    label={t("autoIndexGoogle")}
                    tooltip={autoIndexEnabled ? t("tooltipAutoGoogle") : t("upgradeToEnableAutoIndex")}
                    checked={site.autoIndexGoogle}
                    onChange={onToggleAutoGoogle}
                    disabled={!autoIndexEnabled}
                  />

                  <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                    <Toggle
                      label={t("autoIndexBing")}
                      tooltip={
                        !autoIndexEnabled
                          ? t("upgradeToEnableAutoIndex")
                          : !site.indexnowKeyVerified
                            ? t("tooltipAutoBingDisabled")
                            : t("tooltipAutoBing")
                      }
                      checked={site.autoIndexBing}
                      onChange={onToggleAutoBing}
                      disabled={!autoIndexEnabled || !site.indexnowKeyVerified}
                      onDisabledClick={autoIndexEnabled ? () => setIndexNowModal({ action: () => {} }) : undefined}
                    />
                    {site.indexnowKey && (
                      <div className="flex items-center gap-3">
                        {site.indexnowKeyVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            {t("indexnowVerified")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400">
                            <AlertTriangle className="h-3 w-3" />
                            {t("indexnowNotVerified")}
                          </span>
                        )}
                        <button
                          onClick={reVerify}
                          disabled={reVerifying}
                          className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-50"
                        >
                          <RefreshCw className={cn("h-3 w-3", reVerifying && "animate-spin")} />
                          {reVerifying ? t("verifying") : t("reVerify")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {(site.autoIndexGoogle || site.autoIndexBing) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={onRunNow}
                      disabled={running}
                      className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-900 disabled:opacity-50"
                    >
                      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {running ? t("running") : t("runNow")}
                    </button>
                    <span className="text-xs text-gray-500">
                      {t("nextRun")}
                      {lastAutoIndex !== undefined && (
                        <>
                          <span className="hidden sm:inline"> · </span>
                          <br className="sm:hidden" />
                          {lastAutoIndex === null
                            ? t("lastRunLabel", { date: t("noRunsYet") })
                            : t("lastRunLabel", {
                                date: `${new Date(lastAutoIndex.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${new Date(lastAutoIndex.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
                              })}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── URLs Tab */}
          {activeTab === "urls" && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="w-full overflow-x-auto sm:w-auto">
                  <div className="inline-flex h-11 w-auto items-center gap-1 whitespace-nowrap rounded-lg border border-gray-800 bg-black">
                    {URL_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleFilterChange(f.id)}
                        className={cn(
                          "inline-flex h-full flex-1 shrink-0 items-center justify-center rounded-md px-4 text-xs md:text-sm font-medium transition-colors",
                          urlFilter === f.id
                            ? "border border-gray-700 bg-gray-900 text-white shadow-sm"
                            : "border border-transparent text-gray-400 hover:text-gray-200",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={urlSearch}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={t("searchUrls")}
                      className="h-11 w-full rounded-lg border border-gray-800 bg-black py-1.5 pl-9 pr-3 text-sm text-white outline-none placeholder-gray-500 transition-colors focus:border-copper focus:ring-2 focus:ring-copper/20"
                    />
                  </div>
                  <button
                    onClick={() => loadUrls(urlFilter, urlCurrentPage, urlSearch)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-black text-gray-400 transition-colors hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {selectedUrls.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5">
                  <span className="text-sm text-gray-300 mr-1">{t("selectedCount", { count: selectedUrls.size })}</span>
                  <button
                    onClick={() => onRequestSubmit(site.id, [...selectedUrls], ["google"], selectedUrls.size)}
                    disabled={quota?.googleSubmissions.remaining === 0}
                    className="rounded-md bg-gradient-to-r from-copper to-copper-light px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {t("submitToGoogle")}
                  </button>
                  {site.indexnowKey && (
                    <button
                      onClick={() =>
                        bingSubmit(() => onRequestSubmit(site.id, [...selectedUrls], ["bing"], selectedUrls.size))
                      }
                      className="rounded-md border border-gray-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-900"
                    >
                      {t("submitToBing")}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedUrls(new Set())}
                    className="ml-auto rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {quota && quota.googleSubmissions.remaining === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/35 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t("quotaExhausted")}
                </div>
              )}

              {loadingUrls ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg border border-gray-800 bg-gray-950 animate-pulse" />
                  ))}
                </div>
              ) : !urlPage || urlPage.urls.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-10 text-center">
                  <Search className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">
                    {urlPage?.total === 0 && urlFilter === "all" && !urlSearch ? t("noUrls") : t("urlTableEmpty")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-gray-800 bg-gray-950">
                          <th className="w-10 px-3 py-3 text-left">
                            <Checkbox checked={allOnPageSelected} onChange={toggleSelectAll} />
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                            onClick={() => handleUrlSort("url")}
                          >
                            <span className="flex items-center gap-1">
                              {t("urlHeader")}
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                            onClick={() => handleUrlSort("gscStatus")}
                          >
                            <span className="flex items-center gap-1">
                              {t("gscStatus")}
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                            onClick={() => handleUrlSort("ourStatus")}
                          >
                            <span className="flex items-center gap-1">
                              {t("ourStatus")}
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                            onClick={() => handleUrlSort("lastSynced")}
                          >
                            <span className="flex items-center gap-1">
                              {t("lastSynced")}
                              <ArrowUpDown className="h-3 w-3" />
                            </span>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {t("actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {sortedUrls.map((url) => {
                          const gsc = gscStatusColor(url.gscStatus, t);
                          const our = ourStatusColor(url.indexingStatus, t);
                          const isInspecting = inspecting[url.url] ?? false;

                          return (
                            <tr key={url.id} className="hover:bg-gray-900/50 transition-colors">
                              <td className="px-3 py-3">
                                <Checkbox checked={selectedUrls.has(url.id)} onChange={() => toggleUrl(url.id)} />
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-gray-200 text-xs" title={url.url}>
                                    {url.url}
                                  </span>
                                  <a
                                    href={url.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 text-gray-500 hover:text-white transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <GscStatusBadge status={url.gscStatus} gsc={gsc} t={t} />
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                                    our.bg,
                                    our.text,
                                  )}
                                >
                                  {our.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {formatTimestamp(url.lastSyncedAt)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => inspectUrl(url.url)}
                                    disabled={isInspecting || !gscConnected}
                                    title={!gscConnected ? t("reconnectRequired") : t("inspect")}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-gray-400 transition-colors hover:bg-gray-900 hover:text-white disabled:opacity-50"
                                  >
                                    {isInspecting ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Search className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => onRequestSubmit(site.id, [url.id], ["google"], 1)}
                                    title={!gscConnected ? t("reconnectRequired") : t("submitToGoogle")}
                                    disabled={!gscConnected || quota?.googleSubmissions.remaining === 0}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-xs font-semibold text-gray-400 transition-colors hover:bg-copper/20 hover:text-copper-light hover:border-copper/30 disabled:opacity-50"
                                  >
                                    G
                                  </button>
                                  {site.indexnowKey && (
                                    <button
                                      onClick={() => bingSubmit(() => onRequestSubmit(site.id, [url.id], ["bing"], 1))}
                                      title={t("submitToBing")}
                                      className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-xs font-semibold text-gray-400 transition-colors hover:bg-gray-900 hover:text-white"
                                    >
                                      B
                                    </button>
                                  )}
                                  <button
                                    onClick={() => requestRemoval(url.id)}
                                    disabled={removingUrl[url.id] || url.indexingStatus === "removal_requested"}
                                    title={t("requestRemovalTooltip")}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-gray-400 transition-colors hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/40 disabled:opacity-50"
                                  >
                                    {removingUrl[url.id] ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {urlPage.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs text-gray-500">
                        {t("pageOf", { page: urlPage.page, total: urlPage.totalPages })}
                        {" · "}
                        {t("totalUrls", { total: urlPage.total })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUrlCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={urlCurrentPage <= 1}
                          className="flex items-center gap-1 rounded-md border border-gray-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          {t("prevPage")}
                        </button>
                        <button
                          onClick={() => setUrlCurrentPage((p) => Math.min(urlPage.totalPages, p + 1))}
                          disabled={urlCurrentPage >= urlPage.totalPages}
                          className="flex items-center gap-1 rounded-md border border-gray-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-40"
                        >
                          {t("nextPage")}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Log Tab */}
          {activeTab === "log" && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-full overflow-x-auto sm:w-auto">
                  <div className="inline-flex h-11 w-auto items-center gap-1 whitespace-nowrap rounded-lg border border-gray-800 bg-black">
                    {LOG_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setLogFilter(f.id);
                          setLogCurrentPage(1);
                          setLogPage(null);
                        }}
                        className={cn(
                          "inline-flex h-full flex-1 shrink-0 items-center justify-center rounded-md px-4 text-xs md:text-sm font-medium transition-colors",
                          logFilter === f.id
                            ? "border border-gray-700 bg-gray-900 text-white shadow-sm"
                            : "border border-transparent text-gray-400 hover:text-gray-200",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setLogPage(null);
                    loadLog(logFilter, logCurrentPage);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-black text-gray-400 transition-colors hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {loadingLog ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-lg border border-gray-800 bg-gray-950 animate-pulse" />
                  ))}
                </div>
              ) : !logPage || logPage.logs.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-10 text-center">
                  <BarChart3 className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">{t("noLogs")}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border border-gray-800 divide-y divide-gray-800">
                    {logPage.logs.map((entry) => {
                      const { dot, text } = logActionColor(entry.action);
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-900/40 transition-colors"
                        >
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
                          <span className={cn("text-xs font-medium shrink-0 w-24 sm:w-40", text)}>{entry.label}</span>
                          {entry.url ? (
                            <span className="flex-1 flex items-center gap-1.5 min-w-0">
                              <span className="truncate text-xs text-gray-300" title={entry.url}>
                                {entry.url}
                              </span>
                              <a
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-gray-500 hover:text-white transition"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </span>
                          ) : (
                            <span className="flex-1 text-xs text-gray-600">—</span>
                          )}
                          <span className="shrink-0 text-xs text-gray-500">{formatTimestamp(entry.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {logPage.totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs text-gray-500">
                        {t("logPageOf", { page: logPage.page, total: logPage.totalPages, entries: logPage.total })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setLogCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={logCurrentPage <= 1}
                          className="flex items-center gap-1 rounded-md border border-gray-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          {t("prevPage")}
                        </button>
                        <button
                          onClick={() => setLogCurrentPage((p) => Math.min(logPage.totalPages, p + 1))}
                          disabled={logCurrentPage >= logPage.totalPages}
                          className="flex items-center gap-1 rounded-md border border-gray-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-40"
                        >
                          {t("nextPage")}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Report Tab */}
          {activeTab === "report" && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5">
              <h3 className="text-sm font-semibold text-white">{t("todayReport")}</h3>

              {loadingReport ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <p className="mt-3 text-sm text-gray-400">{t("generatingReport")}</p>
                </div>
              ) : !report ? (
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-10 text-center">
                  <BarChart3 className="mx-auto h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">{t("noReport")}</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      {t("indexedCoverage", {
                        indexed: report.overall.indexed,
                        total: report.overall.total,
                      })}
                    </p>
                    {report.overall.total > 0 && (
                      <div className="h-2 w-full rounded-full bg-gray-900">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-copper to-copper-light transition-all"
                          style={{
                            width: `${Math.round((report.overall.indexed / report.overall.total) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {report.overall.total > 0
                        ? t("percentIndexed", {
                            percent: Math.round((report.overall.indexed / report.overall.total) * 100),
                          })
                        : t("noDataYet")}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox label={t("newPages")} value={report.today.newPagesDetected} color="blue" />
                    <StatBox label={t("submittedGoogle")} value={report.today.submittedGoogle} color="green" />
                    <StatBox label={t("submittedBing")} value={report.today.submittedBing} color="orange" />
                    <StatBox label={t("pages404Found")} value={report.today.pages404} color="red" />
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      {t("googleQuota")}
                    </p>
                    <QuotaBar
                      label=""
                      used={report.quota.googleUsed}
                      limit={report.quota.googleLimit}
                      usedLabel={t("quotaUsed", { used: report.quota.googleUsed })}
                      limitLabel={t("quotaLimit", { limit: report.quota.googleLimit })}
                    />
                  </div>

                  {report.today.newPagesList.length > 0 && (
                    <ExpandableList
                      title={t("newPages")}
                      items={report.today.newPagesList}
                      showLessLabel={t("showLess")}
                      showAllLabel={t("showAll", { count: report.today.newPagesList.length })}
                    />
                  )}

                  {report.today.pages404List.length > 0 && (
                    <ExpandableList
                      title={t("pages404Found")}
                      items={report.today.pages404List}
                      danger
                      showLessLabel={t("showLess")}
                      showAllLabel={t("showAll", { count: report.today.pages404List.length })}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* IndexNow key verification modal */}
      {indexNowModal && site.indexnowKey && (
        <IndexNowVerifyModal
          site={site}
          onClose={() => setIndexNowModal(null)}
          onProceed={() => {
            const action = indexNowModal.action;
            setIndexNowModal(null);
            action();
          }}
          onVerifySuccess={onVerifySuccess}
          t={t}
        />
      )}
    </div>
  );
}
