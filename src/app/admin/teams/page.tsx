import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadManagedTeams } from "@/lib/admin/load-managed-teams";
import { requireAdminUser } from "@/lib/portal-auth";

import { TeamManagementClient } from "./TeamManagementClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Teams | Admin",
  description: "Edit team records.",
};

export default async function AdminTeamsPage() {
  const [, serializedTeams] = await Promise.all([requireAdminUser(), loadManagedTeams()]);
  const activeTeams = serializedTeams.filter((team) => team.isActiveCompetitionTeam);
  const reviewCount = activeTeams.filter((team) => team.needsCleanup).length;

  return (
    <>
      <AdminPageHeader
        title="Teams"
        description={
          reviewCount
            ? `${reviewCount} active record${reviewCount === 1 ? "" : "s"} need duplicate-context review.`
            : "Edit team identity and location. Competition usage is read-only."
        }
        statusBadge={`${serializedTeams.length} records`}
      />
      <TeamManagementClient teams={serializedTeams} />
    </>
  );
}
