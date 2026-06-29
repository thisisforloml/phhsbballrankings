import { notFound } from "next/navigation";
import { ProgramType } from "@prisma/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { formatHeight, getPlayerProfileHref } from "@/lib/format";
import { managedPlayerInclude, serializeManagedPlayer } from "@/lib/admin/serialize-managed-player";
import { getClassYear, getEffectiveClassYear, isRankingEligibleByClassYear } from "@/lib/ranking-eligibility";
import {
  ProgramDetailShell,
  type ProgramEditorData,
  type ProgramTeamRosterSection,
  type RosterRow,
  type TeamEditorData,
} from "./ProgramDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoadedProgram = NonNullable<Awaited<ReturnType<typeof loadProgram>>["program"]>;
type LoadedTeam = LoadedProgram["teams"][number];
type LoadedPlayer = LoadedTeam["gameStats"][number]["player"];
type LoadedCurrentPlayer = LoadedProgram["currentPlayers"][number];

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

function isGraduatedPlayer(birthDate: Date | null, classYearOverride: number | null) {
  if (getEffectiveClassYear(birthDate, classYearOverride) === null) return false;
  return !isRankingEligibleByClassYear(birthDate, new Date(), classYearOverride);
}

function createRosterRow(
  player: { id: string; displayName: string; gender: string; birthDate: Date | null; classYearOverride: number | null; position: string | null; heightCm: number | null },
  appearsInMultipleTeamSections: boolean
): RosterRow {
  return {
    id: player.id,
    displayName: player.displayName,
    gender: player.gender,
    classYear: classYearLabel(player.birthDate, player.classYearOverride),
    position: player.position,
    height: formatHeight(player.heightCm),
    profileHref: getPlayerProfileHref({ id: player.id, displayName: player.displayName }),
    appearsInMultipleTeamSections,
  };
}

async function loadProgram(id: string) {
  const [program, linkedPlayers, schoolPrograms] = await Promise.all([
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
              take: 3,
            },
            gameStats: {
              where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
              select: { teamId: true },
            },
          },
          orderBy: { displayName: "asc" },
        },
        teams: {
          where: {
            deletedAt: null,
            OR: [
              { homeGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
              { awayGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
              { gameStats: { some: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } } },
            ],
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
                      take: 3,
                    },
                  },
                },
              },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.player.findMany({
      where: {
        deletedAt: null,
        OR: [
          { currentProgramId: id },
          { gameStats: { some: { deletedAt: null, team: { programId: id, deletedAt: null } } } },
        ],
      },
      include: managedPlayerInclude,
      orderBy: { displayName: "asc" },
    }),
    prisma.program.findMany({
      where: { deletedAt: null, type: ProgramType.SCHOOL },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  return { program, linkedPlayers, schoolPrograms };
}

export default async function AdminProgramDetailPage({ params }: { params: { id: string } }) {
  await requireAdminUser();
  const { program, linkedPlayers, schoolPrograms } = await loadProgram(params.id);
  if (!program) notFound();

  const programData: ProgramEditorData = {
    id: program.id,
    fullName: program.fullName,
    abbreviation: program.abbreviation,
    type: program.type,
    city: program.city,
    region: program.region,
  };

  const managedPlayersById = Object.fromEntries(linkedPlayers.map((player) => [player.id, serializeManagedPlayer(player)]));
  const graduatePlayers = linkedPlayers
    .filter((player) => isGraduatedPlayer(player.birthDate, player.classYearOverride))
    .map((player) => serializeManagedPlayer(player));

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

    const contexts = uniqueSorted(
      games.map((game) => `${game.season.league.ageGroup} ${inferGender(game.season.league.name, team.name)} / ${game.season.league.name} / ${game.season.name}`)
    );
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
      latestGameDate: formatDate(latestGameDate),
    };
  });

  const activeTeamIds = new Set(teamRows.map((team) => team.id));

  const duplicateContextGroups = Array.from(contextTeams.entries())
    .filter(([, teamIds]) => teamIds.size > 1)
    .map(([context, teamIds]) => ({
      context,
      teamCount: teamIds.size,
      teams: Array.from(contextTeamNames.get(context) ?? []).sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.context.localeCompare(right.context));
  const highTeamCount = teamRows.length >= 9;
  const cleanupItems = [
    ...duplicateContextGroups.map((group) => ({
      title: "Same-context team records",
      detail: `${group.context}: ${group.teams.join(", ")}`,
      tone: "warning" as const,
    })),
    ...(highTeamCount
      ? [
          {
            title: "High linked team count",
            detail: `${program.fullName} has ${teamRows.length} current Team records. Review possible duplicates before renaming anything.`,
            tone: "notice" as const,
          },
        ]
      : []),
  ];

  const playerTeamCounts = new Map<string, number>();
  for (const team of program.teams) {
    if (!activeTeamIds.has(team.id)) continue;
    const uniquePlayerIds = new Set(team.gameStats.map((stat) => stat.player.id));
    for (const playerId of uniquePlayerIds) {
      playerTeamCounts.set(playerId, (playerTeamCounts.get(playerId) ?? 0) + 1);
    }
  }

  const teamRosterSections: ProgramTeamRosterSection[] = teamRows.map((teamRow) => {
    const team = teamById.get(teamRow.id);
    const playersById = new Map<string, LoadedPlayer>();
    for (const stat of team?.gameStats ?? []) {
      if (isGraduatedPlayer(stat.player.birthDate, stat.player.classYearOverride)) continue;
      playersById.set(stat.player.id, stat.player);
    }
    const players = Array.from(playersById.values())
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((player) => createRosterRow(player, (playerTeamCounts.get(player.id) ?? 0) > 1));

    return { team: teamRow, players };
  });

  const activeSectionPlayerIds = new Set<string>();
  for (const section of teamRosterSections) {
    for (const player of section.players) activeSectionPlayerIds.add(player.id);
  }

  const unassignedRoster = program.currentPlayers
    .filter(
      (player) =>
        !isGraduatedPlayer(player.birthDate, player.classYearOverride) &&
        !activeSectionPlayerIds.has(player.id) &&
        !player.gameStats.some((stat) => activeTeamIds.has(stat.teamId))
    )
    .map((player) => createRosterRow(player, false));

  const uniqueProgramPlayers = new Set<string>();
  for (const section of teamRosterSections) {
    for (const player of section.players) uniqueProgramPlayers.add(player.id);
  }
  for (const player of unassignedRoster) uniqueProgramPlayers.add(player.id);

  const officialGames = teamRows.reduce((sum, team) => sum + team.officialGames, 0);
  const gameStats = teamRows.reduce((sum, team) => sum + team.activeGameStats, 0);

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        backLink={{ href: "/admin/programs", label: "Back to Program Management" }}
        eyebrow="Program Detail"
        title={program.fullName}
        description={`${program.abbreviation || "No abbreviation"} · ${program.type} · ${[program.city, program.region].filter(Boolean).join(", ") || "Location not listed"}`}
      />

      <ProgramDetailShell
        programId={program.id}
        program={programData}
        teamRows={teamRows}
        teamRosterSections={teamRosterSections}
        unassignedRoster={unassignedRoster}
        graduatePlayers={graduatePlayers}
        managedPlayersById={managedPlayersById}
        schoolPrograms={schoolPrograms}
        cleanupItems={cleanupItems}
        stats={{
          teamCount: teamRows.length,
          playerCount: uniqueProgramPlayers.size,
          graduateCount: graduatePlayers.length,
          officialGames,
          gameStats,
        }}
      />
    </div>
  );
}
