import { AgeGroup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildCumulativePlayerRatingTarget,
  type CumulativePlayerRatingTarget
} from "@/lib/player-rating-cumulative";
import { FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "@/lib/ratings/formula-constants";
import { getCurrentRankingAgeBracket, type RankingAgeBracket } from "@/lib/ranking-eligibility";

export const RATING_BASIS_DIRECT = "DIRECT" as const;
export const RATING_BASIS_PROJECTED_V1 = "PROJECTED_V1" as const;
export type PlayerRatingBasis = typeof RATING_BASIS_DIRECT | typeof RATING_BASIS_PROJECTED_V1;

const BRACKET_ORDER: Record<"U13" | "U16" | "U19", number> = { U13: 1, U16: 2, U19: 3 };

export type V1LimboCase = {
  playerId: string;
  displayName: string;
  gender: string;
  homeBracket: "U13" | "U16" | "U19";
  competitionAgeGroup: AgeGroup;
  gpsCount: number;
  avgCompetitionScore: number;
  competitionRating: number;
  competitionGames: number;
};

export function isPlayingUp(
  homeBracket: RankingAgeBracket | null,
  competitionAgeGroup: AgeGroup
): homeBracket is "U13" | "U16" | "U19" {
  if (!homeBracket || homeBracket === "OUT_OF_RANGE") return false;
  return BRACKET_ORDER[homeBracket] < BRACKET_ORDER[competitionAgeGroup];
}

export function buildProjectedV1HomeTarget(input: {
  playerId: string;
  homeBracket: AgeGroup;
  gpsCount: number;
  avgFinalScore: number;
}): CumulativePlayerRatingTarget {
  const target = buildCumulativePlayerRatingTarget({
    playerId: input.playerId,
    ageGroup: input.homeBracket,
    gpsCount: input.gpsCount,
    avgFinalScore: input.avgFinalScore
  });
  return target;
}

export async function findV1LimboCases(
  asOfDate: Date = new Date(),
  policyVersionId: string = FORMULA_V1_POLICY_ID
): Promise<V1LimboCase[]> {
  const gpsRows = await prisma.$queryRaw<
    Array<{
      player_id: string;
      display_name: string;
      gender: string;
      birth_date: Date | null;
      class_year_override: number | null;
      competition_age_group: AgeGroup;
      gps_count: number;
      avg_score: number;
    }>
  >`
    SELECT
      p.id AS player_id,
      p."displayName" AS display_name,
      p.gender::text AS gender,
      p."birthDate" AS birth_date,
      p."classYearOverride" AS class_year_override,
      l."ageGroup" AS competition_age_group,
      COUNT(*)::int AS gps_count,
      AVG(gps."finalPerformanceScore")::float AS avg_score
    FROM game_performance_scores gps
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId"
    JOIN leagues l ON l.id = s."leagueId"
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId" AND fv."versionNumber" = ${FORMULA_V1_VERSION_NUMBER}
    WHERE gps."deletedAt" IS NULL AND gps."finalPerformanceScore" IS NOT NULL
    GROUP BY p.id, p."displayName", p.gender, p."birthDate", p."classYearOverride", l."ageGroup"
  `;

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) return [];

  const productionRatings = await prisma.playerRating.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId
    },
    select: {
      playerId: true,
      ageGroup: true,
      adjustedRating: true,
      verifiedGameCount: true
    }
  });

  const ratingMap = new Map(
    productionRatings.map((rating) => [`${rating.playerId}|${rating.ageGroup}`, rating])
  );

  const limboCases: V1LimboCase[] = [];

  for (const row of gpsRows) {
    if (!row.birth_date) continue;

    const homeBracket = getCurrentRankingAgeBracket(
      row.birth_date,
      asOfDate,
      row.class_year_override,
      row.competition_age_group
    );
    if (!isPlayingUp(homeBracket, row.competition_age_group)) continue;

    const homeKey = `${row.player_id}|${homeBracket}`;
    const compKey = `${row.player_id}|${row.competition_age_group}`;
    if (ratingMap.has(homeKey)) continue;

    const compRating = ratingMap.get(compKey);
    if (!compRating) continue;

    limboCases.push({
      playerId: row.player_id,
      displayName: row.display_name,
      gender: row.gender,
      homeBracket,
      competitionAgeGroup: row.competition_age_group,
      gpsCount: row.gps_count,
      avgCompetitionScore: row.avg_score,
      competitionRating: Number(compRating.adjustedRating),
      competitionGames: compRating.verifiedGameCount
    });
  }

  return limboCases.sort((left, right) => right.avgCompetitionScore - left.avgCompetitionScore);
}

export type ProjectHomeBoardV1Result = {
  limboCount: number;
  created: number;
  skippedExisting: number;
  targets: Array<CumulativePlayerRatingTarget & { ratingBasis: PlayerRatingBasis; displayName: string }>;
};

export async function projectHomeBoardV1Ratings(options: { execute?: boolean } = {}): Promise<ProjectHomeBoardV1Result> {
  const limboCases = await findV1LimboCases();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) {
    throw new Error("Formula v1 version record not found.");
  }

  let created = 0;
  let skippedExisting = 0;
  const targets: ProjectHomeBoardV1Result["targets"] = [];

  for (const limbo of limboCases) {
    const existing = await prisma.playerRating.findUnique({
      where: {
        playerId_ageGroup_formulaVersionId_policyVersionId: {
          playerId: limbo.playerId,
          ageGroup: limbo.homeBracket,
          formulaVersionId: formulaVersion.id,
          policyVersionId: FORMULA_V1_POLICY_ID
        }
      },
      select: { id: true, ratingBasis: true }
    });

    const target = buildProjectedV1HomeTarget({
      playerId: limbo.playerId,
      homeBracket: limbo.homeBracket,
      gpsCount: limbo.gpsCount,
      avgFinalScore: limbo.avgCompetitionScore
    });

    targets.push({
      ...target,
      ratingBasis: RATING_BASIS_PROJECTED_V1,
      displayName: limbo.displayName
    });

    if (existing) {
      skippedExisting += 1;
      continue;
    }

    if (options.execute) {
      await prisma.playerRating.create({
        data: {
          playerId: target.playerId,
          ageGroup: target.ageGroup,
          formulaVersionId: formulaVersion.id,
          policyVersionId: FORMULA_V1_POLICY_ID,
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
    skippedExisting,
    targets
  };
}
