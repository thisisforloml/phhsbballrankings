import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadCompetitionAnalytics, loadCompetitionDetail } from "@/lib/admin/load-competition-detail";
import { requireAdminUser } from "@/lib/portal-auth";

import { CompetitionDetailClient } from "./CompetitionDetailClient";

export const metadata = {
  title: "Competition | Admin",
  description: "Competition detail, seasons, divisions, and analytics.",
};

export default async function AdminCompetitionDetailPage({ params }: { params: { id: string } }) {
  const [, detail, analytics] = await Promise.all([
    requireAdminUser(),
    loadCompetitionDetail(params.id),
    loadCompetitionAnalytics(params.id),
  ]);

  if (!detail || !analytics) notFound();

  return (
    <>
      <AdminPageHeader
        backLink={{ href: "/admin/competitions", label: "Competitions" }}
        title={detail.competition.name}
        statusBadge={detail.competition.status}
      />
      <CompetitionDetailClient
        competition={detail.competition}
        seasons={detail.seasons}
        divisions={detail.divisions}
        analytics={analytics}
      />
    </>
  );
}
