import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { resolveProgramIdentity } from "@/lib/uaap-school-display";
import { TeamManagementClient, type ManagedTeam, type TeamSchoolGroup } from "./TeamManagementClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Internal Team Records - Admin Portal",
  description: "Compatibility page for old internal Team records."
};

type ContextSummary = {
  ageGroup: string;
  gender: string;
  league: string;
  season: string;
};


function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function formatContext(context: ContextSummary) {
  return `${context.ageGroup} ${context.gender} / ${context.league} / ${context.season}`;
}

export default async function AdminTeamsPage() {
  await requireAdminUser();

  const [teams, activeGames] = await Promise.all([
    prisma.team.findMany({
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
    }),
    prisma.game.findMany({
      where: {
        deletedAt: null,
        season: { deletedAt: null, league: { deletedAt: null } },
        homeTeam: { deletedAt: null },
        awayTeam: { deletedAt: null }
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        season: { include: { league: true } },
        stats: { where: { deletedAt: null }, select: { teamId: true, player: { select: { id: true, displayName: true } } } }
      }
    })
  ]);

  const contextsByTeamId = new Map<string, Map<string, ContextSummary>>();
  const teamsByPublicSchoolContext = new Map<string, Set<string>>();
  const activeUsageByTeamId = new Map<string, { homeGames: number; awayGames: number; gameStats: number; players: Map<string, string> }>();

  for (const game of activeGames) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const context: ContextSummary = {
      ageGroup: game.season.league.ageGroup,
      gender,
      league: game.season.league.name,
      season: game.season.name
    };
    const contextKey = [context.ageGroup, context.gender, game.season.leagueId, game.seasonId].join("|");

    for (const [team, side] of [[game.homeTeam, "home"], [game.awayTeam, "away"]] as const) {
      const identity = resolveProgramIdentity(team.name);
      const publicName = identity.programFullName;
      const contextMap = contextsByTeamId.get(team.id) ?? new Map<string, ContextSummary>();
      contextMap.set(contextKey, context);
      contextsByTeamId.set(team.id, contextMap);

      const usage = activeUsageByTeamId.get(team.id) ?? { homeGames: 0, awayGames: 0, gameStats: 0, players: new Map<string, string>() };
      if (side === "home") usage.homeGames += 1;
      if (side === "away") usage.awayGames += 1;
      activeUsageByTeamId.set(team.id, usage);

      const publicContextKey = `${publicName}|${contextKey}`;
      const contextTeams = teamsByPublicSchoolContext.get(publicContextKey) ?? new Set<string>();
      contextTeams.add(team.id);
      teamsByPublicSchoolContext.set(publicContextKey, contextTeams);
    }

    for (const stat of game.stats) {
      const usage = activeUsageByTeamId.get(stat.teamId) ?? { homeGames: 0, awayGames: 0, gameStats: 0, players: new Map<string, string>() };
      usage.gameStats += 1;
      usage.players.set(stat.player.id, stat.player.displayName);
      activeUsageByTeamId.set(stat.teamId, usage);
    }
  }

  const sameContextDuplicateTeamIds = new Set<string>();
  for (const teamIds of teamsByPublicSchoolContext.values()) {
    if (teamIds.size > 1) {
      for (const teamId of teamIds) sameContextDuplicateTeamIds.add(teamId);
    }
  }

  const serializedTeams: ManagedTeam[] = teams.map((team) => {
    const identity = resolveProgramIdentity(team.name);
    const publicSchoolName = identity.programFullName;
    const contexts = Array.from(contextsByTeamId.get(team.id)?.values() ?? []);
    const activeUsage = activeUsageByTeamId.get(team.id) ?? { homeGames: 0, awayGames: 0, gameStats: 0, players: new Map<string, string>() };
    const isActiveCompetitionTeam = contexts.length > 0 || activeUsage.gameStats > 0;

    return {
      id: team.id,
      name: team.name,
      publicSchoolName,
      programKey: identity.programKey,
      programAbbreviation: identity.programAbbreviation,
      programType: identity.programType,
      teamDisplayName: identity.teamDisplayName,
      needsCleanup: sameContextDuplicateTeamIds.has(team.id),
      isActiveCompetitionTeam,
      city: team.city,
      region: team.region,
      homeGames: activeUsage.homeGames,
      awayGames: activeUsage.awayGames,
      gameStats: activeUsage.gameStats,
      historicalHomeGames: team._count.homeGames,
      historicalAwayGames: team._count.awayGames,
      historicalGameStats: team._count.gameStats,
      playerCount: activeUsage.players.size,
      playerNames: Array.from(activeUsage.players.values()).sort((left, right) => left.localeCompare(right)),
      contexts: contexts.map(formatContext).sort(),
      context: contexts.length ? contexts.map((context) => `${context.ageGroup} ${context.gender}`).join(", ") : "No active competition context"
    };
  });

  const activeTeams = serializedTeams.filter((team) => team.isActiveCompetitionTeam);
  const activeSchoolGroups: TeamSchoolGroup[] = Array.from(new Map(activeTeams.map((team) => [team.publicSchoolName, team.publicSchoolName])).keys())
    .sort((left, right) => left.localeCompare(right))
    .map((publicSchoolName) => ({
      publicSchoolName,
      programAbbreviation: activeTeams.find((team) => team.publicSchoolName === publicSchoolName)?.programAbbreviation ?? publicSchoolName,
      programType: activeTeams.find((team) => team.publicSchoolName === publicSchoolName)?.programType ?? "Club / Team",
      teams: activeTeams
        .filter((team) => team.publicSchoolName === publicSchoolName)
        .sort((left, right) => left.context.localeCompare(right.context) || left.name.localeCompare(right.name)),
      hasSameContextDuplicate: activeTeams.some((team) => team.publicSchoolName === publicSchoolName && team.needsCleanup)
    }));

  return <TeamManagementClient teams={serializedTeams} activeSchoolGroups={activeSchoolGroups} />;
}
