"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const locale = useLocale();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white dark:border-white border-t-transparent dark:border-t-transparent" />
      </div>
    );
  }

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onMenuToggle={() => setSidebarOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
