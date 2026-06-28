import { normalizeCompetitionDisplayName, isPybcCompetitionName } from "@/lib/competition-naming";
import { prisma } from "@/lib/prisma";

export type PrimaryCompetition = {
  leagueName: string;
  shortName: string;
  seasonName: string;
  verifiedGameCount: number;
  /** Internal sort key only — not shown in P0 UI */
  tier: number;
};

export type CompetitionParticipationEntry = {
  leagueName: string;
  seasonName: string;
  verifiedGames: number;
};

export type CompetitionParticipationSummary = {
  primary: PrimaryCompetition | null;
  totalVerifiedGames: number;
  competitionCount: number;
  competitions: CompetitionParticipationEntry[];
};

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

export function shortenCompetitionName(name: string): string {
  const normalized = normalizeCompetitionDisplayName(name);
  return normalized
    .replace(/\bSeason\s+(\d+)\b/gi, "S$1")
    .replace(/\s+Basketball\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPrimaryCompetitionLine(primary: PrimaryCompetition): string {
  const gamesLabel = primary.verifiedGameCount === 1 ? "game" : "games";
  return `${primary.shortName} · ${primary.verifiedGameCount} ${gamesLabel}`;
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
  const result = new Map<string, CompetitionParticipationSummary>();
  if (!playerIds.length) return result;

  const stats = await prisma.gameStat.findMany({
    where: {
      playerId: { in: playerIds },
      deletedAt: null,
      game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }
    },
    select: {
      playerId: true,
      game: {
        select: {
          gameDate: true,
          season: {
            select: {
              name: true,
              league: { select: { id: true, name: true, tier: true } }
            }
          }
        }
      }
    }
  });

  const grouped = new Map<string, GameStatWithLeague[]>();
  for (const stat of stats) {
    const bucket = grouped.get(stat.playerId) ?? [];
    bucket.push({ game: stat.game });
    grouped.set(stat.playerId, bucket);
  }

  for (const playerId of playerIds) {
    result.set(playerId, buildCompetitionParticipationFromStats(grouped.get(playerId) ?? []));
  }

  return result;
}

export function primaryCompetitionFromSummary(
  summary: CompetitionParticipationSummary
): PrimaryCompetition | null {
  return summary.primary;
}
