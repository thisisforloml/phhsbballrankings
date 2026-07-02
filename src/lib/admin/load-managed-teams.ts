import { activeCompetitionGameJoins, activeCompetitionGameSql } from "@/lib/admin/active-competition-sql";
import type { ManagedTeam } from "@/lib/admin/managed-team";
import { prisma } from "@/lib/prisma";
import { resolveProgramIdentity } from "@/lib/uaap-school-display";

export { activeCompetitionGameStatWhere, activeCompetitionGameWhere } from "@/lib/admin/active-competition-sql";

type ContextSummary = {
  ageGroup: string;
  gender: string;
  league: string;
  season: string;
};

type TeamBaseRow = {
  id: string;
  name: string;
  city: string;
  region: string;
  logoUrl: string | null;
  historicalHomeGames: number;
  historicalAwayGames: number;
  historicalGameStats: number;
};

type ContextGameRow = {
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  season: {
    id: string;
    name: string;
    leagueId: string;
    league: { name: string; ageGroup: string };
  };
};

type ActivityBundle = {
  homeCounts: Record<string, number>;
  awayCounts: Record<string, number>;
  statCounts: Record<string, number>;
  roster: Array<{ teamId: string; playerId: string; displayName: string }>;
  contextGames: ContextGameRow[];
};

let activityBundleCache: { value: ActivityBundle; loadedAt: number } | null = null;
const MANAGED_TEAMS_CACHE_MS = 5 * 60 * 1000;

let managedTeamsCache: { value: ManagedTeam[]; loadedAt: number } | null = null;

export function clearManagedTeamsCache() {
  activityBundleCache = null;
  managedTeamsCache = null;
}

export function clearManagedTeamsActivityBundleCache() {
  clearManagedTeamsCache();
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function formatContext(context: ContextSummary) {
  return `${context.ageGroup} ${context.gender} / ${context.league} / ${context.season}`;
}

function countMapFromJson(value: Record<string, number> | null | undefined) {
  const map = new Map<string, number>();
  if (!value) return map;
  for (const [teamId, count] of Object.entries(value)) {
    map.set(teamId, Number(count));
  }
  return map;
}

export async function loadManagedTeamsBaseRows(): Promise<TeamBaseRow[]> {
  return prisma.$queryRaw<TeamBaseRow[]>`
    SELECT
      t.id AS id,
      t.name AS name,
      t.city AS city,
      t.region AS region,
      t."logoUrl" AS "logoUrl",
      COALESCE(home_counts.count, 0)::int AS "historicalHomeGames",
      COALESCE(away_counts.count, 0)::int AS "historicalAwayGames",
      COALESCE(stat_counts.count, 0)::int AS "historicalGameStats"
    FROM teams t
    LEFT JOIN (
      SELECT g."homeTeamId" AS team_id, COUNT(*)::int AS count
      FROM games g
      GROUP BY g."homeTeamId"
    ) home_counts ON home_counts.team_id = t.id
    LEFT JOIN (
      SELECT g."awayTeamId" AS team_id, COUNT(*)::int AS count
      FROM games g
      GROUP BY g."awayTeamId"
    ) away_counts ON away_counts.team_id = t.id
    LEFT JOIN (
      SELECT gs."teamId" AS team_id, COUNT(*)::int AS count
      FROM game_stats gs
      GROUP BY gs."teamId"
    ) stat_counts ON stat_counts.team_id = t.id
    WHERE t."deletedAt" IS NULL
    ORDER BY t.name ASC
  `;
}

export async function loadManagedTeamsActivityBundle(options?: { bypassCache?: boolean }): Promise<ActivityBundle> {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    activityBundleCache &&
    now - activityBundleCache.loadedAt < MANAGED_TEAMS_CACHE_MS
  ) {
    return activityBundleCache.value;
  }

  const rows = await prisma.$queryRaw<Array<{ payload: ActivityBundle }>>`
    WITH active_games AS (
      SELECT
        g.id AS "gameId",
        g."homeTeamId",
        g."awayTeamId",
        ht.name AS "homeTeamName",
        at.name AS "awayTeamName",
        s.id AS "seasonId",
        s.name AS "seasonName",
        s."leagueId",
        l.name AS "leagueName",
        l."ageGroup"::text AS "ageGroup"
      ${activeCompetitionGameJoins}
      WHERE ${activeCompetitionGameSql}
    ),
    home_counts AS (
      SELECT "homeTeamId" AS "teamId", COUNT(*)::int AS count
      FROM active_games
      GROUP BY "homeTeamId"
    ),
    away_counts AS (
      SELECT "awayTeamId" AS "teamId", COUNT(*)::int AS count
      FROM active_games
      GROUP BY "awayTeamId"
    ),
    stat_counts AS (
      SELECT gs."teamId", COUNT(*)::int AS "statCount"
      FROM game_stats gs
      INNER JOIN active_games ag ON ag."gameId" = gs."gameId"
      WHERE gs."deletedAt" IS NULL
      GROUP BY gs."teamId"
    ),
    roster_rows AS (
      SELECT DISTINCT
        gs."teamId",
        p.id AS "playerId",
        p."displayName"
      FROM game_stats gs
      INNER JOIN active_games ag ON ag."gameId" = gs."gameId"
      INNER JOIN players p ON p.id = gs."playerId"
      WHERE gs."deletedAt" IS NULL
    )
    SELECT json_build_object(
      'homeCounts', COALESCE((SELECT json_object_agg("teamId", count) FROM home_counts), '{}'::json),
      'awayCounts', COALESCE((SELECT json_object_agg("teamId", count) FROM away_counts), '{}'::json),
      'statCounts', COALESCE((SELECT json_object_agg("teamId", "statCount") FROM stat_counts), '{}'::json),
      'roster', COALESCE((
        SELECT json_agg(json_build_object(
          'teamId', "teamId",
          'playerId', "playerId",
          'displayName', "displayName"
        ))
        FROM roster_rows
      ), '[]'::json),
      'contextGames', COALESCE((
        SELECT json_agg(json_build_object(
          'homeTeam', json_build_object('id', "homeTeamId", 'name', "homeTeamName"),
          'awayTeam', json_build_object('id', "awayTeamId", 'name', "awayTeamName"),
          'season', json_build_object(
            'id', "seasonId",
            'name', "seasonName",
            'leagueId', "leagueId",
            'league', json_build_object('name', "leagueName", 'ageGroup', "ageGroup")
          )
        ))
        FROM active_games
      ), '[]'::json)
    ) AS payload
  `;

  const payload = rows[0]?.payload;
  const value = {
    homeCounts: payload?.homeCounts ?? {},
    awayCounts: payload?.awayCounts ?? {},
    statCounts: payload?.statCounts ?? {},
    roster: payload?.roster ?? [],
    contextGames: payload?.contextGames ?? [],
  };
  activityBundleCache = { value, loadedAt: now };
  return value;
}

function buildManagedTeams(baseRows: TeamBaseRow[], bundle: ActivityBundle): ManagedTeam[] {
  const homeGamesByTeamId = countMapFromJson(bundle.homeCounts);
  const awayGamesByTeamId = countMapFromJson(bundle.awayCounts);
  const gameStatsByTeamId = countMapFromJson(bundle.statCounts);

  const playersByTeamId = new Map<string, Map<string, string>>();
  for (const row of bundle.roster) {
    const roster = playersByTeamId.get(row.teamId) ?? new Map<string, string>();
    roster.set(row.playerId, row.displayName);
    playersByTeamId.set(row.teamId, roster);
  }

  const contextsByTeamId = new Map<string, Map<string, ContextSummary>>();
  const teamsByPublicSchoolContext = new Map<string, Set<string>>();

  for (const game of bundle.contextGames) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const context: ContextSummary = {
      ageGroup: game.season.league.ageGroup,
      gender,
      league: game.season.league.name,
      season: game.season.name,
    };
    const contextKey = [context.ageGroup, context.gender, game.season.leagueId, game.season.id].join("|");

    for (const team of [game.homeTeam, game.awayTeam]) {
      const identity = resolveProgramIdentity(team.name);
      const publicName = identity.programFullName;
      const contextMap = contextsByTeamId.get(team.id) ?? new Map<string, ContextSummary>();
      contextMap.set(contextKey, context);
      contextsByTeamId.set(team.id, contextMap);

      const publicContextKey = `${publicName}|${contextKey}`;
      const contextTeams = teamsByPublicSchoolContext.get(publicContextKey) ?? new Set<string>();
      contextTeams.add(team.id);
      teamsByPublicSchoolContext.set(publicContextKey, contextTeams);
    }
  }

  const sameContextDuplicateTeamIds = new Set<string>();
  for (const teamIds of teamsByPublicSchoolContext.values()) {
    if (teamIds.size > 1) {
      for (const teamId of teamIds) sameContextDuplicateTeamIds.add(teamId);
    }
  }

  return baseRows.map((team) => {
    const identity = resolveProgramIdentity(team.name);
    const publicSchoolName = identity.programFullName;
    const contexts = Array.from(contextsByTeamId.get(team.id)?.values() ?? []);
    const roster = playersByTeamId.get(team.id) ?? new Map<string, string>();
    const homeGames = homeGamesByTeamId.get(team.id) ?? 0;
    const awayGames = awayGamesByTeamId.get(team.id) ?? 0;
    const gameStats = gameStatsByTeamId.get(team.id) ?? 0;
    const isActiveCompetitionTeam = contexts.length > 0 || gameStats > 0;

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
      logoUrl: team.logoUrl,
      homeGames,
      awayGames,
      gameStats,
      historicalHomeGames: team.historicalHomeGames,
      historicalAwayGames: team.historicalAwayGames,
      historicalGameStats: team.historicalGameStats,
      playerCount: roster.size,
      playerNames: Array.from(roster.values()).sort((left, right) => left.localeCompare(right)),
      contexts: contexts.map(formatContext).sort(),
      context: contexts.length
        ? contexts.map((context) => `${context.ageGroup} ${context.gender}`).join(", ")
        : "No active competition context",
    };
  });
}

export async function loadManagedTeams(options?: { bypassCache?: boolean }): Promise<ManagedTeam[]> {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    managedTeamsCache &&
    now - managedTeamsCache.loadedAt < MANAGED_TEAMS_CACHE_MS
  ) {
    return managedTeamsCache.value;
  }

  const [baseRows, bundle] = await Promise.all([loadManagedTeamsBaseRows(), loadManagedTeamsActivityBundle()]);
  const value = buildManagedTeams(baseRows, bundle);
  managedTeamsCache = { value, loadedAt: now };
  return value;
}
