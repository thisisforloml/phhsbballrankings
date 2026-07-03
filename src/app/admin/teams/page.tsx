import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadManagedTeams } from "@/lib/admin/load-managed-teams";
import { loadActiveProgramOptions } from "@/lib/admin/program-team-membership";
import { requireAdminUser } from "@/lib/portal-auth";

import { TeamManagementClient } from "./TeamManagementClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Teams | Admin",
  description: "Edit team records.",
};

export default async function AdminTeamsPage() {
  const [, serializedTeams, programOptions] = await Promise.all([
    requireAdminUser(),
    loadManagedTeams(),
    loadActiveProgramOptions(),
  ]);
  return (
    <>
      <AdminPageHeader
        title="Teams"
        description="Edit team identity, location, and explicit program assignment. Alias tables remain import-only."
        statusBadge={`${serializedTeams.length} records`}
      />
      <TeamManagementClient teams={serializedTeams} availablePrograms={programOptions} />
    </>
  );
}
