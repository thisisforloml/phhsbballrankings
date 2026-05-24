import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { ProgramListClient, type ProgramListRow } from "./ProgramListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Program Management - Admin Portal",
  description: "Manage school, club, and team program identities."
};

function aliasesToStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function AdminProgramsPage() {
  await requireAdminUser();

  const programs = await prisma.program.findMany({
    where: { deletedAt: null },
    include: {
      teams: {
        where: { deletedAt: null },
        select: {
          id: true,
          homeGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, select: { id: true } },
          awayGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, select: { id: true } },
          gameStats: { where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } }, select: { playerId: true } }
        }
      }
    },
    orderBy: [{ type: "asc" }, { fullName: "asc" }]
  });

  const rows: ProgramListRow[] = programs.map((program) => {
    const officialGameIds = new Set(program.teams.flatMap((team) => [...team.homeGames, ...team.awayGames].map((game) => game.id)));
    const playerIds = new Set(program.teams.flatMap((team) => team.gameStats.map((stat) => stat.playerId)));
    return {
      id: program.id,
      fullName: program.fullName,
      abbreviation: program.abbreviation,
      type: program.type,
      city: program.city,
      region: program.region,
      aliases: aliasesToStrings(program.aliases),
      linkedTeamCount: program.teams.length,
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
            <h1 className="mt-2 font-display text-stat-md text-navy-800">Schools, Clubs, and Teams</h1>
            <p className="mt-2 max-w-3xl text-ink-600">Edit canonical Program records, review linked team monikers, and inspect derived players from official stat rows.</p>
          </div>
          <ProgramListClient programs={rows} />
        </section>
      </div>
    </main>
  );
}
