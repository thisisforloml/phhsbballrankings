import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadCompetitionList } from "@/lib/admin/load-competition-list";
import { requireAdminUser } from "@/lib/portal-auth";

import { CompetitionListClient } from "./CompetitionListClient";

export const metadata = {
  title: "Competitions | Admin",
  description: "Competition, season, and division management.",
};

export default async function AdminCompetitionsPage() {
  const [, competitions] = await Promise.all([requireAdminUser(), loadCompetitionList()]);

  return (
    <>
      <AdminPageHeader title="Competitions" statusBadge={`${competitions.length} active`} />
      <CompetitionListClient competitions={competitions} />
    </>
  );
}
