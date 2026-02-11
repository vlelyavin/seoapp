"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/plan";

export default function PlansPage() {
  const t = useTranslations("plans");
  const { data: session, update } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch("/api/plans");
        if (res.ok) {
          setPlans(await res.json());
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    loadPlans();
  }, []);

  async function handleSelectPlan(planId: string) {
    setSwitching(planId);
    setMessage("");

    try {
      const res = await fetch("/api/user/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (res.ok) {
        setMessage(t("planUpdated"));
        // Refresh session to update planId in JWT
        await update();
      } else {
        const data = await res.json();
        setMessage(data.error || t("updateFailed"));
      }
    } catch {
      setMessage(t("updateFailed"));
    }
    setSwitching(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("subtitle")}
        </p>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-lg px-4 py-2 text-sm",
            message.includes("error") || message.includes("failed") || message.includes("Failed")
              ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
          )}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = session?.user?.planId === plan.id;
          const isAgency = plan.id === "agency";
          const isSwitching = switching === plan.id;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-xl border bg-white p-6 dark:bg-gray-900",
                isCurrent
                  ? "border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-400"
                  : "border-gray-200 dark:border-gray-800",
                isAgency &&
                  "bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10"
              )}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                    {t("current")}
                  </span>
                </div>
              )}

              {isAgency && (
                <div className="absolute -top-3 right-4">
                  <Zap className="h-6 w-6 text-yellow-500" />
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    ${plan.price}
                  </span>
                  <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("perMonth")}
                  </span>
                </div>
              </div>

              <ul className="mb-6 space-y-3">
                <FeatureItem
                  icon={Check}
                  text={t("auditsPerMonth", { count: plan.auditsPerMonth })}
                />
                <FeatureItem
                  icon={Check}
                  text={t("maxPages", { count: plan.maxPages })}
                />
                {plan.whiteLabel && (
                  <FeatureItem icon={Check} text={t("whiteLabel")} highlight />
                )}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isCurrent || isSwitching}
                className={cn(
                  "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isCurrent
                    ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                    : isAgency
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isSwitching ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("switching")}
                  </span>
                ) : isCurrent ? (
                  t("currentPlan")
                ) : plan.price >
                  (plans.find((p) => p.id === session?.user?.planId)?.price ||
                    0) ? (
                  t("upgrade")
                ) : (
                  t("select")
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {t("noBilling")}
        </p>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  text,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          highlight
            ? "text-purple-600 dark:text-purple-400"
            : "text-green-600 dark:text-green-400"
        )}
      />
      <span
        className={cn(
          "text-sm",
          highlight
            ? "font-medium text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-gray-300"
        )}
      >
        {text}
      </span>
    </li>
  );
}
