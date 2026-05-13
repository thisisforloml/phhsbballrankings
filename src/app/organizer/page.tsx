import type { Metadata } from "next";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { OrganizerDashboardClient } from "./OrganizerDashboardClient";

export const metadata: Metadata = {
  title: "Organizer Portal",
  description: "Organizer workflow for submitting official game stats."
};

export default async function OrganizerPage() {
  await requireOrganizerUser();
  return <OrganizerDashboardClient />;
}