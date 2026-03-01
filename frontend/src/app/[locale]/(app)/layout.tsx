"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const t = useTranslations("common");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

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

  return (
    <div className="relative min-h-dvh">
      {/* Mobile overlay — tap to close sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

      <main className="p-4 lg:p-6 lg:ml-64">
        {children}
      </main>
    </div>
  );
}
