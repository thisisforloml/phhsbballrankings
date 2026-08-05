import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildFormulaV33Ecosystem } from "@/lib/ratings/formula-v3/ecosystem";
import { DEFAULT_FORMULA_V3_PARAMS } from "@/lib/ratings/formula-v3/params";
import { FORMULA_V3_POLICY_ID, FORMULA_V3_VERSION_NUMBER } from "@/lib/ratings/formula-v3/types";

const BATCH_SIZE = 100;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function effectiveFieldGoalPct(row: { fieldGoalsMade: number | null; fieldGoalsAttempt: number | null; threeMade: number | null }) {
  return row.fieldGoalsAttempt && row.fieldGoalsMade !== null
    ? (row.fieldGoalsMade + 0.5 * (row.threeMade ?? 0)) / row.fieldGoalsAttempt
    : null;
}

function trueShootingPct(row: { points: number; fieldGoalsAttempt: number | null; freeThrowsAttempt: number | null }) {
  const denominator = 2 * ((row.fieldGoalsAttempt ?? 0) + 0.44 * (row.freeThrowsAttempt ?? 0));
  return denominator > 0 ? row.points / denominator : null;
}

function chunks<T>(rows: T[], size = BATCH_SIZE) {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) output.push(rows.slice(index, index + size));
  return output;
}

export type FormulaV33RecomputeResult = {
  executed: boolean;
  formulaVersionId: string | null;
  policyVersionId: string;
  performanceScores: number;
  playerRatings: number;
  competitionPools: number;
  warnings: string[];
};

export async function recomputeFormulaV33Ratings(options: {
  execute?: boolean;
  evaluationDate?: Date;
} = {}): Promise<FormulaV33RecomputeResult> {
  const evaluationDate = options.evaluationDate ?? new Date();
  const ecosystem = await buildFormulaV33Ecosystem(evaluationDate);
  const version = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V3_VERSION_NUMBER },
    select: { id: true }
  });

  if (!options.execute) {
    return {
      executed: false,
      formulaVersionId: version?.id ?? null,
      policyVersionId: FORMULA_V3_POLICY_ID,
      performanceScores: ecosystem.playerCandidate.games.length,
      playerRatings: ecosystem.playerCandidate.ratings.length,
      competitionPools: ecosystem.competitionProfiles.length,
      warnings: ecosystem.loaded.warnings
    };
  }

  const formulaVersion = version ?? await prisma.formulaVersion.create({
    data: {
      versionNumber: FORMULA_V3_VERSION_NUMBER,
      description: "Formula v3.3: possession-informed performance with continuous competition and roster context",
      isPublic: false,
      effectiveFrom: evaluationDate,
      weights: {
        policyVersionId: FORMULA_V3_POLICY_ID,
        params: DEFAULT_FORMULA_V3_PARAMS,
        advancedBonus: false,
        bayesianShrinkage: false,
        missingAgeFallback: "oldest-observed-age-group"
      } as Prisma.InputJsonValue
    },
    select: { id: true }
  });

  const expectedScoreKeys = new Set(ecosystem.playerCandidate.games.map((row) => row.gameStatId));
  for (const batch of chunks(ecosystem.playerCandidate.games)) {
    await prisma.$transaction(batch.map((row) => prisma.gamePerformanceScore.upsert({
      where: {
        gameStatId_formulaVersionId: {
          gameStatId: row.gameStatId,
          formulaVersionId: formulaVersion.id
        }
      },
      create: {
        gameId: row.gameId,
        gameStatId: row.gameStatId,
        playerId: row.playerId,
        formulaVersionId: formulaVersion.id,
        formulaVersionTag: FORMULA_V3_VERSION_NUMBER,
        productionScore: row.rawGameValue,
        leagueWeight: row.competitionEvidenceWeight,
        opponentFactor: clamp(1 + (row.opponentTeamAdjustment + row.opponentLineupAdjustment) / 100, 0.8, 1.2),
        teamFactor: clamp(1 + (row.ownTeamAdjustment + row.teammateLineupAdjustment) / 100, 0.8, 1.2),
        performanceScore: row.finalGameScore,
        finalPerformanceScore: row.finalGameScore,
        effectiveFieldGoalPct: effectiveFieldGoalPct(row),
        trueShootingPct: trueShootingPct(row),
        processedAt: evaluationDate
      },
      update: {
        gameId: row.gameId,
        playerId: row.playerId,
        formulaVersionTag: FORMULA_V3_VERSION_NUMBER,
        productionScore: row.rawGameValue,
        leagueWeight: row.competitionEvidenceWeight,
        opponentFactor: clamp(1 + (row.opponentTeamAdjustment + row.opponentLineupAdjustment) / 100, 0.8, 1.2),
        teamFactor: clamp(1 + (row.ownTeamAdjustment + row.teammateLineupAdjustment) / 100, 0.8, 1.2),
        performanceScore: row.finalGameScore,
        finalPerformanceScore: row.finalGameScore,
        effectiveFieldGoalPct: effectiveFieldGoalPct(row),
        trueShootingPct: trueShootingPct(row),
        deletedAt: null,
        processedAt: evaluationDate
      }
    })));
  }

  const storedScores = await prisma.gamePerformanceScore.findMany({
    where: { formulaVersionId: formulaVersion.id },
    select: { id: true, gameStatId: true }
  });
  const staleScoreIds = storedScores.filter((row) => !expectedScoreKeys.has(row.gameStatId)).map((row) => row.id);
  if (staleScoreIds.length) {
    await prisma.gamePerformanceScore.deleteMany({ where: { id: { in: staleScoreIds } } });
  }

  const expectedRatingKeys = new Set(
    ecosystem.playerCandidate.ratings.map((row) => `${row.playerId}|${row.ageGroup}`)
  );
  for (const batch of chunks(ecosystem.playerCandidate.ratings)) {
    await prisma.$transaction(batch.map((row) => prisma.playerRating.upsert({
      where: {
        playerId_ageGroup_formulaVersionId_policyVersionId: {
          playerId: row.playerId,
          ageGroup: row.ageGroup,
          formulaVersionId: formulaVersion.id,
          policyVersionId: FORMULA_V3_POLICY_ID
        }
      },
      create: {
        playerId: row.playerId,
        ageGroup: row.ageGroup,
        observedRating: row.observedRating,
        adjustedRating: row.adjustedRating,
        verifiedGameCount: row.verifiedGameCount,
        starRating: row.starRating,
        computedAt: evaluationDate,
        formulaVersionId: formulaVersion.id,
        policyVersionId: FORMULA_V3_POLICY_ID,
        ratingBasis: `v3.3; confidence=${row.confidence}; qualityGames=${row.qualityGameEquivalent}`
      },
      update: {
        observedRating: row.observedRating,
        adjustedRating: row.adjustedRating,
        verifiedGameCount: row.verifiedGameCount,
        starRating: row.starRating,
        computedAt: evaluationDate,
        ratingBasis: `v3.3; confidence=${row.confidence}; qualityGames=${row.qualityGameEquivalent}`
      }
    })));
  }

  const storedRatings = await prisma.playerRating.findMany({
    where: { formulaVersionId: formulaVersion.id, policyVersionId: FORMULA_V3_POLICY_ID },
    select: { id: true, playerId: true, ageGroup: true }
  });
  const staleRatingIds = storedRatings
    .filter((row) => !expectedRatingKeys.has(`${row.playerId}|${row.ageGroup}`))
    .map((row) => row.id);
  if (staleRatingIds.length) await prisma.playerRating.deleteMany({ where: { id: { in: staleRatingIds } } });

  const [scoreCount, ratingCount] = await Promise.all([
    prisma.gamePerformanceScore.count({ where: { formulaVersionId: formulaVersion.id, deletedAt: null } }),
    prisma.playerRating.count({ where: { formulaVersionId: formulaVersion.id, policyVersionId: FORMULA_V3_POLICY_ID } })
  ]);
  if (scoreCount !== ecosystem.playerCandidate.games.length || ratingCount !== ecosystem.playerCandidate.ratings.length) {
    throw new Error(`Formula v3.3 validation failed: expected ${ecosystem.playerCandidate.games.length}/${ecosystem.playerCandidate.ratings.length}, stored ${scoreCount}/${ratingCount}.`);
  }

  return {
    executed: true,
    formulaVersionId: formulaVersion.id,
    policyVersionId: FORMULA_V3_POLICY_ID,
    performanceScores: scoreCount,
    playerRatings: ratingCount,
    competitionPools: ecosystem.competitionProfiles.length,
    warnings: ecosystem.loaded.warnings
  };
}
