"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useSidebar } from "@/components/layout/sidebar-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { open, toggle, close } = useSidebar();

  return (
    <div className="relative min-h-dvh">
      {/* Mobile overlay — tap to close sidebar */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <Sidebar open={open} onClose={close} />

      <Header onToggleSidebar={toggle} sidebarOpen={open} />

      <main className="p-4 lg:p-6 lg:ml-64">{children}</main>
    </div>
  );
}
