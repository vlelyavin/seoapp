"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  Check,
  X,
  Loader2,
  Zap,
  Rocket,
  Building2,
  ArrowRight,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { toast } from "sonner";
import { usePaddle } from "@/hooks/use-paddle";
import { PLAN_TO_PADDLE_PRICE } from "@/lib/paddle";
import type { Plan } from "@/types/plan";

interface SubscriptionInfo {
  paddleSubscriptionId: string | null;
  paddleSubscriptionStatus: string | null;
  paddlePlanPriceId: string | null;
  paddleNextBillDate: string | null;
  paddleCancelledAt: string | null;
}

export default function PlansPage() {
  const t = useTranslations("plans");
  const ut = useTranslations("marketing.unifiedPricing");
  const tBreadcrumbs = useTranslations("breadcrumbs");
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const paddle = usePaddle();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null
  );

  const loadData = useCallback(async () => {
    try {
      const [plansRes, userPlanRes, subRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/user/plan"),
        fetch("/api/user/subscription"),
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (userPlanRes.ok) {
        const data = await userPlanRes.json();
        if (data.plan?.id) setCurrentPlanId(data.plan.id);
      }
      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data.subscription);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle checkout success redirect
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success(t("planUpdated"));
      // Give webhook a moment to process, then refresh data
      const timer = setTimeout(() => {
        loadData();
        update().catch(() => {});
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, t, loadData, update]);

  function handleSelectPlan(planId: string) {
    if (planId === "free") {
      handleDowngradeToFree();
      return;
    }

    const priceId = PLAN_TO_PADDLE_PRICE[planId];
    if (!priceId || !paddle) {
      toast.error(t("checkoutError"));
      return;
    }

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { userId: session?.user?.id },
      ...(session?.user?.email
        ? { customer: { email: session.user.email } }
        : {}),
      settings: {
        successUrl: `${window.location.origin}${window.location.pathname}?success=true`,
        displayMode: "overlay",
        theme: "dark",
      },
    });
  }

  async function handleDowngradeToFree() {
    setSwitching("free");

    try {
      // Cancel Paddle subscription if active
      if (
        subscription?.paddleSubscriptionId &&
        subscription.paddleSubscriptionStatus === "active"
      ) {
        const cancelRes = await fetch("/api/user/subscription", {
          method: "DELETE",
        });
        if (!cancelRes.ok) {
          toast.error(t("cancelFailed"));
          setSwitching(null);
          return;
        }
      }

      // Switch plan to free
      const res = await fetch("/api/user/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "free" }),
      });

      if (res.ok) {
        setCurrentPlanId("free");
        toast.success(t("planUpdated"));
        update().catch(() => {});
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || t("updateFailed"));
      }
    } catch {
      toast.error(t("updateFailed"));
    }
    setSwitching(null);
  }

  async function handleCancelSubscription() {
    if (!confirm(t("confirmCancel"))) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/user/subscription", { method: "DELETE" });
      if (res.ok) {
        toast.success(t("cancelSuccess"));
        loadData();
        update().catch(() => {});
      } else {
        toast.error(t("cancelFailed"));
      }
    } catch {
      toast.error(t("cancelFailed"));
    }
    setCancelling(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-sm text-gray-400">{t("loadingPlans")}</p>
      </div>
    );
  }

  const hasActiveSubscription =
    subscription?.paddleSubscriptionStatus === "active";
  const isCancelled =
    subscription?.paddleSubscriptionStatus === "canceled";
  const isPastDue =
    subscription?.paddleSubscriptionStatus === "past_due";

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: tBreadcrumbs("dashboard"), href: "/app" },
            { label: tBreadcrumbs("plans") },
          ]}
        />
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      </div>

      {/* Subscription status banners */}
      {isPastDue && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-200">{t("pastDueNotice")}</p>
        </div>
      )}

      {isCancelled && subscription?.paddleCancelledAt && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-gray-400" />
          <p className="text-sm text-gray-400">
            {t("cancelledNotice", {
              date: new Date(
                subscription.paddleCancelledAt
              ).toLocaleDateString(),
            })}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isAgency = plan.id === "agency";
          const isPro = plan.id === "pro";
          const isSwitching = switching === plan.id;
          const currentPrice =
            plans.find((p) => p.id === currentPlanId)?.price || 0;
          const isUpgrade = plan.price > currentPrice;
          const isDowngrade = plan.price < currentPrice;

          const icons: Record<
            string,
            React.ComponentType<{ className?: string }>
          > = {
            free: Zap,
            pro: Rocket,
            agency: Building2,
          };
          const PlanIcon = icons[plan.id];

          const auditorFeatures: { text: string; present: boolean }[] = [
            {
              text:
                isPro || isAgency
                  ? t("unlimitedAudits")
                  : t("auditsPerMonth", { count: plan.auditsPerMonth }),
              present: true,
            },
            {
              text: t("maxPages", { count: plan.maxPages }),
              present: true,
            },
            {
              text: isAgency
                ? t("allExports")
                : isPro
                  ? t("pdfDocxExports")
                  : t("pdfOnly"),
              present: true,
            },
            {
              text:
                plan.id === "free"
                  ? t("watermarkIncluded")
                  : t("noWatermark"),
              present: plan.id !== "free",
            },
            {
              text: isAgency
                ? t("brandedReports")
                : t("noBrandedReports"),
              present: isAgency,
            },
          ];

          const indexatorFeatures: { text: string; present: boolean }[] = [
            {
              text: t("maxSites", { count: plan.maxSites }),
              present: true,
            },
            {
              text: plan.autoIndexing
                ? t("autoIndexing")
                : t("autoIndexingDisabled"),
              present: plan.autoIndexing,
            },
            {
              text:
                plan.reportFrequency !== "none"
                  ? t("reportFrequency", {
                      frequency: t(plan.reportFrequency),
                    })
                  : t("noEmailReports"),
              present: plan.reportFrequency !== "none",
            },
          ];

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border bg-gray-950 p-8",
                isCurrent ? "border-copper/50" : "border-gray-800"
              )}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-copper to-copper-light px-3 py-1 text-xs font-medium text-white">
                    {t("current")}
                  </span>
                </div>
              )}

              {PlanIcon && (
                <PlanIcon className="h-6 w-6 text-copper" />
              )}

              <h3 className="mt-2 text-lg font-semibold text-white">
                {t(plan.id)}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {ut(`planAudience.${plan.id}`)}
              </p>

              <div className="mt-4 flex items-baseline">
                <span className="text-5xl font-bold text-white">
                  ${plan.price}
                </span>
                <span className="ml-2 text-gray-500">{t("perMonth")}</span>
              </div>

              {/* Next billing date for current paid plan */}
              {isCurrent &&
                hasActiveSubscription &&
                subscription?.paddleNextBillDate && (
                  <p className="mt-2 text-xs text-gray-500">
                    {t("nextBillDate", {
                      date: new Date(
                        subscription.paddleNextBillDate
                      ).toLocaleDateString(),
                    })}
                  </p>
                )}

              {/* Auditor features */}
              <div className="mt-8">
                <p className="mb-3 text-sm font-semibold tracking-wider text-copper">
                  {ut("auditorLabel")}
                </p>
                <ul className="space-y-3">
                  {auditorFeatures.map((feat) => (
                    <li
                      key={feat.text}
                      className="flex items-start gap-3"
                    >
                      {feat.present ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          feat.present
                            ? "text-gray-300"
                            : "text-gray-500"
                        )}
                      >
                        {feat.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Indexator features */}
              <div className="mt-8 flex-1">
                <p className="mb-3 text-sm font-semibold tracking-wider text-copper">
                  {ut("indexatorLabel")}
                </p>
                <ul className="space-y-3">
                  {indexatorFeatures.map((feat) => (
                    <li
                      key={feat.text}
                      className="flex items-start gap-3"
                    >
                      {feat.present ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          feat.present
                            ? "text-gray-300"
                            : "text-gray-500"
                        )}
                      >
                        {feat.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isCurrent || !!switching}
                className={cn(
                  "mt-8 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-semibold transition-opacity",
                  isCurrent
                    ? "cursor-not-allowed bg-gray-900 text-gray-500"
                    : "border border-gray-700 text-white transition-colors hover:border-copper hover:bg-gray-900"
                )}
              >
                {isSwitching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("processing")}
                  </>
                ) : isCurrent ? (
                  <>
                    <Check className="h-4 w-4" />
                    {t("currentPlan")}
                  </>
                ) : isDowngrade ? (
                  <>
                    <ArrowDown className="h-4 w-4" />
                    {t("downgrade")}
                  </>
                ) : isUpgrade ? (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    {t("upgrade")}
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    {t("select")}
                  </>
                )}
              </button>

              {/* Cancel subscription button for current paid plan */}
              {isCurrent && hasActiveSubscription && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs text-gray-500 transition-colors hover:text-red-400"
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("cancelling")}
                    </>
                  ) : (
                    t("cancelSubscription")
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
