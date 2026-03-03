"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CancelTiming = "next_billing_period" | "immediately";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (effectiveFrom: CancelTiming) => void;
  periodEndDate: string | null;
  loading?: boolean;
  translations: {
    title: string;
    tabImmediately: string;
    tabOnDate: string;
    messageImmediately: string;
    messageEndOfPeriod: string;
    confirmCancel: string;
    keepPlan: string;
  };
}

export function CancelSubscriptionDialog({
  open,
  onClose,
  onConfirm,
  periodEndDate,
  loading = false,
  translations: t,
}: CancelSubscriptionDialogProps) {
  const [timing, setTiming] = useState<CancelTiming>("next_billing_period");

  // Reset to default when dialog opens
  useEffect(() => {
    if (open) setTiming("next_billing_period");
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, loading, onClose]);

  if (!open) return null;

  const tabs: { value: CancelTiming; label: string }[] = [
    { value: "immediately", label: t.tabImmediately },
    { value: "next_billing_period", label: t.tabOnDate },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
      />

      {/* Dialog */}
      <div className="relative z-10 mx-5 w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-xl">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-gray-200 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/20">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </div>

        {/* Title */}
        <h3 className="mb-4 text-lg font-semibold text-white">{t.title}</h3>

        {/* Segmented control */}
        <div className="mb-4 inline-flex w-full items-center gap-1 rounded-lg border border-gray-800 bg-gray-950 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              disabled={loading}
              onClick={() => setTiming(tab.value)}
              className={cn(
                "inline-flex h-9 flex-1 shrink-0 items-center justify-center rounded-md px-2.5 text-xs font-medium transition-colors md:text-sm",
                timing === tab.value
                  ? "border border-gray-700 bg-gray-900 text-white shadow-sm"
                  : "border border-transparent text-gray-400 hover:text-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Context message based on selection */}
        <p className="mb-6 text-sm text-gray-400">
          {timing === "immediately"
            ? t.messageImmediately
            : t.messageEndOfPeriod}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-900 disabled:opacity-50"
          >
            {t.keepPlan}
          </button>
          <button
            onClick={() => onConfirm(timing)}
            disabled={loading}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap text-white",
              loading ? "bg-red-600/50" : "bg-red-600 hover:bg-red-700"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.confirmCancel}
              </span>
            ) : (
              t.confirmCancel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
