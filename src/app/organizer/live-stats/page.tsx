import { requireOrganizerUser } from "@/lib/portal-auth";
import { LiveStatsClient } from "@/app/portal/live-stats/LiveStatsClient";

export default async function OrganizerLiveStatsPage() {
  await requireOrganizerUser();
  return <LiveStatsClient />;
}