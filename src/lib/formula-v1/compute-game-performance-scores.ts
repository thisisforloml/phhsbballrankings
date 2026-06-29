import { prisma } from "@/lib/prisma";
import { FORMULA_V1_VERSION_NUMBER } from "@/lib/ratings/formula-constants";

export const FORMULA_V1_GPS_ASSUMPTIONS = {
  assistCreationShare: 0.35,
  blockRetentionFactor: 0.6,
  stealFactor: 1,
  foulDrawnFactor: 0.35,
  foulCostFactor: 0.35,
  offensiveReboundValueFactor: 1
} as const;

export type GamePerformanceStatInput = {
  id: string;
  gameId: string;
  playerId: string;
  points: number;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  rebounds: number;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
};

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function percentileScale(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentileByValue = new Map<number, number>();

  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (percentileByValue.has(value)) continue;

    let last = i;
    while (last + 1 < sorted.length && sorted[last + 1] === value) last += 1;

    const percentile = sorted.length === 1 ? 1 : ((i + last) / 2) / (sorted.length - 1);
    percentileByValue.set(value, percentile);
    i = last;
  }

  return values.map((value) => 1 + (percentileByValue.get(value) ?? 0) * 99);
}

export function requiredGameStatIssues(stat: GamePerformanceStatInput) {
  const fields: Array<keyof GamePerformanceStatInput> = [
    "points",
    "fieldGoalsMade",
    "fieldGoalsAttempt",
    "threeMade",
    "threeAttempt",
    "freeThrowsMade",
    "freeThrowsAttempt",
    "offensiveRebounds",
    "defensiveRebounds",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "fouls",
    "foulsDrawn"
  ];

  return fields
    .filter((field) => stat[field] === null || stat[field] === undefined)
    .map((field) => `Missing ${field}.`);
}

export async function resolveFormulaV1VersionId() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 version row not found.");
  return formulaVersion.id;
}

export async function upsertGamePerformanceScoresForStats(stats: GamePerformanceStatInput[]) {
  if (!stats.length) {
    return {
      formulaVersionId: await resolveFormulaV1VersionId(),
      created: 0,
      updated: 0,
      totalEligibleGameStats: 0,
      minRawGameValue: null,
      maxRawGameValue: null,
      minScaledGameScore: null,
      maxScaledGameScore: null
    };
  }

  const skippedRows = stats
    .map((stat) => ({ statId: stat.id, reasons: requiredGameStatIssues(stat) }))
    .filter((row) => row.reasons.length);
  if (skippedRows.length) {
    throw new Error(`GameStats have missing required fields: ${JSON.stringify(skippedRows)}`);
  }

  const now = new Date();
  const formulaVersionId = await resolveFormulaV1VersionId();

  const totals = stats.reduce(
    (sum, stat) => ({
      points: sum.points + stat.points,
      fga: sum.fga + stat.fieldGoalsAttempt!,
      oreb: sum.oreb + stat.offensiveRebounds!,
      dreb: sum.dreb + stat.defensiveRebounds!,
      tov: sum.tov + stat.turnovers!,
      fta: sum.fta + stat.freeThrowsAttempt!
    }),
    { points: 0, fga: 0, oreb: 0, dreb: 0, tov: 0, fta: 0 }
  );

  const leaguePossessions = totals.fga - totals.oreb + totals.tov + 0.44 * totals.fta;
  const leaguePPP = safeDivide(totals.points, leaguePossessions);
  const leagueDefRebRate = safeDivide(totals.dreb, totals.dreb + totals.oreb);
  const leagueOffRebRate = safeDivide(totals.oreb, totals.oreb + totals.dreb);
  if (leaguePPP === null || leagueDefRebRate === null || leagueOffRebRate === null) {
    throw new Error("Could not compute league context for game performance scores.");
  }

  const rawScores = stats.map((stat) => {
    const fgm = stat.fieldGoalsMade!;
    const fga = stat.fieldGoalsAttempt!;
    const threeMade = stat.threeMade!;
    const threeAttempt = stat.threeAttempt!;
    const ftm = stat.freeThrowsMade!;
    const fta = stat.freeThrowsAttempt!;
    const missedFG = fga - fgm;
    const missedFT = fta - ftm;
    const twoMade = fgm - threeMade;
    const twoAttempt = fga - threeAttempt;

    if (missedFG < 0 || missedFT < 0 || twoMade < 0 || twoAttempt < 0) {
      throw new Error(`Invalid shot math for GameStat ${stat.id}.`);
    }

    const effectiveFieldGoalPct = fga === 0 ? null : (fgm + 0.5 * threeMade) / fga;
    const trueShootingDenominator = 2 * (fga + 0.44 * fta);
    const trueShootingPct = trueShootingDenominator === 0 ? null : stat.points / trueShootingDenominator;
    const raw =
      stat.points +
      stat.offensiveRebounds! * leaguePPP * FORMULA_V1_GPS_ASSUMPTIONS.offensiveReboundValueFactor +
      stat.defensiveRebounds! * leaguePPP * leagueOffRebRate +
      stat.assists * leaguePPP * FORMULA_V1_GPS_ASSUMPTIONS.assistCreationShare +
      stat.steals! * leaguePPP * FORMULA_V1_GPS_ASSUMPTIONS.stealFactor +
      stat.blocks! * leaguePPP * FORMULA_V1_GPS_ASSUMPTIONS.blockRetentionFactor +
      stat.foulsDrawn! * leaguePPP * FORMULA_V1_GPS_ASSUMPTIONS.foulDrawnFactor -
      missedFG * leaguePPP * leagueDefRebRate -
      missedFT * 0.44 * leaguePPP -
      stat.turnovers! * leaguePPP -
      stat.fouls! * leaguePPP * FORMULA_V1_GPS_ASSUMPTIONS.foulCostFactor;

    return { stat, raw, effectiveFieldGoalPct, trueShootingPct };
  });

  const scaled = percentileScale(rawScores.map((score) => score.raw));
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rawScores.length; i += 1) {
    const score = rawScores[i];
    const gpsKey = {
      gameStatId_formulaVersionId: {
        gameStatId: score.stat.id,
        formulaVersionId
      }
    };
    const existing = await prisma.gamePerformanceScore.findUnique({ where: gpsKey, select: { id: true } });
    await prisma.gamePerformanceScore.upsert({
      where: gpsKey,
      update: {
        gameId: score.stat.gameId,
        playerId: score.stat.playerId,
        formulaVersionId,
        productionScore: score.raw,
        leagueWeight: 1,
        opponentFactor: 1,
        teamFactor: 1,
        performanceScore: scaled[i],
        formulaVersionTag: 1,
        effectiveFieldGoalPct: score.effectiveFieldGoalPct,
        trueShootingPct: score.trueShootingPct,
        finalPerformanceScore: scaled[i],
        processedAt: now,
        deletedAt: null
      },
      create: {
        gameId: score.stat.gameId,
        gameStatId: score.stat.id,
        playerId: score.stat.playerId,
        formulaVersionId,
        productionScore: score.raw,
        leagueWeight: 1,
        opponentFactor: 1,
        teamFactor: 1,
        performanceScore: scaled[i],
        formulaVersionTag: 1,
        effectiveFieldGoalPct: score.effectiveFieldGoalPct,
        trueShootingPct: score.trueShootingPct,
        finalPerformanceScore: scaled[i],
        processedAt: now
      }
    });
    if (existing) updated += 1;
    else created += 1;
  }

  return {
    formulaVersionId,
    created,
    updated,
    totalEligibleGameStats: stats.length,
    minRawGameValue: Math.min(...rawScores.map((score) => score.raw)),
    maxRawGameValue: Math.max(...rawScores.map((score) => score.raw)),
    minScaledGameScore: Math.min(...scaled),
    maxScaledGameScore: Math.max(...scaled),
    leagueContext: { leaguePossessions, leaguePPP, leagueDefRebRate, leagueOffRebRate }
  };
}

const seasonStatSelect = {
  id: true,
  gameId: true,
  playerId: true,
  points: true,
  fieldGoalsMade: true,
  fieldGoalsAttempt: true,
  threeMade: true,
  threeAttempt: true,
  freeThrowsMade: true,
  freeThrowsAttempt: true,
  offensiveRebounds: true,
  defensiveRebounds: true,
  rebounds: true,
  assists: true,
  steals: true,
  blocks: true,
  turnovers: true,
  fouls: true,
  foulsDrawn: true
} as const;

export async function recomputeSeasonFormulaScores(seasonId: string) {
  const stats = await prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      game: { seasonId, deletedAt: null },
      player: { deletedAt: null }
    },
    select: seasonStatSelect
  });

  return upsertGamePerformanceScoresForStats(stats);
}
