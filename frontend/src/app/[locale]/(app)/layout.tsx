import { SessionGuard } from "@/components/layout/session-guard";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionGuard>
      <SidebarProvider>
        <DashboardShell>{children}</DashboardShell>
      </SidebarProvider>
    </SessionGuard>
  );
}
