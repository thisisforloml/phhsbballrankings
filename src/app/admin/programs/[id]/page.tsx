import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { getClassYear } from "@/lib/ranking-eligibility";
import { PlayerCurrentProgramForm, ProgramEditor, TeamMonikerForm, type ProgramEditorData, type ProgramPlayerData, type ProgramSelectOption, type TeamEditorData } from "./ProgramDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function aliasesToStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function classYearLabel(birthDate: Date | null, override: number | null) {
  const year = override ?? getClassYear(birthDate);
  return year ? `Class of ${year}` : "Not listed";
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function loadProgram(id: string) {
  const [program, programs] = await Promise.all([
    prisma.program.findFirst({
      where: { id, deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            _count: { select: { homeGames: true, awayGames: true, gameStats: true } },
            homeGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } } } },
            awayGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } } } },
            gameStats: {
              where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
              include: {
                player: {
                  include: {
                    currentProgram: true,
                    programHistory: {
                      include: { fromProgram: true, toProgram: true },
                      orderBy: { createdAt: "desc" },
                      take: 3
                    }
                  }
                }
              }
            }
          },
          orderBy: { name: "asc" }
        }
      }
    }),
    prisma.program.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, abbreviation: true },
      orderBy: [{ fullName: "asc" }, { abbreviation: "asc" }]
    })
  ]);
  return { program, programs };
}

export default async function AdminProgramDetailPage({ params }: { params: { id: string } }) {
  await requireAdminUser();
  const { program, programs } = await loadProgram(params.id);
  if (!program) notFound();

  const programOptions: ProgramSelectOption[] = programs.map((option) => ({ id: option.id, fullName: option.fullName, abbreviation: option.abbreviation }));
  const programData: ProgramEditorData = {
    id: program.id,
    fullName: program.fullName,
    abbreviation: program.abbreviation,
    type: program.type,
    city: program.city,
    region: program.region,
    aliasesText: aliasesToStrings(program.aliases).join("\n")
  };

  const teamRows: TeamEditorData[] = program.teams.map((team) => {
    const gameMap = new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game]));
    const games = Array.from(gameMap.values());
    const latestGameDate = games.reduce<Date | null>((latest, game) => {
      if (!game.gameDate) return latest;
      return !latest || game.gameDate > latest ? game.gameDate : latest;
    }, null);

    return {
      id: team.id,
      name: team.name,
      ageGroups: uniqueSorted(games.map((game) => game.season.league.ageGroup)),
      genders: uniqueSorted(games.map((game) => inferGender(game.season.league.name, team.name))),
      leagues: uniqueSorted(games.map((game) => game.season.league.name)),
      contexts: uniqueSorted(games.map((game) => `${game.season.league.ageGroup} ${inferGender(game.season.league.name, team.name)} / ${game.season.league.name} / ${game.season.name}`)),
      officialGames: games.length,
      activeGameStats: team.gameStats.length,
      latestGameDate: formatDate(latestGameDate),
      historicalHomeGames: team._count.homeGames,
      historicalAwayGames: team._count.awayGames,
      historicalGameStats: team._count.gameStats
    };
  });

  const activeTeamRows = teamRows.filter((team) => team.officialGames > 0 || team.activeGameStats > 0);
  const legacyTeamRows = teamRows.filter((team) => team.officialGames === 0 && team.activeGameStats === 0);

  const playerMap = new Map<string, ProgramPlayerData>();

  for (const team of program.teams) {
    for (const stat of team.gameStats) {
      if (!playerMap.has(stat.player.id)) {
        playerMap.set(stat.player.id, {
          id: stat.player.id,
          displayName: stat.player.displayName,
          gender: stat.player.gender,
          currentProgramId: stat.player.currentProgramId,
          currentProgram: stat.player.currentProgram?.fullName ?? "Not set",
          derivedProgram: program.fullName,
          classYear: classYearLabel(stat.player.birthDate, stat.player.classYearOverride),
          position: stat.player.position ?? "Not listed",
          height: formatHeight(stat.player.heightCm),
          profileHref: getPlayerProfileHref({ id: stat.player.id, displayName: stat.player.displayName }),
          recentTransfers: stat.player.programHistory.map((history) => ({
            id: history.id,
            fromProgram: history.fromProgram?.fullName ?? "Not set",
            toProgram: history.toProgram?.fullName ?? "Not set",
            effectiveDate: formatDate(history.effectiveDate),
            note: history.note,
            createdAt: formatDate(history.createdAt) ?? ""
          }))
        });
      }
    }
  }

  const players = Array.from(playerMap.values()).sort((left, right) => left.displayName.localeCompare(right.displayName));
  const officialGames = activeTeamRows.reduce((sum, team) => sum + team.officialGames, 0);
  const gameStats = activeTeamRows.reduce((sum, team) => sum + team.activeGameStats, 0);

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="programs" />
        <section className="container-px grid gap-6 py-8">
          <Link href="/admin/programs" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Back to Program Management</Link>
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Program Detail</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">{program.fullName}</h1>
                <p className="mt-2 text-ink-600">{program.abbreviation || "No abbreviation"} / {program.type} / {[program.city, program.region].filter(Boolean).join(", ") || "Location not listed"}</p>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-mono-sm uppercase text-ink-600"><span>{activeTeamRows.length} active teams</span><span>{legacyTeamRows.length} legacy teams</span><span>{players.length} players</span><span>{officialGames} official games</span><span>{gameStats} stat rows</span></div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(26rem,0.9fr)_minmax(34rem,1.1fr)]">
            <ProgramEditor program={programData} />
            <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <p className="label">Transfer status</p>
              <h2 className="mt-2 font-display text-3xl text-navy-800">Player transfers</h2>
              <p className="mt-2 rounded-md bg-amber-50 p-4 text-sm text-amber-900">Current Program changes are display/admin changes only. Historical games remain tied to the team and Program from that game.</p>
            </section>
          </div>

          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">Active Teams</h2>
                <p className="mt-1 text-sm text-ink-600">Teams used in official Games or active GameStats.</p>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase text-green-800">{activeTeamRows.length} active</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {activeTeamRows.map((team) => <TeamMonikerForm key={team.id} programId={program.id} team={team} />)}
              {!activeTeamRows.length ? <p className="text-sm text-ink-600">No active teams linked to this Program.</p> : null}
            </div>
          </section>

          <details className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer font-display text-2xl text-navy-800">Inactive / Legacy Teams ({legacyTeamRows.length})</summary>
            <p className="mt-3 rounded-md bg-amber-50 p-4 text-sm text-amber-900">Legacy teams are kept for audit/history. Renaming them does not merge team records.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {legacyTeamRows.map((team) => <TeamMonikerForm key={team.id} programId={program.id} team={team} legacy />)}
              {!legacyTeamRows.length ? <p className="text-sm text-ink-600">No inactive or legacy teams linked to this Program.</p> : null}
            </div>
          </details>

          <section className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-200 p-5">
              <h2 className="font-display text-3xl text-navy-800">Players</h2>
              <p className="mt-1 text-sm text-ink-600">Derived from active official GameStats for linked teams. Use Edit only for data correction; use Transfer for real school moves.</p>
            </div>
            <div className="hidden grid-cols-[1.25fr_7rem_1fr_1fr_8rem_8rem] gap-3 border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
              <span>Player</span><span>Gender</span><span>Current program</span><span>Derived program</span><span>Class</span><span>Profile</span>
            </div>
            {players.map((player) => <PlayerCurrentProgramForm key={player.id} programId={program.id} player={player} programs={programOptions} />)}
            {!players.length ? <p className="p-5 text-sm text-ink-600">No active players derived from linked team stats.</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
