import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { getAgeBracketAsOfMarch31, getClassYear } from "@/lib/ranking-eligibility";
import {
  ProgramEditor,
  ProgramPlayerRow,
  TeamMonikerForm,
  TeamPlayerSection,
  type ProgramEditorData,
  type ProgramPlayerData,
  type ProgramSelectOption,
  type ProgramTeamPlayerSectionData,
  type TeamEditorData
} from "./ProgramDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoadedProgram = NonNullable<Awaited<ReturnType<typeof loadProgram>>["program"]>;
type LoadedTeam = LoadedProgram["teams"][number];
type LoadedPlayer = LoadedTeam["gameStats"][number]["player"];
type LoadedCurrentPlayer = LoadedProgram["currentPlayers"][number];

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

function toInputDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function getPlayerNameParts(player: { firstName: string | null; lastName: string | null; displayName: string }) {
  const names = player.displayName.trim().split(/\s+/);
  return {
    firstName: player.firstName || names.slice(0, -1).join(" ") || player.displayName,
    lastName: player.lastName || names.at(-1) || player.displayName
  };
}

function createPlayerData(player: LoadedPlayer | LoadedCurrentPlayer, derivedProgram: string, appearsInMultipleTeamSections: boolean): ProgramPlayerData {
  const names = getPlayerNameParts(player);
  const calculatedClassYear = getClassYear(player.birthDate);
  const computedAgeBracket = getAgeBracketAsOfMarch31(player.birthDate);

  return {
    id: player.id,
    displayName: player.displayName,
    firstName: names.firstName,
    lastName: names.lastName,
    gender: player.gender,
    currentProgramId: player.currentProgramId,
    currentProgram: player.currentProgram?.fullName ?? "Not set",
    derivedProgram,
    schoolOverride: player.schoolOverride,
    classYear: classYearLabel(player.birthDate, player.classYearOverride),
    calculatedClassYear,
    classYearOverride: player.classYearOverride,
    computedAgeBracket: computedAgeBracket ?? "Unknown",
    ageGroupOverride: player.ageGroupOverride,
    position: player.position,
    height: formatHeight(player.heightCm),
    heightCm: player.heightCm,
    city: player.city,
    region: player.region,
    birthDate: toInputDate(player.birthDate),
    photoUrl: player.photoUrl,
    profileHref: getPlayerProfileHref({ id: player.id, displayName: player.displayName }),
    appearsInMultipleTeamSections,
    recentTransfers: player.programHistory.map((history) => ({
      id: history.id,
      fromProgram: history.fromProgram?.fullName ?? "Not set",
      toProgram: history.toProgram?.fullName ?? "Not set",
      effectiveDate: formatDate(history.effectiveDate),
      note: history.note,
      createdAt: formatDate(history.createdAt) ?? ""
    }))
  };
}

async function loadProgram(id: string) {
  const [program, programs] = await Promise.all([
    prisma.program.findFirst({
      where: { id, deletedAt: null },
      include: {
        currentPlayers: {
          where: { deletedAt: null },
          include: {
            currentProgram: true,
            programHistory: {
              include: { fromProgram: true, toProgram: true },
              orderBy: { createdAt: "desc" },
              take: 3
            },
            gameStats: {
              where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
              select: { teamId: true }
            }
          },
          orderBy: { displayName: "asc" }
        },
        teams: {
          where: {
            deletedAt: null,
            OR: [
              { homeGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
              { awayGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
              { gameStats: { some: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } } }
            ]
          },
          include: {
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
      select: { id: true, fullName: true, abbreviation: true, type: true },
      orderBy: [{ fullName: "asc" }, { abbreviation: "asc" }]
    })
  ]);
  return { program, programs };
}

export default async function AdminProgramDetailPage({ params }: { params: { id: string } }) {
  await requireAdminUser();
  const { program, programs } = await loadProgram(params.id);
  if (!program) notFound();

  const programOptions: ProgramSelectOption[] = programs.map((option) => ({
    id: option.id,
    fullName: option.fullName,
    abbreviation: option.abbreviation,
    type: option.type
  }));
  const programData: ProgramEditorData = {
    id: program.id,
    fullName: program.fullName,
    abbreviation: program.abbreviation,
    type: program.type,
    city: program.city,
    region: program.region,
    aliasesText: aliasesToStrings(program.aliases).join("\n")
  };

  const contextTeams = new Map<string, Set<string>>();
  const contextTeamNames = new Map<string, Set<string>>();
  const teamById = new Map(program.teams.map((team) => [team.id, team]));

  const teamRows: TeamEditorData[] = program.teams.map((team) => {
    const gameMap = new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game]));
    const games = Array.from(gameMap.values());
    const latestGameDate = games.reduce<Date | null>((latest, game) => {
      if (!game.gameDate) return latest;
      return !latest || game.gameDate > latest ? game.gameDate : latest;
    }, null);

    const contexts = uniqueSorted(games.map((game) => `${game.season.league.ageGroup} ${inferGender(game.season.league.name, team.name)} / ${game.season.league.name} / ${game.season.name}`));
    for (const context of contexts) {
      const teamIds = contextTeams.get(context) ?? new Set<string>();
      teamIds.add(team.id);
      contextTeams.set(context, teamIds);
      const names = contextTeamNames.get(context) ?? new Set<string>();
      names.add(team.name);
      contextTeamNames.set(context, names);
    }

    return {
      id: team.id,
      name: team.name,
      ageGroups: uniqueSorted(games.map((game) => game.season.league.ageGroup)),
      genders: uniqueSorted(games.map((game) => inferGender(game.season.league.name, team.name))),
      leagues: uniqueSorted(games.map((game) => game.season.league.name)),
      contexts,
      officialGames: games.length,
      activeGameStats: team.gameStats.length,
      latestGameDate: formatDate(latestGameDate)
    };
  });

  const activeTeamIds = new Set(teamRows.map((team) => team.id));

  const duplicateContextGroups = Array.from(contextTeams.entries())
    .filter(([, teamIds]) => teamIds.size > 1)
    .map(([context, teamIds]) => ({ context, teamCount: teamIds.size, teams: Array.from(contextTeamNames.get(context) ?? []).sort((left, right) => left.localeCompare(right)) }))
    .sort((left, right) => left.context.localeCompare(right.context));
  const highTeamCount = teamRows.length >= 9;
  const cleanupItems = [
    ...duplicateContextGroups.map((group) => ({ title: "Same-context team records", detail: `${group.context}: ${group.teams.join(", ")}`, tone: "warning" as const })),
    ...(highTeamCount ? [{ title: "High linked team count", detail: `${program.fullName} has ${teamRows.length} current Team records. Review possible duplicates before renaming anything.`, tone: "notice" as const }] : [])
  ];

  const playerTeamCounts = new Map<string, number>();
  for (const team of program.teams) {
    if (!activeTeamIds.has(team.id)) continue;
    const uniquePlayerIds = new Set(team.gameStats.map((stat) => stat.player.id));
    for (const playerId of uniquePlayerIds) {
      playerTeamCounts.set(playerId, (playerTeamCounts.get(playerId) ?? 0) + 1);
    }
  }

  const teamPlayerSections: ProgramTeamPlayerSectionData[] = teamRows.map((teamRow) => {
    const team = teamById.get(teamRow.id);
    const playersById = new Map<string, LoadedPlayer>();
    for (const stat of team?.gameStats ?? []) {
      playersById.set(stat.player.id, stat.player);
    }
    const players = Array.from(playersById.values())
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((player) => createPlayerData(player, program.fullName, (playerTeamCounts.get(player.id) ?? 0) > 1));

    return { team: teamRow, players };
  });

  const activeSectionPlayerIds = new Set<string>();
  for (const section of teamPlayerSections) {
    for (const player of section.players) activeSectionPlayerIds.add(player.id);
  }

  const unassignedProgramPlayers = program.currentPlayers
    .filter((player) => !activeSectionPlayerIds.has(player.id) && !player.gameStats.some((stat) => activeTeamIds.has(stat.teamId)))
    .map((player) => createPlayerData(player, "Current program assignment", false));

  const uniqueProgramPlayers = new Set<string>();
  for (const section of teamPlayerSections) {
    for (const player of section.players) uniqueProgramPlayers.add(player.id);
  }
  for (const player of unassignedProgramPlayers) uniqueProgramPlayers.add(player.id);

  const officialGames = teamRows.reduce((sum, team) => sum + team.officialGames, 0);
  const gameStats = teamRows.reduce((sum, team) => sum + team.activeGameStats, 0);

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
              <div className="flex flex-wrap gap-2 font-mono text-mono-sm uppercase text-ink-600"><span>{teamRows.length} teams</span><span>{uniqueProgramPlayers.size} players</span><span>{officialGames} official games</span><span>{gameStats} stat rows</span></div>
            </div>
          </div>

          <ProgramEditor program={programData} />

          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">Current Teams</h2>
                <p className="mt-1 text-sm text-ink-600">Team / Moniker records currently used by official Games or active GameStats.</p>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase text-green-800">{teamRows.length} teams</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {teamRows.map((team) => <TeamMonikerForm key={team.id} programId={program.id} team={team} />)}
              {!teamRows.length ? <p className="text-sm text-ink-600">No current teams linked to this Program.</p> : null}
            </div>
          </section>

          <section className="grid gap-4">
            <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-3xl text-navy-800">Players by Current Team</h2>
              <p className="mt-1 text-sm text-ink-600">Players are grouped under each current Team / Moniker from official GameStats. Editing current program does not change historical teams or stats.</p>
            </div>
            {teamPlayerSections.map((section) => <TeamPlayerSection key={section.team.id} programId={program.id} section={section} programs={programOptions} />)}
            {!teamPlayerSections.length ? <p className="rounded-lg border border-surface-200 bg-white p-5 text-sm text-ink-600 shadow-sm">No current player sections found for this Program.</p> : null}
          </section>

          {unassignedProgramPlayers.length ? (
            <section className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
              <div className="border-b border-surface-200 p-5">
                <h2 className="font-display text-3xl text-navy-800">Unassigned / Program-level Players</h2>
                <p className="mt-1 text-sm text-ink-600">These players have this Program set as their current program but do not have active GameStats under the current team sections.</p>
              </div>
              {unassignedProgramPlayers.map((player) => <ProgramPlayerRow key={player.id} programId={program.id} player={player} programs={programOptions} />)}
            </section>
          ) : null}

          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-navy-800">Possible Cleanup Needed</h2>
                <p className="mt-1 text-sm text-ink-600">Read-only diagnostics. Possible duplicates require a separate approved cleanup plan.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${cleanupItems.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>{cleanupItems.length ? `${cleanupItems.length} notices` : "No duplicate contexts"}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {cleanupItems.map((item) => (
                <div key={`${item.title}:${item.detail}`} className={`rounded-md p-4 text-sm ${item.tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-surface-100 text-ink-700"}`}>
                  <strong className="block text-ink-900">{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
              {!cleanupItems.length ? <p className="rounded-md bg-green-50 p-4 text-sm text-green-900">No active same-context duplicate team groups detected. Separate teams by age group, gender, league, or season are expected.</p> : null}
            </div>
          </section>

        </section>
      </div>
    </main>
  );
}
