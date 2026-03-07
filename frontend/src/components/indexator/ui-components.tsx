"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Info,
  ExternalLink,
  CheckCircle,
  ShieldCheck,
  Loader2,
  Download,
  Key,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTip } from "@/components/indexator/helpers";
import type { Site } from "@/types/indexator";

export function GscStatusBadge({
  status,
  gsc,
  t,
}: {
  status: string | null;
  gsc: { bg: string; text: string; label: string };
  t: ReturnType<typeof useTranslations<"indexing">>;
}) {
  const [showTip, setShowTip] = useState(false);
  const tip = getTip(status, t);

  return (
    <div className="relative inline-flex items-center gap-1">
      <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", gsc.bg, gsc.text)}>
        {gsc.label}
      </span>
      <button
        className="text-gray-500 hover:text-gray-300 transition-colors"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <Info className="h-3.5 w-3.5" />
        {showTip && (
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-xs text-gray-300 shadow-xl z-10 text-left">
            {tip}
          </div>
        )}
      </button>
    </div>
  );
}

export function ExpandableList({
  title,
  items,
  danger = false,
  showLessLabel = "Show less",
  showAllLabel,
}: {
  title: string;
  items: string[];
  danger?: boolean;
  showLessLabel?: string;
  showAllLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {title} ({items.length})
        </p>
        {items.length > 5 && (
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-gray-500 hover:text-white transition">
            {expanded ? showLessLabel : (showAllLabel ?? `Show all ${items.length}`)}
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {shown.map((url) => (
          <div key={url} className="flex items-center gap-2">
            <span className={cn("truncate text-xs", danger ? "text-red-400" : "text-gray-300")}>{url}</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-gray-500 hover:text-white transition"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatPill({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: number;
  color?: "gray" | "green" | "red" | "yellow" | "blue" | "orange";
}) {
  const colors: Record<string, string> = {
    gray: "text-white",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-copper-light",
    orange: "text-orange-400",
  };
  return (
    <span className="text-sm text-gray-400">
      {label}: <span className={cn("font-semibold", colors[color])}>{value}</span>
    </span>
  );
}

export function StatBox({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: number;
  color?: "gray" | "green" | "red" | "yellow" | "blue" | "orange";
}) {
  const colors: Record<string, string> = {
    gray: "text-white",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-copper-light",
    orange: "text-orange-400",
  };
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5", colors[color])}>{value}</p>
    </div>
  );
}

export function QuotaBar({
  label,
  used,
  limit,
  usedLabel,
  limitLabel,
}: {
  label: string;
  used: number;
  limit: number;
  usedLabel?: string;
  limitLabel?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{label}</span>
          <span>
            {used}/{limit}
          </span>
        </div>
      )}
      {!label && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{usedLabel ?? `${used} used`}</span>
          <span>{limitLabel ?? `${limit} limit`}</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-gray-900">
        <div
          className={cn(
            "h-1.5 rounded-full transition-all",
            pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-copper",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Toggle({
  label,
  tooltip,
  checked,
  onChange,
  disabled = false,
  onDisabledClick,
}: {
  label: string;
  tooltip?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  onDisabledClick?: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (disabled) {
      onDisabledClick?.();
    } else {
      onChange(!checked);
    }
  };

  return (
    <label className={cn("flex items-center gap-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <div
        onClick={handleClick}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          disabled ? "opacity-40" : "",
          checked && !disabled ? "bg-copper" : "bg-gray-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && !disabled ? "translate-x-4" : "translate-x-0",
          )}
        />
      </div>
      <span className={cn("text-sm", disabled ? "text-gray-500" : "text-gray-300")}>{label}</span>
      {tooltip && (
        <div className="relative flex items-center">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {showTooltip && (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-gray-800 bg-gray-950 p-2.5 text-xs text-gray-300 shadow-xl z-10">
              {tooltip}
            </div>
          )}
        </div>
      )}
    </label>
  );
}

export function IndexNowVerifyModal({
  site,
  onClose,
  onProceed,
  onVerifySuccess,
  t,
}: {
  site: Site;
  onClose: () => void;
  onProceed: () => void;
  onVerifySuccess: () => void;
  t: ReturnType<typeof useTranslations<"indexing">>;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const baseDomain = site.domain.startsWith("sc-domain:")
    ? `https://${site.domain.replace("sc-domain:", "")}`
    : site.domain.replace(/\/$/, "");
  const keyFileUrl = `${baseDomain}/${site.indexnowKey}.txt`;

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/indexing/sites/${site.id}/verify-key`);
      const data = await res.json();
      if (data.verified) {
        setVerified(true);
        onVerifySuccess();
      } else {
        toast.error(t("keyFileNotFound"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-copper/10">
          <Key className="h-6 w-6 text-copper" />
        </div>
        <h3 className="mb-2 text-base font-semibold text-white">{t("verifyModalTitle")}</h3>
        <p className="text-sm text-gray-400 mb-5">{t("verifyModalDesc")}</p>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1.5">{t("verifyStep1")}</p>
            <a
              href={`/api/indexing/sites/${site.id}/download-key`}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-900"
            >
              <Download className="h-3.5 w-3.5" />
              {t("downloadKeyFile")}
            </a>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-300 mb-1.5">{t("verifyStep2")}</p>
            <code className="block text-xs text-gray-300 rounded-md border border-gray-800 bg-gray-950 px-3 py-2 break-all">
              {keyFileUrl}
            </code>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-300 mb-2">{t("verifyStep3")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={verify}
                disabled={verifying || verified}
                className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : verified ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {verifying ? t("verifyBtnVerifying") : verified ? t("verifyBtnVerified") : t("verifyBtnVerify")}
              </button>
              {verified && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t("keyFileConfirmed")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onProceed}
            disabled={!verified}
            className="flex-1 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t("proceedToSubmit")}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-900"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
