import {
  computeFormulaV2LeagueContext,
  computeFormulaV2RawGameValue,
  effectiveFieldGoalPct,
  percentileScaleToRating,
  trueShootingPct
} from "@/lib/advanced-metrics";

import { DEFAULT_FORMULA_V3_PARAMS, type FormulaV3Params } from "./params";
import type {
  FormulaV3IndependentGameScore,
  FormulaV3PoolContext,
  FormulaV3StatLine
} from "./types";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function poolKey(stat: FormulaV3StatLine) {
  return `${stat.seasonId}|${stat.competitionAgeGroup}|${stat.gender}`;
}

function formulaV2Input(stat: FormulaV3StatLine) {
  return {
    points: stat.points,
    fieldGoalsMade: stat.fieldGoalsMade,
    fieldGoalsAttempt: stat.fieldGoalsAttempt,
    freeThrowsMade: stat.freeThrowsMade,
    freeThrowsAttempt: stat.freeThrowsAttempt,
    offensiveRebounds: stat.offensiveRebounds,
    defensiveRebounds: stat.defensiveRebounds,
    rebounds: stat.rebounds,
    assists: stat.assists,
    steals: stat.steals,
    blocks: stat.blocks,
    turnovers: stat.turnovers,
    fouls: stat.fouls,
    foulsDrawn: stat.foulsDrawn
  };
}

function metricPercentiles(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  const scaled = percentileScaleToRating(available);
  let cursor = 0;
  return values.map((value) => (value === null ? null : scaled[cursor++]));
}

function weightedAvailable(
  metrics: Array<{ value: number | null; weight: number }>
): number | null {
  const available = metrics.filter((metric) => metric.value !== null);
  const weight = available.reduce((sum, metric) => sum + metric.weight, 0);
  if (weight <= 0) return null;
  return available.reduce((sum, metric) => sum + metric.value! * metric.weight, 0) / weight;
}

export function scoreIndependentGames(
  stats: FormulaV3StatLine[],
  params: FormulaV3Params = DEFAULT_FORMULA_V3_PARAMS
): { rows: FormulaV3IndependentGameScore[]; pools: FormulaV3PoolContext[] } {
  const groups = new Map<string, FormulaV3StatLine[]>();
  for (const stat of stats) {
    const key = poolKey(stat);
    const bucket = groups.get(key) ?? [];
    bucket.push(stat);
    groups.set(key, bucket);
  }

  const output: FormulaV3IndependentGameScore[] = [];
  const pools: FormulaV3PoolContext[] = [];

  for (const [key, pool] of groups) {
    const context = computeFormulaV2LeagueContext(pool.map(formulaV2Input));
    const rawValues = pool.map((stat) => computeFormulaV2RawGameValue(formulaV2Input(stat), context));
    const baseScores = percentileScaleToRating(rawValues);

    const tsValues = pool.map((stat) => {
      if ((stat.fieldGoalsAttempt ?? 0) + (stat.freeThrowsAttempt ?? 0) <= 0) return null;
      return trueShootingPct({
        pts: stat.points,
        fga: stat.fieldGoalsAttempt ?? 0,
        fta: stat.freeThrowsAttempt ?? 0
      });
    });
    const efgValues = pool.map((stat) => {
      if ((stat.fieldGoalsAttempt ?? 0) <= 0) return null;
      return effectiveFieldGoalPct({
        fgm: stat.fieldGoalsMade ?? 0,
        threePm: stat.threeMade ?? 0,
        fga: stat.fieldGoalsAttempt ?? 0
      });
    });
    const creationValues = pool.map((stat) => {
      const turnovers = finite(stat.turnovers);
      if (turnovers === null) return null;
      return (stat.assists + 1) / (turnovers + 1);
    });
    const defenseValues = pool.map((stat) => {
      if (stat.steals === null && stat.blocks === null) return null;
      const stocks = (stat.steals ?? 0) + (stat.blocks ?? 0);
      return stat.minutes !== null && stat.minutes >= 5 ? (stocks * 32) / stat.minutes : stocks;
    });

    const tsPct = metricPercentiles(tsValues);
    const efgPct = metricPercentiles(efgValues);
    const creationPct = metricPercentiles(creationValues);
    const defensePct = metricPercentiles(defenseValues);
    const rateValues = rawValues.map((rawValue, index) => {
      const minutes = pool[index].minutes;
      return minutes !== null && minutes >= params.perMinuteMinimumMinutes
        ? (rawValue * 32) / minutes
        : null;
    });
    const ratePct = metricPercentiles(rateValues);

    pools.push({
      key,
      sampleSize: pool.length,
      trueShootingPct: context.fieldGoalsAttempt + context.freeThrowsAttempt > 0
        ? context.points / (2 * (context.fieldGoalsAttempt + 0.44 * context.freeThrowsAttempt))
        : null,
      effectiveFieldGoalPct: context.fieldGoalsAttempt > 0
        ? (context.fieldGoalsMade + 0.5 * pool.reduce((sum, stat) => sum + (stat.threeMade ?? 0), 0)) /
          context.fieldGoalsAttempt
        : null
    });

    pool.forEach((stat, index) => {
      const advancedScore = weightedAvailable([
        { value: tsPct[index], weight: 0.4 },
        { value: efgPct[index], weight: 0.25 },
        { value: creationPct[index], weight: 0.2 },
        { value: defensePct[index], weight: 0.15 }
      ]);
      const advancedAdjustment = advancedScore === null
        ? 0
        : clamp(
            (advancedScore - 50) * params.advancedMetricWeight,
            -params.advancedAdjustmentMax,
            params.advancedAdjustmentMax
          );
      const minutes = stat.minutes ?? 0;
      const rateReliability = ratePct[index] === null
        ? 0
        : clamp(
            (minutes - params.perMinuteMinimumMinutes) /
              Math.max(1, params.perMinuteFullReliabilityMinutes - params.perMinuteMinimumMinutes),
            0,
            1
          );
      const rateWeight = params.perMinuteWeight * rateReliability;
      const independentScore = clamp(baseScores[index] + advancedAdjustment, 1, 100);
      const stabilizedIndependentScore = ratePct[index] === null
        ? independentScore
        : clamp(independentScore * (1 - rateWeight) + ratePct[index]! * rateWeight, 1, 100);

      output.push({
        ...stat,
        rawGameValue: rawValues[index],
        baseScore: baseScores[index],
        advancedScore,
        independentScore,
        rateScore: ratePct[index],
        rateReliability,
        stabilizedIndependentScore
      });
    });
  }

  return { rows: output, pools };
}
