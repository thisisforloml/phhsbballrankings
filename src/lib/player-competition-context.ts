import { isPybcCompetitionName,normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import type { CompetitionParticipationSummary, PrimaryCompetition } from "@/lib/player-competition-display";
import { prisma } from "@/lib/prisma";

export type { CompetitionParticipationEntry, CompetitionParticipationSummary, PrimaryCompetition } from "@/lib/player-competition-display";
export { formatPrimaryCompetitionLine } from "@/lib/player-competition-display";

type LeagueBucket = {
  leagueId: string;
  leagueName: string;
  seasonName: string;
  tier: number;
  verifiedGames: number;
  latestGameDate: Date;
};

export type GameStatWithLeague = {
  game: {
    gameDate: Date;
    season: {
      name: string;
      league: {
        id: string;
        name: string;
        tier: number;
      };
    };
  };
};

/** Fields needed for national ranking boards (affiliation + competition badges). */
export const rankingBoardGameStatSelect = {
  playerId: true,
  game: {
    select: {
      gameDate: true,
      season: {
        select: {
          name: true,
          league: { select: { id: true, name: true, tier: true } },
        },
      },
    },
  },
  team: {
    select: {
      name: true,
      program: { select: { fullName: true, abbreviation: true, type: true } },
    },
  },
} as const;

export type RankingBoardGameStat = {
  playerId: string;
  game: GameStatWithLeague["game"];
  team: {
    name: string;
    program: {
      fullName: string;
      abbreviation: string | null;
      type: import("@prisma/client").ProgramType;
    } | null;
  };
};

const rankingBoardGameStatWhere = {
  deletedAt: null,
  game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
} as const;

const AFFILIATION_GAME_STAT_LIMIT = 40;

export function groupRankingBoardGameStatsByPlayerId(
  stats: RankingBoardGameStat[]
): Map<string, RankingBoardGameStat[]> {
  const grouped = new Map<string, RankingBoardGameStat[]>();
  for (const stat of stats) {
    const bucket = grouped.get(stat.playerId) ?? [];
    bucket.push(stat);
    grouped.set(stat.playerId, bucket);
  }
  return grouped;
}

/** Match prior nested `gameStats` take:40 order for affiliation labels. */
export function affiliationGameStatsFromBoardStats(stats: RankingBoardGameStat[]) {
  return [...stats]
    .sort((left, right) => right.game.gameDate.getTime() - left.game.gameDate.getTime())
    .slice(0, AFFILIATION_GAME_STAT_LIMIT)
    .map((stat) => ({
      team: stat.team,
      game: { gameDate: stat.game.gameDate },
    }));
}

export function buildParticipationMapFromBoardStats(
  playerIds: string[],
  statsByPlayer: Map<string, RankingBoardGameStat[]>
): Map<string, CompetitionParticipationSummary> {
  const result = new Map<string, CompetitionParticipationSummary>();
  for (const playerId of playerIds) {
    const stats = statsByPlayer.get(playerId) ?? [];
    result.set(
      playerId,
      buildCompetitionParticipationFromStats(stats.map((stat) => ({ game: stat.game })))
    );
  }
  return result;
}

export async function loadRankingBoardGameStatsByPlayerIds(
  playerIds: string[]
): Promise<Map<string, RankingBoardGameStat[]>> {
  if (!playerIds.length) return new Map();

  const stats = await prisma.gameStat.findMany({
    where: {
      playerId: { in: playerIds },
      ...rankingBoardGameStatWhere,
    },
    select: rankingBoardGameStatSelect,
  });

  return groupRankingBoardGameStatsByPlayerId(stats);
}

export function shortenCompetitionName(name: string): string {
  const normalized = normalizeCompetitionDisplayName(name);
  return normalized
    .replace(/\bSeason\s+(\d+)\b/gi, "S$1")
    .replace(/\s+Basketball\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function leagueGroupKey(leagueId: string, seasonId: string, leagueName: string): string {
  if (isPybcCompetitionName(leagueName)) return `pybc:${normalizeCompetitionDisplayName(leagueName)}`;
  return `${leagueId}:${seasonId}`;
}

export function buildCompetitionParticipationFromStats(
  stats: GameStatWithLeague[]
): CompetitionParticipationSummary {
  const buckets = new Map<string, LeagueBucket>();

  for (const stat of stats) {
    const league = stat.game.season.league;
    const seasonName = stat.game.season.name;
    const leagueName = normalizeCompetitionDisplayName(league.name);
    const key = leagueGroupKey(league.id, seasonName, league.name);
    const existing = buckets.get(key) ?? {
      leagueId: league.id,
      leagueName,
      seasonName: isPybcCompetitionName(league.name) ? "Full Competition" : seasonName,
      tier: league.tier,
      verifiedGames: 0,
      latestGameDate: stat.game.gameDate
    };

    existing.verifiedGames += 1;
    existing.tier = Math.min(existing.tier, league.tier);
    if (stat.game.gameDate > existing.latestGameDate) {
      existing.latestGameDate = stat.game.gameDate;
    }
    buckets.set(key, existing);
  }

  const competitions = [...buckets.values()]
    .sort(
      (left, right) =>
        right.verifiedGames - left.verifiedGames ||
        left.tier - right.tier ||
        right.latestGameDate.getTime() - left.latestGameDate.getTime()
    )
    .map((bucket) => ({
      leagueName: bucket.leagueName,
      seasonName: bucket.seasonName,
      verifiedGames: bucket.verifiedGames
    }));

  const primaryBucket = [...buckets.values()].sort(
    (left, right) =>
      right.verifiedGames - left.verifiedGames ||
      left.tier - right.tier ||
      right.latestGameDate.getTime() - left.latestGameDate.getTime()
  )[0];

  const primary: PrimaryCompetition | null = primaryBucket
    ? {
        leagueName: primaryBucket.leagueName,
        shortName: shortenCompetitionName(primaryBucket.leagueName),
        seasonName: primaryBucket.seasonName,
        verifiedGameCount: primaryBucket.verifiedGames,
        tier: primaryBucket.tier
      }
    : null;

  const totalVerifiedGames = competitions.reduce((sum, entry) => sum + entry.verifiedGames, 0);

  return {
    primary,
    totalVerifiedGames,
    competitionCount: competitions.length,
    competitions
  };
}

export async function loadCompetitionParticipationByPlayerIds(
  playerIds: string[]
): Promise<Map<string, CompetitionParticipationSummary>> {
  const statsByPlayer = await loadRankingBoardGameStatsByPlayerIds(playerIds);
  return buildParticipationMapFromBoardStats(playerIds, statsByPlayer);
}

export function primaryCompetitionFromSummary(
  summary: CompetitionParticipationSummary
): PrimaryCompetition | null {
  return summary.primary;
}
