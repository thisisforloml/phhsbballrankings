import { AgeGroup, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "@/lib/ratings/formula-constants";

export { FORMULA_V1_VERSION_NUMBER } from "@/lib/ratings/formula-constants";

export type CumulativeGpsRow = {
  playerId: string;
  ageGroup: AgeGroup;
  gpsCount: number;
  avgFinalScore: number;
};

export type CumulativePlayerRatingTarget = {
  playerId: string;
  ageGroup: AgeGroup;
  observedRating: number;
  adjustedRating: number;
  verifiedGameCount: number;
  starRating: number;
};

export function starFromAdjustedRating(value: number) {
  if (value >= 90) return 5;
  if (value >= 80) return 4;
  if (value >= 70) return 3;
  if (value >= 60) return 2;
  return 1;
}

export function roundRating(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function buildCumulativePlayerRatingTarget(row: CumulativeGpsRow): CumulativePlayerRatingTarget {
  const observedRating = roundRating(row.avgFinalScore);
  return {
    playerId: row.playerId,
    ageGroup: row.ageGroup,
    observedRating,
    adjustedRating: observedRating,
    verifiedGameCount: row.gpsCount,
    starRating: starFromAdjustedRating(observedRating)
  };
}

type LoadCumulativeGpsOptions = {
  ageGroup?: AgeGroup;
  playerIds?: string[];
};

export async function loadCumulativeFormulaV1Gps(options: LoadCumulativeGpsOptions = {}) {
  const { ageGroup, playerIds } = options;
  const filters: Prisma.Sql[] = [
    Prisma.sql`gps."deletedAt" IS NULL`,
    Prisma.sql`g."deletedAt" IS NULL`,
    Prisma.sql`s."deletedAt" IS NULL`,
    Prisma.sql`l."deletedAt" IS NULL`,
    Prisma.sql`p."deletedAt" IS NULL`,
    Prisma.sql`fv."versionNumber" = ${FORMULA_V1_VERSION_NUMBER}`,
    Prisma.sql`gps."finalPerformanceScore" IS NOT NULL`
  ];

  if (ageGroup) {
    filters.push(Prisma.sql`l."ageGroup" = CAST(${ageGroup} AS "AgeGroup")`);
  }
  if (playerIds?.length) {
    filters.push(
      Prisma.sql`gps."playerId" IN (${Prisma.join(playerIds.map((id) => Prisma.sql`CAST(${id} AS uuid)`))})`
    );
  }

  const whereClause = Prisma.join(filters, " AND ");

  return prisma.$queryRaw<CumulativeGpsRow[]>`
    SELECT
      gps."playerId" AS "playerId",
      l."ageGroup" AS "ageGroup",
      COUNT(*)::int AS "gpsCount",
      AVG(gps."finalPerformanceScore")::float AS "avgFinalScore"
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId"
    JOIN seasons s ON s.id = g."seasonId"
    JOIN leagues l ON l.id = s."leagueId"
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    JOIN players p ON p.id = gps."playerId"
    WHERE ${whereClause}
    GROUP BY gps."playerId", l."ageGroup"
  `;
}

export async function upsertCumulativePlayerRatings(
  targets: CumulativePlayerRatingTarget[],
  options: {
    computedAt?: Date;
    formulaVersionId: string;
    policyVersionId?: string;
  }
) {
  const computedAt = options.computedAt ?? new Date();
  const policyVersionId = options.policyVersionId ?? FORMULA_V1_POLICY_ID;
  let created = 0;
  let updated = 0;

  for (const rating of targets) {
    const existing = await prisma.playerRating.findUnique({
      where: {
        playerId_ageGroup_formulaVersionId_policyVersionId: {
          playerId: rating.playerId,
          ageGroup: rating.ageGroup,
          formulaVersionId: options.formulaVersionId,
          policyVersionId
        }
      },
      select: { id: true }
    });

    await prisma.playerRating.upsert({
      where: {
        playerId_ageGroup_formulaVersionId_policyVersionId: {
          playerId: rating.playerId,
          ageGroup: rating.ageGroup,
          formulaVersionId: options.formulaVersionId,
          policyVersionId
        }
      },
      update: {
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating,
        computedAt
      },
      create: {
        playerId: rating.playerId,
        ageGroup: rating.ageGroup,
        formulaVersionId: options.formulaVersionId,
        policyVersionId,
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating,
        computedAt
      }
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated, totalProcessed: targets.length };
}
