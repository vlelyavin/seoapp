"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Search,
  Link2,
  Link2Off,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Loader2,
  X,
  Trash2,
  Send,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SiteCard } from "@/components/indexator/site-card";
import type { GscStatus, Site, SiteStats, Quota, ConfirmState, RunStatus } from "@/types/indexator";

export default function IndexingPage() {
  const t = useTranslations("indexing");
  const tBreadcrumbs = useTranslations("breadcrumbs");
  // GSC + sites state
  const [gscStatus, setGscStatus] = useState<GscStatus | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [siteStats, setSiteStats] = useState<Record<string, SiteStats>>({});
  const [siteQuotas, setSiteQuotas] = useState<Record<string, Quota>>({});
  const [, setGlobalQuota] = useState<Quota | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [runStatuses, setRunStatuses] = useState<Record<string, RunStatus>>({});
  const [copied, setCopied] = useState<string | null>(null);

  // Submit confirmation state
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Disconnect modal state
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Add Website modal state
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [availableGscSites, setAvailableGscSites] = useState<Array<{ siteUrl: string; permissionLevel: string }>>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [addingSite, setAddingSite] = useState(false);
  const [maxSites, setMaxSites] = useState(1);

  // Delete site state
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const [deletingSiteLoading, setDeletingSiteLoading] = useState(false);

  // Plan capabilities
  const [autoIndexEnabled, setAutoIndexEnabled] = useState(false);

  // Polling refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, ok = true) => {
    if (ok) {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  }, []);

  // ── Load GSC status
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/indexing/gsc/status");
      if (res.ok) setGscStatus(await res.json());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadSiteStats = useCallback(async (siteId: string) => {
    const res = await fetch(`/api/indexing/sites/${siteId}/stats`);
    if (res.ok) {
      const data = await res.json();
      setSiteStats((prev) => ({ ...prev, [siteId]: data }));
    }
  }, []);

  const loadSiteQuota = useCallback(async (siteId: string) => {
    const res = await fetch(`/api/indexing/sites/${siteId}/quota`);
    if (res.ok) {
      const data = await res.json();
      setSiteQuotas((prev) => ({ ...prev, [siteId]: data }));
      setGlobalQuota(data);
    }
  }, []);

  // ── Load sites
  const loadSites = useCallback(async () => {
    const res = await fetch("/api/indexing/sites");
    if (res.ok) {
      const data = await res.json();
      const loaded: Site[] = data.sites ?? [];
      setSites(loaded);
      for (const s of loaded) {
        void loadSiteStats(s.id);
        void loadSiteQuota(s.id);
      }
    }
  }, [loadSiteStats, loadSiteQuota]);

  // ── Load plan limit
  const loadPlanLimit = useCallback(async () => {
    const res = await fetch("/api/user/plan");
    if (res.ok) {
      const data = await res.json();
      setMaxSites(data.plan?.maxSites ?? 1);
      setAutoIndexEnabled(data.plan?.autoIndexEnabled ?? false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadSites();
    loadPlanLimit();
  }, [loadStatus, loadSites, loadPlanLimit]);

  // ── Reconnect / Disconnect
  const handleReconnect = async () => {
    const res = await fetch("/api/indexing/gsc/reconnect", { method: "POST" });
    if (res.ok) {
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = () => {
    setShowDisconnectModal(true);
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/indexing/gsc/disconnect", { method: "DELETE" });
      if (res.ok) {
        await loadStatus();
        showToast(t("disconnectedKeepData"));
      }
    } finally {
      setDisconnecting(false);
      setShowDisconnectModal(false);
    }
  };

  // ── Add Website
  const openAddSiteModal = async () => {
    setShowAddSiteModal(true);
    setLoadingAvailable(true);
    setSelectedDomain("");
    try {
      const res = await fetch("/api/indexing/sites/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAvailableGscSites(data.available ?? []);
      } else {
        showToast(t("errorSync"), false);
      }
    } finally {
      setLoadingAvailable(false);
    }
  };

  const addSite = async () => {
    if (!selectedDomain) return;
    setAddingSite(true);
    try {
      const res = await fetch("/api/indexing/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: selectedDomain }),
      });
      if (res.ok) {
        await loadSites();
        setShowAddSiteModal(false);
        showToast(t("siteAdded"));
      } else {
        const data = await res.json();
        showToast(data.error || t("errorAddSite"), false);
      }
    } finally {
      setAddingSite(false);
    }
  };

  // ── Delete site
  const deleteSite = async (siteId: string) => {
    setDeletingSiteLoading(true);
    try {
      const res = await fetch(`/api/indexing/sites/${siteId}`, { method: "DELETE" });
      if (res.ok) {
        setSites((prev) => prev.filter((s) => s.id !== siteId));
        showToast(t("siteDeleted"));
      } else {
        showToast(t("errorDeleteSite"), false);
      }
    } finally {
      setDeletingSiteLoading(false);
      setDeletingSiteId(null);
    }
  };

  // Poll every 10s
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      void loadSites();
    }, 10_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [loadSites]);

  // ── Sync URLs for a site
  const syncUrls = async (siteId: string) => {
    setSyncing((prev) => ({ ...prev, [siteId]: true }));
    try {
      const res = await fetch(`/api/indexing/sites/${siteId}/sync-urls`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await Promise.all([loadSiteStats(siteId), loadSites()]);
        showToast(t("syncUrlsSuccess", { total: data.totalUrls ?? 0 }));
      } else {
        showToast(t("errorSync"), false);
      }
    } finally {
      setSyncing((prev) => ({ ...prev, [siteId]: false }));
    }
  };

  // ── Submit (with optional confirmation)
  const requestSubmit = useCallback((siteId: string, urlIds: string[], engines: string[], count: number) => {
    setConfirmState({ siteId, urlIds, engines, count });
  }, []);

  const executeSubmit = async () => {
    if (!confirmState) return;
    const { siteId, urlIds, engines, count } = confirmState;

    setSubmitting(true);
    try {
      const body = urlIds.length === 0 ? { all_not_indexed: true, engines } : { url_ids: urlIds, engines };
      const res = await fetch(`/api/indexing/sites/${siteId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(
          t("submitResult", {
            google: data.submitted_google,
            bing: data.submitted_bing,
            skipped: data.skipped_404 ?? 0,
          }),
        );
        await loadSiteStats(siteId);
        await loadSiteQuota(siteId);
      } else {
        showToast(t("errorSubmit"), false);
      }
    } finally {
      setSubmitting(false);
      setConfirmState(null);
      void count;
    }
  };

  // ── Toggle auto-index
  const toggleAutoIndex = async (siteId: string, engine: "google" | "bing", value: boolean) => {
    const res = await fetch(`/api/indexing/sites/${siteId}/auto-index`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [engine]: value }),
    });
    if (res.ok) {
      setSites((prev) =>
        prev.map((s) =>
          s.id === siteId
            ? {
                ...s,
                autoIndexGoogle: engine === "google" ? value : s.autoIndexGoogle,
                autoIndexBing: engine === "bing" ? value : s.autoIndexBing,
              }
            : s,
        ),
      );
    }
  };

  // ── Run auto-index now
  const runNow = async (siteId: string) => {
    setRunning((prev) => ({ ...prev, [siteId]: true }));
    setRunStatuses((prev) => ({ ...prev, [siteId]: { phase: "running" } }));
    try {
      const res = await fetch(`/api/indexing/sites/${siteId}/run-auto-index`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const newUrls = data.newUrls ?? 0;
        const submittedGoogle = data.submittedGoogle ?? 0;
        const submittedBing = data.submittedBing ?? 0;
        const failed = (data.failedGoogle ?? 0) + (data.failedBing ?? 0);
        setRunStatuses((prev) => ({
          ...prev,
          [siteId]: {
            phase: "done",
            newUrls,
            changedUrls: data.changedUrls,
            removedUrls: data.removedUrls,
            submittedGoogle,
            submittedBing,
            failedGoogle: data.failedGoogle,
            failedBing: data.failedBing,
            ranAt: new Date().toISOString(),
          },
        }));
        await loadSiteStats(siteId);
        await loadSiteQuota(siteId);
        if (newUrls === 0 && submittedGoogle === 0 && submittedBing === 0) {
          toast(t("autoIndexNoChanges"));
        } else {
          const parts = [
            t("newCount", { count: newUrls }),
            t("googleCount", { count: submittedGoogle }),
            t("bingCount", { count: submittedBing }),
          ];
          if (failed > 0) parts.push(t("failedCount", { count: failed }));
          toast.success(`Auto-index: ${parts.join(" · ")}`);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const errorMsg = data.error ?? "Unknown error";
        setRunStatuses((prev) => ({
          ...prev,
          [siteId]: { phase: "error", errorMsg, ranAt: new Date().toISOString() },
        }));
        toast.error(`Auto-index failed: ${errorMsg}`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Network error";
      setRunStatuses((prev) => ({
        ...prev,
        [siteId]: { phase: "error", errorMsg, ranAt: new Date().toISOString() },
      }));
      toast.error(`Auto-index failed: ${errorMsg}`);
    } finally {
      setRunning((prev) => ({ ...prev, [siteId]: false }));
    }
  };

  // ── Mark site as IndexNow-verified / failed in local state
  const handleVerifySuccess = useCallback((siteId: string) => {
    setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, indexnowKeyVerified: true } : s)));
  }, []);

  const handleVerifyFail = useCallback((siteId: string) => {
    setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, indexnowKeyVerified: false } : s)));
  }, []);

  // ── Copy IndexNow key
  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Render
  if (loadingStatus) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-sm text-gray-400">{t("loadingIndexator")}</p>
      </div>
    );
  }

  const isConnected = gscStatus?.connected && gscStatus.hasRequiredScopes;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[
          { label: tBreadcrumbs("dashboard"), href: "/app" },
          { label: tBreadcrumbs("indexing") },
        ]} />
        <h1 className="text-2xl font-bold text-white">Indexator</h1>
      </div>

      {/* GSC Connection Card */}
      <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t("gscTitle")}</h2>
            <p className="mt-1 text-sm text-gray-400">{t("connectDesc")}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-md border border-gray-800 bg-gray-950 px-3 py-2.5">
          <div className="flex flex-1 items-center gap-2 min-w-0">
            {isConnected ? (
              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-500 shrink-0" />
            )}
            <span className="text-sm text-gray-300 truncate">{gscStatus?.email ?? t("notConnected")}</span>
          </div>
          {isConnected && <span className="shrink-0 text-xs font-medium text-green-400">{t("connected")}</span>}
        </div>

        {gscStatus?.connected && !gscStatus.hasRequiredScopes && (
          <p className="mt-2 text-sm text-yellow-400">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            {t("missingScopes")}
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          {!isConnected ? (
            <button
              onClick={handleReconnect}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Link2 className="h-4 w-4" />
              {gscStatus?.connected ? t("reconnect") : t("connectGoogle")}
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:flex sm:w-auto w-full gap-2">
                <button
                  onClick={openAddSiteModal}
                  disabled={sites.length >= maxSites}
                  title={sites.length >= maxSites ? t("upgradePlanToAddSites") : undefined}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto sm:justify-start"
                >
                  <Plus className="h-4 w-4" />
                  {t("addWebsite")}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-red-700 hover:text-red-400 sm:w-auto sm:justify-start"
                >
                  <Link2Off className="h-4 w-4" />
                  {t("disconnect")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sites */}
      {(isConnected || sites.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-white">{t("sites")}</h2>

          {sites.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-10 text-center">
              <Search className="mx-auto h-10 w-10 text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">{t("noSites")}</p>
              <p className="text-gray-600 text-xs mt-1">{t("noSitesDesc")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  expanded={true}
                  gscConnected={isConnected ?? false}
                  stats={siteStats[site.id]}
                  quota={siteQuotas[site.id]}
                  syncingUrls={syncing[site.id] ?? false}
                  running={running[site.id] ?? false}
                  runStatus={runStatuses[site.id]}
                  copied={copied}
                  t={t}
                  onToggle={() => {}}
                  onSyncUrls={() => syncUrls(site.id)}
                  onRequestSubmit={requestSubmit}
                  onToggleAutoGoogle={(v) => toggleAutoIndex(site.id, "google", v)}
                  onToggleAutoBing={(v) => toggleAutoIndex(site.id, "bing", v)}
                  onRunNow={() => runNow(site.id)}
                  onCopyKey={(k) => copyKey(k)}
                  onVerifySuccess={() => handleVerifySuccess(site.id)}
                  onVerifyFail={() => handleVerifyFail(site.id)}
                  onDelete={() => setDeletingSiteId(site.id)}
                  autoIndexEnabled={autoIndexEnabled}
                  showToast={showToast}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit confirmation dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !submitting && setConfirmState(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
            <button
              onClick={() => !submitting && setConfirmState(null)}
              disabled={submitting}
              className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200 disabled:opacity-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-copper/10">
              <Send className="h-6 w-6 text-copper" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">{t("confirmSubmitTitle")}</h3>
            <p className="mb-5 text-sm text-gray-300">
              {confirmState.engines.includes("google") && !confirmState.engines.includes("bing")
                ? t("confirmSubmitGoogle", { count: confirmState.count })
                : confirmState.engines.includes("bing") && !confirmState.engines.includes("google")
                  ? t("confirmSubmitBing", { count: confirmState.count })
                  : t("confirmSubmitBoth", { count: confirmState.count })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={executeSubmit}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("confirm")}
              </button>
              <button
                onClick={() => setConfirmState(null)}
                disabled={submitting}
                className="flex-1 rounded-md border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect confirmation modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !disconnecting && setShowDisconnectModal(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
            <button
              onClick={() => !disconnecting && setShowDisconnectModal(false)}
              disabled={disconnecting}
              className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Link2Off className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">{t("disconnectTitle")}</h3>
            <p className="mb-6 text-sm text-gray-400">{t("disconnectDescriptionNew")}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDisconnectConfirm}
                disabled={disconnecting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/30 disabled:opacity-50"
              >
                {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("disconnect")}
              </button>
              <button
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Website modal */}
      {showAddSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !addingSite && setShowAddSiteModal(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
            <button
              onClick={() => !addingSite && setShowAddSiteModal(false)}
              disabled={addingSite}
              className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-copper/10">
              <Plus className="h-6 w-6 text-copper" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">{t("addWebsite")}</h3>
            <p className="mb-1 text-xs text-gray-500">{t("sitesUsed", { used: sites.length, max: maxSites })}</p>
            {loadingAvailable ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : availableGscSites.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">{t("noAvailableSites")}</p>
            ) : (
              <>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="mt-3 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-copper focus:outline-none"
                >
                  <option value="">{t("selectSite")}</option>
                  {availableGscSites.map((s) => (
                    <option key={s.siteUrl} value={s.siteUrl}>
                      {s.siteUrl}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addSite}
                  disabled={!selectedDomain || addingSite}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {addingSite && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("add")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete site confirmation */}
      {deletingSiteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deletingSiteLoading && setDeletingSiteId(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
            <button
              onClick={() => !deletingSiteLoading && setDeletingSiteId(null)}
              disabled={deletingSiteLoading}
              className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Trash2 className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">{t("deleteSiteTitle")}</h3>
            <p className="mb-5 text-sm text-gray-400">
              {t("deleteSiteDescription", {
                domain: sites.find((s) => s.id === deletingSiteId)?.domain ?? "",
              })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteSite(deletingSiteId)}
                disabled={deletingSiteLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/30 disabled:opacity-50"
              >
                {deletingSiteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("delete")}
              </button>
              <button
                onClick={() => setDeletingSiteId(null)}
                disabled={deletingSiteLoading}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
