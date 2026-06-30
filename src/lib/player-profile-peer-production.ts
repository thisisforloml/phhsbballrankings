import "server-only";

import { AgeGroup, Prisma } from "@prisma/client";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import { boxEfficiencyFromStat } from "@/lib/player-profile-build";
import { prisma } from "./prisma";

export type PeerProduction = {
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tov: number;
  mpg: number | null;
  boxEfficiency: number;
  trueShootingPct: number | null;
};

type PeerProductionRow = {
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tov: number;
  mpg: number | null;
  boxEfficiency: number;
  trueShootingPct: number | null;
};

function mapPeerRow(row: PeerProductionRow): PeerProduction {
  return {
    games: row.games,
    ppg: row.ppg,
    rpg: row.rpg,
    apg: row.apg,
    spg: row.spg,
    bpg: row.bpg,
    tov: row.tov,
    mpg: row.mpg,
    boxEfficiency: row.boxEfficiency,
    trueShootingPct: row.trueShootingPct,
  };
}

/**
 * Legacy peer loader — loads full age-group ratings with nested GameStat rows.
 * Kept for parity benchmarks only; production uses {@link loadPeerProduction}.
 */
export async function loadPeerProductionLegacy(
  ageGroup: AgeGroup,
  gender: "BOYS" | "GIRLS"
): Promise<PeerProduction[]> {
  const policyVersionId = getActivePolicyVersionId();
  const ratings = await prisma.playerRating.findMany({
    where: {
      policyVersionId,
      ageGroup,
      player: {
        deletedAt: null,
        gender,
      },
    },
    select: {
      player: {
        select: {
          gameStats: {
            where: {
              deletedAt: null,
              performanceScores: {
                some: {
                  deletedAt: null,
                  formulaVersion: { versionNumber: 1 },
                },
              },
            },
            select: {
              points: true,
              rebounds: true,
              assists: true,
              steals: true,
              blocks: true,
              turnovers: true,
              minutes: true,
              fieldGoalsAttempt: true,
              freeThrowsAttempt: true,
            },
          },
        },
      },
    },
  });

  return ratings
    .map((rating) => {
      const stats = rating.player.gameStats;
      if (stats.length < 3) return null;
      const games = stats.length;
      const minutes = stats
        .map((stat) => (stat.minutes ? stat.minutes.toNumber() : null))
        .filter((value): value is number => value !== null);
      const tsValues = stats
        .map((stat) => {
          const fga = stat.fieldGoalsAttempt ?? 0;
          const fta = stat.freeThrowsAttempt ?? 0;
          if (!fga && !fta) return null;
          const denominator = 2 * (fga + 0.44 * fta);
          return denominator > 0 ? (stat.points / denominator) * 100 : null;
        })
        .filter((value): value is number => value !== null);

      return {
        games,
        ppg: stats.reduce((sum, stat) => sum + stat.points, 0) / games,
        rpg: stats.reduce((sum, stat) => sum + stat.rebounds, 0) / games,
        apg: stats.reduce((sum, stat) => sum + stat.assists, 0) / games,
        spg: stats.reduce((sum, stat) => sum + (stat.steals ?? 0), 0) / games,
        bpg: stats.reduce((sum, stat) => sum + (stat.blocks ?? 0), 0) / games,
        tov: stats.reduce((sum, stat) => sum + (stat.turnovers ?? 0), 0) / games,
        mpg: minutes.length ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length : null,
        boxEfficiency: stats.reduce((sum, stat) => sum + boxEfficiencyFromStat(stat), 0) / games,
        trueShootingPct: tsValues.length ? tsValues.reduce((sum, value) => sum + value, 0) / tsValues.length : null,
      };
    })
    .filter((item): item is PeerProduction => item !== null);
}

/**
 * Aggregates peer production in SQL — one row per qualifying player instead of
 * thousands of nested GameStat rows.
 */
export async function loadPeerProduction(ageGroup: AgeGroup, gender: "BOYS" | "GIRLS"): Promise<PeerProduction[]> {
  const policyVersionId = getActivePolicyVersionId();

  const rows = await prisma.$queryRaw<PeerProductionRow[]>`
    SELECT
      COUNT(*)::int AS "games",
      AVG(gs.points)::float AS "ppg",
      AVG(gs.rebounds)::float AS "rpg",
      AVG(gs.assists)::float AS "apg",
      AVG(COALESCE(gs.steals, 0))::float AS "spg",
      AVG(COALESCE(gs.blocks, 0))::float AS "bpg",
      AVG(COALESCE(gs.turnovers, 0))::float AS "tov",
      AVG(gs.minutes::float) FILTER (WHERE gs.minutes IS NOT NULL) AS "mpg",
      AVG(
        gs.points
        + gs.rebounds
        + gs.assists
        + COALESCE(gs.steals, 0)
        + COALESCE(gs.blocks, 0)
        - COALESCE(gs.turnovers, 0)
      )::float AS "boxEfficiency",
      AVG(
        CASE
          WHEN COALESCE(gs."fieldGoalsAttempt", 0) = 0 AND COALESCE(gs."freeThrowsAttempt", 0) = 0 THEN NULL
          WHEN (2.0 * (COALESCE(gs."fieldGoalsAttempt", 0) + 0.44 * COALESCE(gs."freeThrowsAttempt", 0))) <= 0 THEN NULL
          ELSE (gs.points::float / (2.0 * (COALESCE(gs."fieldGoalsAttempt", 0) + 0.44 * COALESCE(gs."freeThrowsAttempt", 0)))) * 100.0
        END
      ) FILTER (
        WHERE COALESCE(gs."fieldGoalsAttempt", 0) > 0 OR COALESCE(gs."freeThrowsAttempt", 0) > 0
      ) AS "trueShootingPct"
    FROM game_stats gs
    INNER JOIN players p ON p.id = gs."playerId"
    INNER JOIN player_ratings pr ON pr."playerId" = p.id
    WHERE pr."policyVersionId" = ${policyVersionId}
      AND pr."ageGroup" = ${ageGroup}::${Prisma.raw('"AgeGroup"')}
      AND p."deletedAt" IS NULL
      AND p.gender = ${gender}::${Prisma.raw('"PlayerGender"')}
      AND gs."deletedAt" IS NULL
      AND EXISTS (
        SELECT 1
        FROM game_performance_scores gps
        INNER JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
        WHERE gps."gameStatId" = gs.id
          AND gps."deletedAt" IS NULL
          AND fv."versionNumber" = 1
      )
    GROUP BY gs."playerId"
    HAVING COUNT(*) >= 3
  `;

  return rows.map(mapPeerRow);
}
