import { requirePortalUser } from "@/lib/portal-auth";
import { LiveStatsClient } from "./LiveStatsClient";

export default async function LiveStatsPage() {
  await requirePortalUser();
  return <LiveStatsClient />;
}