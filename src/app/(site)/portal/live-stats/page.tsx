import { redirect } from "next/navigation";

import { requireOrganizerUser } from "@/lib/portal-auth";

export default async function LegacyPortalLiveStatsPage() {
  await requireOrganizerUser();
  redirect("/organizer/live-stats");
}