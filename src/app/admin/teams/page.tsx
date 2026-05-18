import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
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

  const serializedTeams: ManagedTeam[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    city: team.city,
    region: team.region,
    homeGames: team._count.homeGames,
    awayGames: team._count.awayGames,
    gameStats: team._count.gameStats
  }));

  return <TeamManagementClient teams={serializedTeams} />;
}
