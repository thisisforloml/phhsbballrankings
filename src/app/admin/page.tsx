import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadAdminDashboard } from "@/lib/admin/load-admin-dashboard";
import { requireAdminUser } from "@/lib/portal-auth";

export const metadata = {
  title: "Dashboard | Admin",
  description: "Peach Basket admin command center.",
};

export default async function AdminDashboardPage() {
  const [, dashboard] = await Promise.all([requireAdminUser(), loadAdminDashboard()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Command center"
        title="Admin Dashboard"
        description="Live counts, attention queues, and recent activity across Peach Basket admin."
        statusBadge="Read-only"
      />
      <AdminDashboard data={dashboard} />
    </>
  );
}
