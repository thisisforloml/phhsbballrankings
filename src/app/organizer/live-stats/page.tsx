import { UserRole } from "@prisma/client";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { LiveStatsClient } from "@/app/portal/live-stats/LiveStatsClient";

export default async function OrganizerLiveStatsPage() {
  const user = await requireOrganizerUser();
  return <LiveStatsClient showAdminHome={user.role === UserRole.ADMIN} />;
}
