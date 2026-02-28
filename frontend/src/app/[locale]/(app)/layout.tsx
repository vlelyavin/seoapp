"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "sidebar-open";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(SIDEBAR_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-dvh">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

      <main
        className={cn(
          "mx-auto max-w-6xl p-4 pt-2 lg:px-6 transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          sidebarOpen && "lg:ml-56"
        )}
      >
        {children}
      </main>
    </div>
  );
}
