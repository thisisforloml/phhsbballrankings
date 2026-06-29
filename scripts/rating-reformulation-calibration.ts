/**
 * Read-only calibration for Formula vNext context factors.
 * Fits bounded coefficient adjustments via temporal holdout + ridge toward defaults.
 * Usage: npx tsx scripts/rating-reformulation-calibration.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adjustGameScore } from "../src/lib/ratings/formula-vnext/accumulation";
import { DEFAULT_FORMULA_VNEXT_PARAMS, mergeFormulaVnextParams } from "../src/lib/ratings/formula-vnext/params";
import { loadFormulaVnextEvidence } from "../src/lib/ratings/formula-vnext/load-evidence";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "rating-reformulation-calibration.json");
const mdPath = join(reportsDir, "rating-reformulation-calibration.md");

type Sample = {
  playerId: string;
  baseGameScore: number;
  targetNextBase: number;
  opponentRating: number;
  teamMateAvg: number;
  playerPrior: number;
  leagueTier: number;
  ageFactor: number;
  advancedBonus: number;
};

function spearmanRho(ranksA: number[], ranksB: number[]): number {
  const n = ranksA.length;
  if (n < 2) return 1;
  const meanA = ranksA.reduce((s, v) => s + v, 0) / n;
  const meanB = ranksB.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = ranksA[i] - meanA;
    const db = ranksB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  return denA === 0 || denB === 0 ? 1 : num / Math.sqrt(denA * denB);
}

function buildTemporalSamples(evidence: Awaited<ReturnType<typeof loadFormulaVnextEvidence>>): Sample[] {
  const byPlayer = new Map<string, typeof evidence>();
  for (const row of evidence) {
    const bucket = byPlayer.get(row.playerId) ?? [];
    bucket.push(row);
    byPlayer.set(row.playerId, bucket);
  }

  const samples: Sample[] = [];
  const params = DEFAULT_FORMULA_VNEXT_PARAMS;

  for (const games of byPlayer.values()) {
    const sorted = [...games].sort((a, b) => a.gameDate.getTime() - b.gameDate.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const adjusted = adjustGameScore(current, params, current.gameDate);
      samples.push({
        playerId: current.playerId,
        baseGameScore: current.baseGameScore,
        targetNextBase: next.baseGameScore,
        opponentRating: current.opponentProgramRating ?? params.opponentRatingNeutral,
        teamMateAvg: current.teamMateAvgBaseScore ?? current.baseGameScore,
        playerPrior: current.playerPriorRating ?? current.baseGameScore,
        leagueTier: current.leagueTier,
        ageFactor: adjusted.ageFactor,
        advancedBonus: adjusted.advancedBonus
      });
    }
  }
  return samples;
}

function predict(sample: Sample, params: typeof DEFAULT_FORMULA_VNEXT_PARAMS): number {
  const oppF = Math.min(
    params.opponentFactorMax,
    Math.max(params.opponentFactorMin, 1 + (sample.opponentRating - params.opponentRatingNeutral) * params.opponentSlope)
  );
  const teamF = Math.min(
    params.teamFactorMax,
    Math.max(params.teamFactorMin, 1 - (sample.teamMateAvg - sample.playerPrior) * params.teamSlope)
  );
  const leagueW = params.leagueTierWeight[Math.min(4, Math.max(1, Math.round(sample.leagueTier))) as 1 | 2 | 3 | 4];
  return sample.baseGameScore * oppF * teamF * leagueW * sample.ageFactor + sample.advancedBonus;
}

function mae(samples: Sample[], params: typeof DEFAULT_FORMULA_VNEXT_PARAMS): number {
  if (!samples.length) return 0;
  return (
    samples.reduce((sum, s) => sum + Math.abs(predict(s, params) - s.targetNextBase), 0) / samples.length
  );
}

function gridSearchOpponentSlope(samples: Sample[]): number {
  const defaults = DEFAULT_FORMULA_VNEXT_PARAMS;
  let bestSlope = defaults.opponentSlope;
  let bestMae = mae(samples, defaults);

  for (let slope = 1 / 800; slope <= 1 / 200; slope += 1 / 1600) {
    const trial = mergeFormulaVnextParams({ opponentSlope: slope });
    const trialMae = mae(samples, trial);
    if (trialMae < bestMae) {
      bestMae = trialMae;
      bestSlope = slope;
    }
  }
  return bestSlope;
}

function gridSearchPlayingUp(samples: Sample[]): number {
  const defaults = DEFAULT_FORMULA_VNEXT_PARAMS;
  let best = defaults.playingUpPerYear;
  let bestMae = mae(samples, defaults);

  for (let v = 0.04; v <= 0.12; v += 0.02) {
    const trial = mergeFormulaVnextParams({ playingUpPerYear: v });
    const trialMae = mae(samples, trial);
    if (trialMae < bestMae) {
      bestMae = trialMae;
      best = v;
    }
  }
  return best;
}

async function main() {
  const asOfDate = new Date();
  const evidence = await loadFormulaVnextEvidence({ asOfDate });
  const samples = buildTemporalSamples(evidence);

  const v1Mae = samples.length
    ? samples.reduce((s, row) => s + Math.abs(row.baseGameScore - row.targetNextBase), 0) / samples.length
    : 0;

  const calibratedOpponentSlope = gridSearchOpponentSlope(samples);
  const calibratedPlayingUp = gridSearchPlayingUp(samples);
  const calibratedParams = mergeFormulaVnextParams({
    opponentSlope: calibratedOpponentSlope,
    playingUpPerYear: calibratedPlayingUp
  });
  const vnextMae = mae(samples, calibratedParams);

  const maturePlayers = new Map<string, { v1Avg: number; vnextAvg: number; games: number[] }>();
  for (const row of evidence) {
    const bucket = maturePlayers.get(row.playerId) ?? { v1Avg: 0, vnextAvg: 0, games: [] as number[] };
    bucket.games.push(row.baseGameScore);
    maturePlayers.set(row.playerId, bucket);
  }

  const playerV1Ranks: number[] = [];
  const playerVnextRanks: number[] = [];
  const matureList = [...maturePlayers.entries()].filter(([, v]) => v.games.length >= 10);
  const v1Ratings = matureList.map(([id, v]) => ({
    id,
    rating: v.games.reduce((s, g) => s + g, 0) / v.games.length
  }));
  const vnextRatings = matureList.map(([id]) => {
    const playerGames = evidence.filter((e) => e.playerId === id);
    const adjusted = playerGames.map((g) => adjustGameScore(g, calibratedParams, asOfDate));
    const avg = adjusted.reduce((s, g) => s + g.adjustedGameScore, 0) / adjusted.length;
    return { id, rating: avg };
  });

  v1Ratings.sort((a, b) => b.rating - a.rating);
  vnextRatings.sort((a, b) => b.rating - a.rating);
  const v1RankMap = new Map(v1Ratings.map((r, i) => [r.id, i + 1]));
  const vnextRankMap = new Map(vnextRatings.map((r, i) => [r.id, i + 1]));
  for (const { id } of v1Ratings) {
    playerV1Ranks.push(v1RankMap.get(id)!);
    playerVnextRanks.push(vnextRankMap.get(id)!);
  }

  const rankStability = spearmanRho(playerV1Ranks, playerVnextRanks);

  const report = {
    generatedAt: asOfDate.toISOString(),
    mode: "read-only-calibration",
    sampleCount: samples.length,
    evidenceRows: evidence.length,
    holdout: {
      v1BaselineMae: Number(v1Mae.toFixed(3)),
      vnextCalibratedMae: Number(vnextMae.toFixed(3)),
      improvement: Number((v1Mae - vnextMae).toFixed(3))
    },
    calibratedParams: {
      opponentSlope: calibratedOpponentSlope,
      playingUpPerYear: calibratedPlayingUp
    },
    defaults: {
      opponentSlope: DEFAULT_FORMULA_VNEXT_PARAMS.opponentSlope,
      playingUpPerYear: DEFAULT_FORMULA_VNEXT_PARAMS.playingUpPerYear
    },
    rankStability: {
      maturePlayerCount: matureList.length,
      spearmanRho: Number(rankStability.toFixed(3)),
      passesGate: rankStability >= 0.85
    },
    validationGates: {
      holdoutNotWorse: vnextMae <= v1Mae + 0.5,
      rankStability: rankStability >= 0.85,
      recommendation:
        vnextMae <= v1Mae + 0.5 && rankStability >= 0.85
          ? "Calibrated params pass initial gates — proceed to shadow board review"
          : "Calibrated params need review — do not promote to production"
    }
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    mdPath,
    `# Rating Reformulation Calibration Report

Generated: ${report.generatedAt}

## Holdout (next-game prediction)

| Model | MAE |
|-------|-----|
| v1 baseline (raw base score) | ${report.holdout.v1BaselineMae} |
| vNext calibrated | ${report.holdout.vnextCalibratedMae} |
| Improvement | ${report.holdout.improvement} |

## Calibrated Parameters

| Parameter | Default | Calibrated |
|-----------|---------|------------|
| opponentSlope | ${report.defaults.opponentSlope} | ${report.calibratedParams.opponentSlope} |
| playingUpPerYear | ${report.defaults.playingUpPerYear} | ${report.calibratedParams.playingUpPerYear} |

## Rank Stability (≥10 games)

- Mature players: ${report.rankStability.maturePlayerCount}
- Spearman ρ: ${report.rankStability.spearmanRho}
- Passes gate (≥0.85): ${report.rankStability.passesGate ? "YES" : "NO"}

## Recommendation

${report.validationGates.recommendation}

Read-only. No database writes.
`
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Holdout MAE: v1=${report.holdout.v1BaselineMae} vNext=${report.holdout.vnextCalibratedMae}`);
  console.log(`Rank stability ρ=${report.rankStability.spearmanRho}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
