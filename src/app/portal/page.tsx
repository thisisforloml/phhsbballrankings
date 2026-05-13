import { requirePortalUser } from "@/lib/portal-auth";
import { PortalDashboardClient } from "./PortalDashboardClient";

export default async function PortalPage() {
  await requirePortalUser();
  return <PortalDashboardClient />;
}