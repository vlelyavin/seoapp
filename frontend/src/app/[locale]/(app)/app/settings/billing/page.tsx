"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CancelSubscriptionDialog } from "@/components/ui/cancel-subscription-dialog";

interface ScheduledChange {
  action: string;
  effectiveAt: string;
}

interface SubscriptionInfo {
  paddleSubscriptionId: string | null;
  paddleSubscriptionStatus: string | null;
  paddlePlanPriceId: string | null;
  paddleNextBillDate: string | null;
  paddleCancelledAt: string | null;
  scheduledChange: ScheduledChange | null;
  currentBillingPeriodEndsAt: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  agency: "Agency",
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 15,
  agency: 35,
};

function formatDate(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(locale ?? "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BillingPage() {
  const t = useTranslations("settings");
  const { data: session, update } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const planId = session?.user?.planId ?? "free";

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/user/subscription");
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const hasActiveSubscription =
    subscription?.paddleSubscriptionStatus === "active";
  const isCanceled =
    subscription?.paddleSubscriptionStatus === "canceled";
  const isPastDue =
    subscription?.paddleSubscriptionStatus === "past_due";
  const hasPendingCancel =
    hasActiveSubscription &&
    subscription?.scheduledChange?.action === "cancel";

  // Best date for "cancels on" / billing period end
  const periodEndDate =
    subscription?.scheduledChange?.effectiveAt ??
    subscription?.currentBillingPeriodEndsAt ??
    subscription?.paddleNextBillDate ??
    null;

  async function handleCancelSubscription(
    effectiveFrom: "immediately" | "next_billing_period"
  ) {
    setCancelling(true);
    try {
      const res = await fetch("/api/user/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effectiveFrom }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(t("cancelSuccess"));
        setCancelModalOpen(false);

        if (data.cancelledImmediately) {
          // Cancelled immediately — update state to reflect cancelled status
          setSubscription((prev) =>
            prev
              ? {
                  ...prev,
                  paddleSubscriptionStatus: "canceled",
                  paddleCancelledAt: new Date().toISOString(),
                  scheduledChange: null,
                }
              : prev
          );
          update().catch(() => {});
        } else if (data.scheduledChange) {
          // Scheduled cancel — optimistically update state
          setSubscription((prev) =>
            prev
              ? {
                  ...prev,
                  scheduledChange: data.scheduledChange,
                }
              : prev
          );
        } else if (data.alreadyScheduled && data.scheduledChange) {
          setSubscription((prev) =>
            prev
              ? {
                  ...prev,
                  scheduledChange: data.scheduledChange,
                }
              : prev
          );
        } else {
          // Fallback: re-fetch subscription data
          loadSubscription();
          update().catch(() => {});
        }
      } else {
        toast.error(data.error || t("cancelFailed"));
      }
    } catch {
      toast.error(t("cancelFailed"));
    }
    setCancelling(false);
  }

  async function handleResumeSubscription() {
    setResuming(true);
    try {
      const res = await fetch("/api/user/subscription", { method: "POST" });
      if (res.ok) {
        toast.success(t("resumeSuccess"));
        loadSubscription();
        update().catch(() => {});
      } else {
        const data = await res.json();
        toast.error(data.error || t("resumeFailed"));
      }
    } catch {
      toast.error(t("resumeFailed"));
    }
    setResuming(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  const nextBillDate = subscription?.paddleNextBillDate
    ? new Date(subscription.paddleNextBillDate).toLocaleDateString()
    : null;

  const cancelDate = subscription?.paddleCancelledAt
    ? new Date(subscription.paddleCancelledAt).toLocaleDateString()
    : nextBillDate;

  // Formatted period end date for display
  const formattedPeriodEndDate = periodEndDate
    ? formatDate(periodEndDate)
    : null;

  return (
    <>
      <CancelSubscriptionDialog
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancelSubscription}
        periodEndDate={formattedPeriodEndDate}
        loading={cancelling}
        translations={{
          title: t("cancelTitle"),
          tabImmediately: t("cancelTabImmediately"),
          tabOnDate: t("cancelTabOnDate", {
            date: formattedPeriodEndDate ?? "—",
          }),
          messageImmediately: t("cancelMessageImmediately"),
          messageEndOfPeriod: t("cancelMessageEndOfPeriod", {
            date: formattedPeriodEndDate ?? "—",
          }),
          confirmCancel: t("confirmCancel"),
          keepPlan: t("keepPlan"),
        }}
      />

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
          <h2 className="mb-6 text-lg font-semibold text-white">
            {t("billingTitle")}
          </h2>

          {/* Free plan — no subscription */}
          {planId === "free" && !hasActiveSubscription && !isCanceled && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">{t("freePlanDesc")}</p>
              <Link
                href="/app/plans"
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <ArrowRight className="h-4 w-4" />
                {t("upgradeCta")}
              </Link>
            </div>
          )}

          {/* Pending cancellation banner */}
          {hasPendingCancel && formattedPeriodEndDate && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
              <Info className="h-5 w-5 shrink-0 text-gray-400" />
              <p className="text-sm text-gray-400">
                {t("pendingCancelBanner", { date: formattedPeriodEndDate })}
              </p>
            </div>
          )}

          {/* Canceled banner */}
          {isCanceled && cancelDate && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-gray-400" />
              <p className="text-sm text-gray-400">
                {t("cancelledBanner", { date: cancelDate })}
              </p>
            </div>
          )}

          {/* Past due banner */}
          {isPastDue && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-200">
                Payment past due — please update your payment method.
              </p>
            </div>
          )}

          {/* Active or canceled subscription details */}
          {(hasActiveSubscription || isCanceled || isPastDue) && (
            <div className="space-y-4">
              {/* Current plan */}
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <span className="text-sm text-gray-400">{t("currentPlan")}</span>
                <span className="text-sm font-medium text-white">
                  {PLAN_NAMES[planId] ?? planId}{" "}
                  {PLAN_PRICES[planId] !== undefined && planId !== "free" && (
                    <span className="text-gray-500">
                      (${PLAN_PRICES[planId]}/mo)
                    </span>
                  )}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <span className="text-sm text-gray-400">{t("status")}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    hasPendingCancel
                      ? "bg-amber-500/10 text-amber-400"
                      : hasActiveSubscription
                        ? "bg-emerald-500/10 text-emerald-400"
                        : isCanceled
                          ? "bg-gray-700/50 text-gray-400"
                          : "bg-amber-500/10 text-amber-400"
                  )}
                >
                  {hasPendingCancel
                    ? t("statusCancelsOn", {
                        date: formattedPeriodEndDate ?? "—",
                      })
                    : hasActiveSubscription
                      ? t("statusActive")
                      : isCanceled
                        ? t("statusCanceled")
                        : t("statusPastDue")}
                </span>
              </div>

              {/* Next billing date */}
              {nextBillDate && hasActiveSubscription && !hasPendingCancel && (
                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                  <span className="text-sm text-gray-400">{t("nextBilling")}</span>
                  <span className="text-sm text-white">{nextBillDate}</span>
                </div>
              )}

              {/* Payment method */}
              {hasActiveSubscription && !hasPendingCancel && (
                <div className="flex items-center justify-between pb-4">
                  <span className="text-sm text-gray-400">{t("paymentMethod")}</span>
                  <span className="text-sm text-white">{t("managedByPaddle")}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                {hasActiveSubscription && !hasPendingCancel && (
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-400 transition-colors hover:border-red-700 hover:text-red-400"
                  >
                    {t("cancelTitle")}
                  </button>
                )}

                {isCanceled && (
                  <button
                    onClick={handleResumeSubscription}
                    disabled={resuming}
                    className="flex items-center gap-2 rounded-md bg-gradient-to-r from-copper to-copper-light px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {resuming && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t("resumeSubscription")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
