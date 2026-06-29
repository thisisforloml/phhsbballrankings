import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { ProgramListClient, type ProgramListRow } from "./ProgramListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Programs | Admin",
  description: "Edit school and club programs."
};

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

export default async function AdminProgramsPage() {
  await requireAdminUser();

  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    include: {
      teams: {
        where: {
          deletedAt: null,
          OR: [
            { homeGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
            { awayGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
            { gameStats: { some: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } } }
          ]
        },
        select: {
          id: true,
          name: true,
          homeGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, select: { id: true, season: { include: { league: true } } } },
          awayGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, select: { id: true, season: { include: { league: true } } } },
          gameStats: { where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } }, select: { playerId: true } }
        }
      }
    },
    orderBy: [{ type: "asc" }, { fullName: "asc" }]
  });

  const rows: ProgramListRow[] = programs.map((program) => {
    const officialGameIds = new Set<string>();
    const playerIds = new Set<string>();
    const activeTeamIds = new Set<string>();
    const contextTeams = new Map<string, Set<string>>();

    for (const team of program.teams) {
      const gamesById = new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game]));
      for (const game of gamesById.values()) {
        officialGameIds.add(game.id);
        activeTeamIds.add(team.id);
        const gender = inferGender(game.season.league.name, team.name);
        const contextKey = [game.season.league.ageGroup, gender, game.season.league.id, game.season.id].join("|");
        const teamSet = contextTeams.get(contextKey) ?? new Set<string>();
        teamSet.add(team.id);
        contextTeams.set(contextKey, teamSet);
      }
      if (team.gameStats.length) activeTeamIds.add(team.id);
      for (const stat of team.gameStats) playerIds.add(stat.playerId);
    }

    return {
      id: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
      type: program.type,
      city: program.city,
      region: program.region,
      teamCount: activeTeamIds.size,
      possibleDuplicateContextGroups: Array.from(contextTeams.values()).filter((teamIds) => teamIds.size > 1).length,
      derivedPlayerCount: playerIds.size,
      officialGameCount: officialGameIds.size
    };
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Program Management"
        title="Schools, Clubs, and Team Programs"
        description="Use this as the primary structure for school, club, and team organization. Program Management shows only teams currently used by official games or stats; inactive/internal records stay in Internal Team Records for audit review."
        statusBadge={`${rows.length} records`}
      />
      <Suspense fallback={null}>
        <ProgramListClient programs={rows} />
      </Suspense>
    </>
  );
}
