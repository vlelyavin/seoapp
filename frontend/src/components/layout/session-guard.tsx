"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const t = useTranslations("common");

  if (status === "loading") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-sm text-gray-400">{t("loadingApp")}</p>
      </div>
    );
  }

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}
