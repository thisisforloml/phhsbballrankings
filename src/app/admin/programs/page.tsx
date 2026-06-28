import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { ProgramListClient, type ProgramListRow } from "./ProgramListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Programs | Admin",
  description: "Edit school and club programs."
};

function aliasesToStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

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
      aliases: aliasesToStrings(program.aliases),
      teamCount: activeTeamIds.size,
      possibleDuplicateContextGroups: Array.from(contextTeams.values()).filter((teamIds) => teamIds.size > 1).length,
      derivedPlayerCount: playerIds.size,
      officialGameCount: officialGameIds.size
    };
  });

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="programs" />
        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Program Management</p>
            <h1 className="mt-2 font-display text-stat-md text-navy-800">Schools, Clubs, and Team Programs</h1>
            <p className="mt-2 max-w-3xl text-ink-600">Use this as the primary structure for school, club, and team organization. Program Management shows only Teams currently used by official games or stats; inactive/internal records stay in Internal Team Records for audit review.</p>
          </div>
          <Suspense fallback={null}>
            <ProgramListClient programs={rows} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
