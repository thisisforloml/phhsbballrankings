import "server-only";

import { AgeGroup } from "@prisma/client";

import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { prisma } from "@/lib/prisma";
import type {
  TeamStandingRow,
  TeamStandingsAgeGroup,
  TeamStandingsData,
  TeamStandingsGender,
} from "@/lib/team-rankings-types";
import { getTeamDisplayName } from "@/lib/uaap-school-display";

export type {
  TeamStandingRow,
  TeamStandingsAgeGroup,
  TeamStandingsData,
  TeamStandingsFilters,
  TeamStandingsGender,
} from "@/lib/team-rankings-types";

type TeamBucket = Omit<TeamStandingRow, "pointDifferential" | "winPercentage" | "rank">;

function publicTeamDisplayName(internalName: string) {
  return getTeamDisplayName(internalName);
}

function competitionScope(game: {
  seasonId: string;
  season: {
    name: string;
    seasonYear: number | null;
    leagueId: string;
    league: { name: string };
  };
}) {
  const normalizedLeagueName = normalizeCompetitionDisplayName(game.season.league.name);
  if (isPybcCompetitionName(normalizedLeagueName)) {
    return {
      leagueId: "competition:pybc-15u",
      leagueName: normalizedLeagueName,
      seasonId: "competition:pybc-15u:full",
      seasonName: "Full Competition",
      seasonYear: game.season.seasonYear
    };
  }

  return {
    leagueId: game.season.leagueId,
    leagueName: game.season.league.name,
    seasonId: game.seasonId,
    seasonName: game.season.name,
    seasonYear: game.season.seasonYear
  };
}

function inferGender(...values: Array<string | null | undefined>): TeamStandingsGender {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  return text.includes("girls") ? "Girls" : "Boys";
}

function toPublicAgeGroup(value: AgeGroup): TeamStandingsAgeGroup {
  return value;
}

function sortStandings(left: Omit<TeamStandingRow, "rank">, right: Omit<TeamStandingRow, "rank">) {
  return right.wins - left.wins
    || right.winPercentage - left.winPercentage
    || right.pointDifferential - left.pointDifferential
    || right.pointsFor - left.pointsFor
    || left.displayName.localeCompare(right.displayName);
}

function rankingScopeKey(row: Pick<TeamStandingRow, "leagueId" | "seasonId" | "ageGroup" | "gender">) {
  return `${row.leagueId}:${row.seasonId}:${row.ageGroup}:${row.gender}`;
}

function addResult(bucket: TeamBucket, pointsFor: number, pointsAgainst: number) {
  bucket.gamesPlayed += 1;
  bucket.pointsFor += pointsFor;
  bucket.pointsAgainst += pointsAgainst;
  if (pointsFor > pointsAgainst) bucket.wins += 1;
  else bucket.losses += 1;
}

export async function getDynamicTeamStandings(): Promise<TeamStandingsData> {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } }
    },
    orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }]
  });

  const buckets = new Map<string, TeamBucket>();

  function ensureTeam(game: typeof games[number], side: "home" | "away") {
    const sourceTeam = side === "home" ? game.homeTeam : game.awayTeam;
    const gender = inferGender(game.season.league.name, sourceTeam.name);
    const ageGroup = toPublicAgeGroup(game.season.league.ageGroup);
    const scope = competitionScope(game);
    const identityKey = sourceTeam.programId ?? sourceTeam.id;
    const key = `${scope.leagueId}:${scope.seasonId}:${gender}:${identityKey}`;
    const existing = buckets.get(key);
    if (existing) return existing;

    const next: TeamBucket = {
      id: key,
      teamId: sourceTeam.id,
      programId: sourceTeam.programId,
      internalTeamName: sourceTeam.name,
      displayName: publicTeamDisplayName(sourceTeam.name),
      city: sourceTeam.city ?? "Not listed",
      region: sourceTeam.region ?? "Not listed",
      ageGroup,
      gender,
      leagueId: scope.leagueId,
      leagueName: scope.leagueName,
      seasonId: scope.seasonId,
      seasonName: scope.seasonName,
      seasonYear: scope.seasonYear,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0
    };
    buckets.set(key, next);
    return next;
  }

  for (const game of games) {
    const home = ensureTeam(game, "home");
    const away = ensureTeam(game, "away");
    addResult(home, game.homeScore, game.awayScore);
    addResult(away, game.awayScore, game.homeScore);
  }

  const unranked = [...buckets.values()].map((bucket) => ({
    ...bucket,
    pointDifferential: bucket.pointsFor - bucket.pointsAgainst,
    winPercentage: bucket.gamesPlayed ? Number((bucket.wins / bucket.gamesPlayed).toFixed(3)) : 0
  }));

  const byScope = new Map<string, Array<Omit<TeamStandingRow, "rank">>>();
  for (const row of unranked) {
    const key = rankingScopeKey(row);
    byScope.set(key, [...(byScope.get(key) ?? []), row]);
  }

  const rows = [...byScope.values()].flatMap((scopeRows) => scopeRows
    .sort(sortStandings)
    .map((row, index) => ({ ...row, rank: index + 1 })))
    .sort((left, right) => left.leagueName.localeCompare(right.leagueName)
      || (right.seasonYear ?? 0) - (left.seasonYear ?? 0)
      || left.gender.localeCompare(right.gender)
      || left.ageGroup.localeCompare(right.ageGroup)
      || left.rank - right.rank);

  const leagues = Array.from(new Map(rows.map((row) => [row.leagueId, { id: row.leagueId, name: row.leagueName }])).values())
    .sort((left, right) => left.name.localeCompare(right.name));
  const seasons = Array.from(new Map(rows.map((row) => [row.seasonId, { id: row.seasonId, name: row.seasonName, leagueId: row.leagueId, leagueName: row.leagueName, seasonYear: row.seasonYear }])).values())
    .sort((left, right) => (right.seasonYear ?? 0) - (left.seasonYear ?? 0) || left.name.localeCompare(right.name));
  const preferredDefault = rows.find((row) => row.ageGroup === "U16" && row.gender === "Boys")
    ?? rows.find((row) => row.ageGroup === "U19" && row.gender === "Boys")
    ?? rows[0]
    ?? null;

  const lastUpdated = games.length
    ? new Date(Math.max(...games.map((game) => new Date(game.gameDate).getTime()))).toISOString()
    : null;

  return {
    rows,
    lastUpdated,
    filters: {
      ageGroups: Array.from(new Set(rows.map((row) => row.ageGroup))).sort() as TeamStandingsAgeGroup[],
      genders: Array.from(new Set(rows.map((row) => row.gender))).sort() as TeamStandingsGender[],
      leagues,
      seasons,
      default: preferredDefault ? {
        ageGroup: preferredDefault.ageGroup,
        gender: preferredDefault.gender,
        leagueId: preferredDefault.leagueId,
        seasonId: preferredDefault.seasonId
      } : null
    }
  };
}

export async function getOfficialTeamCompetitionCounts() {
  const games = await prisma.game.findMany({
    where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
    select: { homeTeamId: true, awayTeamId: true, season: { select: { leagueId: true } } }
  });

  return {
    gamesLogged: games.length,
    verifiedLeagues: new Set(games.map((game) => game.season.leagueId)).size,
    teamsLogged: new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId])).size
  };
}

export function getLeagueStandingsRows(
  data: TeamStandingsData,
  league: { name: string; ageGroup: TeamStandingsAgeGroup }
): Array<TeamStandingRow & { visibleRank: number }> {
  const gender: TeamStandingsGender = league.name.toLowerCase().includes("girls") ? "Girls" : "Boys";
  const normalizedTarget = league.name.trim();

  const candidates = data.rows.filter((row) => {
    const normalizedRow = normalizeCompetitionDisplayName(row.leagueName) || row.leagueName;
    return (
      row.ageGroup === league.ageGroup &&
      row.gender === gender &&
      (normalizedRow === normalizedTarget || row.leagueName === normalizedTarget)
    );
  });

  const byTeam = new Map<string, TeamStandingRow>();
  for (const row of candidates) {
    const key = row.programId ?? row.teamId;
    const existing = byTeam.get(key);
    if (!existing || row.gamesPlayed > existing.gamesPlayed) {
      byTeam.set(key, row);
    }
  }

  return Array.from(byTeam.values())
    .sort((left, right) => sortStandings(left, right))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      visibleRank: index + 1,
    }));
}
