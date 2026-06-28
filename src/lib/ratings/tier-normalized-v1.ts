import { AgeGroup, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildCumulativePlayerRatingTarget,
  roundRating,
  starFromAdjustedRating,
  type CumulativePlayerRatingTarget,
  upsertCumulativePlayerRatings
} from "@/lib/player-rating-cumulative";
import {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_POLICY_ID,
  FORMULA_V1_VERSION_NUMBER
} from "@/lib/ratings/formula-constants";
import {
  findV1LimboCases,
  RATING_BASIS_PROJECTED_V1,
  type PlayerRatingBasis
} from "@/lib/ratings/home-board-v1";

export { FORMULA_TIER_NORMALIZED_V1_POLICY_ID };

/** Governance convention: tier 1 is strongest; lower tiers are discounted. */
export const TIER_NORMALIZED_SOFT_WEIGHTS: Record<1 | 2 | 3 | 4, number> = {
  1: 1.0,
  2: 0.97,
  3: 0.93,
  4: 0.9
};

export type TierNormalizedGpsGame = {
  playerId: string;
  ageGroup: AgeGroup;
  leagueTier: number;
  finalScore: number;
};

export type TierNormalizedRatingTarget = CumulativePlayerRatingTarget & {
  displayName?: string;
};

function tierKey(tier: number): 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(1, Math.round(tier))) as 1 | 2 | 3 | 4;
}

export function tierNormalizedGameScore(
  finalScore: number,
  leagueTier: number,
  weights: Record<1 | 2 | 3 | 4, number> = TIER_NORMALIZED_SOFT_WEIGHTS
): number {
  return Math.min(100, finalScore * weights[tierKey(leagueTier)]);
}

export function aggregateTierNormalizedRating(
  games: TierNormalizedGpsGame[],
  weights: Record<1 | 2 | 3 | 4, number> = TIER_NORMALIZED_SOFT_WEIGHTS
): { observedRating: number; verifiedGameCount: number } | null {
  if (!games.length) return null;
  const scores = games.map((game) => tierNormalizedGameScore(game.finalScore, game.leagueTier, weights));
  const observedRating = roundRating(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  return { observedRating, verifiedGameCount: games.length };
}

type LoadOptions = {
  ageGroup?: AgeGroup;
  playerIds?: string[];
};

export async function loadTierNormalizedGpsGames(options: LoadOptions = {}): Promise<TierNormalizedGpsGame[]> {
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

  return prisma.$queryRaw<TierNormalizedGpsGame[]>`
    SELECT
      gps."playerId" AS "playerId",
      l."ageGroup" AS "ageGroup",
      l.tier AS "leagueTier",
      gps."finalPerformanceScore"::float AS "finalScore"
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId"
    JOIN seasons s ON s.id = g."seasonId"
    JOIN leagues l ON l.id = s."leagueId"
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    JOIN players p ON p.id = gps."playerId"
    WHERE ${whereClause}
  `;
}

export function buildTierNormalizedRatingTargets(
  games: TierNormalizedGpsGame[],
  weights: Record<1 | 2 | 3 | 4, number> = TIER_NORMALIZED_SOFT_WEIGHTS
): TierNormalizedRatingTarget[] {
  const grouped = new Map<string, TierNormalizedGpsGame[]>();

  for (const game of games) {
    const key = `${game.playerId}|${game.ageGroup}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(game);
    grouped.set(key, bucket);
  }

  const targets: TierNormalizedRatingTarget[] = [];
  for (const [key, bucket] of grouped) {
    const [playerId, ageGroup] = key.split("|") as [string, AgeGroup];
    const aggregate = aggregateTierNormalizedRating(bucket, weights);
    if (!aggregate) continue;
    targets.push(
      buildCumulativePlayerRatingTarget({
        playerId,
        ageGroup,
        gpsCount: aggregate.verifiedGameCount,
        avgFinalScore: aggregate.observedRating
      })
    );
  }

  return targets.sort((left, right) => right.adjustedRating - left.adjustedRating);
}

export async function resolveFormulaV1VersionId(): Promise<string> {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 version row not found.");
  return formulaVersion.id;
}

export type TierNormalizedRecomputeResult = {
  policyVersionId: string;
  formulaVersionId: string;
  targets: TierNormalizedRatingTarget[];
  created: number | null;
  updated: number | null;
  skippedProductionParity: number;
};

export async function recomputeTierNormalizedV1Ratings(options: {
  execute?: boolean;
  weights?: Record<1 | 2 | 3 | 4, number>;
} = {}): Promise<TierNormalizedRecomputeResult> {
  const formulaVersionId = await resolveFormulaV1VersionId();
  const games = await loadTierNormalizedGpsGames();
  const targets = buildTierNormalizedRatingTargets(games, options.weights);

  const productionRows = await prisma.playerRating.findMany({
    where: {
      formulaVersionId,
      policyVersionId: FORMULA_V1_POLICY_ID
    },
    select: {
      playerId: true,
      ageGroup: true,
      adjustedRating: true,
      verifiedGameCount: true
    }
  });
  const productionMap = new Map(
    productionRows.map((row) => [`${row.playerId}|${row.ageGroup}`, row])
  );

  let skippedProductionParity = 0;
  for (const target of targets) {
    const production = productionMap.get(`${target.playerId}|${target.ageGroup}`);
    if (
      production &&
      production.verifiedGameCount === target.verifiedGameCount &&
      Math.abs(Number(production.adjustedRating) - target.adjustedRating) < 0.01
    ) {
      skippedProductionParity += 1;
    }
  }

  if (!options.execute) {
    return {
      policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
      formulaVersionId,
      targets,
      created: null,
      updated: null,
      skippedProductionParity
    };
  }

  const writeResult = await upsertCumulativePlayerRatings(targets, {
    formulaVersionId,
    policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID
  });

  return {
    policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
    formulaVersionId,
    targets,
    created: writeResult.created,
    updated: writeResult.updated,
    skippedProductionParity
  };
}

export function starBand(rating: number) {
  return starFromAdjustedRating(rating);
}

export type ProjectHomeBoardTierNormalizedResult = {
  limboCount: number;
  created: number;
  updated: number;
  skippedExisting: number;
  targets: Array<CumulativePlayerRatingTarget & { ratingBasis: PlayerRatingBasis; displayName: string }>;
};

export async function projectHomeBoardTierNormalizedRatings(
  options: { execute?: boolean } = {}
): Promise<ProjectHomeBoardTierNormalizedResult> {
  const limboCases = await findV1LimboCases(new Date(), FORMULA_TIER_NORMALIZED_V1_POLICY_ID);
  const formulaVersionId = await resolveFormulaV1VersionId();
  const allGames = await loadTierNormalizedGpsGames();

  let created = 0;
  let updated = 0;
  let skippedExisting = 0;
  const targets: ProjectHomeBoardTierNormalizedResult["targets"] = [];

  for (const limbo of limboCases) {
    const competitionGames = allGames.filter(
      (game) => game.playerId === limbo.playerId && game.ageGroup === limbo.competitionAgeGroup
    );
    const aggregate = aggregateTierNormalizedRating(competitionGames);
    if (!aggregate) continue;

    const target = buildCumulativePlayerRatingTarget({
      playerId: limbo.playerId,
      ageGroup: limbo.homeBracket,
      gpsCount: aggregate.verifiedGameCount,
      avgFinalScore: aggregate.observedRating
    });

    targets.push({
      ...target,
      ratingBasis: RATING_BASIS_PROJECTED_V1,
      displayName: limbo.displayName
    });

    const existing = await prisma.playerRating.findUnique({
      where: {
        playerId_ageGroup_formulaVersionId_policyVersionId: {
          playerId: limbo.playerId,
          ageGroup: limbo.homeBracket,
          formulaVersionId,
          policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID
        }
      },
      select: { id: true, adjustedRating: true, verifiedGameCount: true }
    });

    if (
      existing &&
      Math.abs(Number(existing.adjustedRating) - target.adjustedRating) < 0.01 &&
      existing.verifiedGameCount === target.verifiedGameCount
    ) {
      skippedExisting += 1;
      continue;
    }

    if (!options.execute) continue;

    if (existing) {
      await prisma.playerRating.update({
        where: { id: existing.id },
        data: {
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          ratingBasis: RATING_BASIS_PROJECTED_V1
        }
      });
      updated += 1;
    } else {
      await prisma.playerRating.create({
        data: {
          playerId: target.playerId,
          ageGroup: target.ageGroup,
          formulaVersionId,
          policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          ratingBasis: RATING_BASIS_PROJECTED_V1
        }
      });
      created += 1;
    }
  }

  return {
    limboCount: limboCases.length,
    created: options.execute ? created : 0,
    updated: options.execute ? updated : 0,
    skippedExisting,
    targets
  };
}
