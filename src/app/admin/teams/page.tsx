import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { getUaapSchoolDisplayName } from "@/lib/uaap-school-display";
import { TeamManagementClient, type ManagedTeam } from "./TeamManagementClient";

export const metadata = {
  title: "Team Management - Admin Portal",
  description: "Edit existing team display fields."
};

export default async function AdminTeamsPage() {
  await requireAdminUser();

  const teams = await prisma.team.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          homeGames: true,
          awayGames: true,
          gameStats: true
        }
      }
    },
    orderBy: { name: "asc" }
  });

  const publicNameCounts = new Map<string, number>();
  for (const team of teams) {
    const publicSchoolName = getUaapSchoolDisplayName(team.name);
    publicNameCounts.set(publicSchoolName, (publicNameCounts.get(publicSchoolName) ?? 0) + 1);
  }

  function teamContext(name: string) {
    const age = name.match(/\bU(13|16|19)\b/i)?.[0]?.toUpperCase() ?? "Age group not listed";
    const gender = /girls/i.test(name) ? "Girls" : /boys/i.test(name) ? "Boys" : "Gender not listed";
    return `${age} ${gender}`;
  }

  const serializedTeams: ManagedTeam[] = teams.map((team) => {
    const publicSchoolName = getUaapSchoolDisplayName(team.name);
    const aliasGroupCount = publicNameCounts.get(publicSchoolName) ?? 1;

    return {
      id: team.id,
      name: team.name,
      publicSchoolName,
      aliasGroupCount,
      needsCleanup: aliasGroupCount > 1,
      city: team.city,
      region: team.region,
      homeGames: team._count.homeGames,
      awayGames: team._count.awayGames,
      gameStats: team._count.gameStats,
      context: teamContext(team.name)
    };
  });

  return <TeamManagementClient teams={serializedTeams} />;
}
