import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const formulaVersionNumber = 1;
const expectedEligibleGameStats = 79;
const leagueName = "UAAP Season 88 16U Boys Basketball";
const seasonName = "Season 88";
const ageGroup = AgeGroup.U16;
const gender = PlayerGender.BOYS;

const assumptions = {
  assistCreationShare: 0.35,
  blockRetentionFactor: 0.6,
  stealFactor: 1,
  foulDrawnFactor: 0.35,
  foulCostFactor: 0.35,
  offensiveReboundValueFactor: 1,
  scaling: "percentile",
  leagueWeight: 1,
  opponentFactor: 1,
  teamFactor: 1
} as const;

type Stat = {
  id: string; gameId: string; playerId: string; points: number;
  fieldGoalsMade: number | null; fieldGoalsAttempt: number | null; threeMade: number | null; threeAttempt: number | null;
  freeThrowsMade: number | null; freeThrowsAttempt: number | null; offensiveRebounds: number | null; defensiveRebounds: number | null;
  rebounds: number; assists: number; steals: number | null; blocks: number | null; turnovers: number | null; fouls: number | null; foulsDrawn: number | null;
};

function safeDivide(n: number, d: number) { return d === 0 ? null : n / d; }
function percentileScale(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const map = new Map<number, number>();
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (map.has(value)) continue;
    let last = i;
    while (last + 1 < sorted.length && sorted[last + 1] === value) last += 1;
    const percentile = sorted.length === 1 ? 1 : ((i + last) / 2) / (sorted.length - 1);
    map.set(value, percentile);
    i = last;
  }
  return values.map((value) => 1 + (map.get(value) ?? 0) * 99);
}
function requireFields(stat: Stat) {
  const fields: Array<keyof Stat> = ["points", "fieldGoalsMade", "fieldGoalsAttempt", "threeMade", "threeAttempt", "freeThrowsMade", "freeThrowsAttempt", "offensiveRebounds", "defensiveRebounds", "rebounds", "assists", "steals", "blocks", "turnovers", "fouls", "foulsDrawn"];
  return fields.filter((field) => stat[field] === null || stat[field] === undefined).map((field) => `Missing ${field}.`);
}

async function main() {
  const now = new Date();
  const formulaVersion = await prisma.formulaVersion.upsert({
    where: { versionNumber: formulaVersionNumber },
    update: { isPublic: false, weights: assumptions },
    create: { versionNumber: formulaVersionNumber, description: "Formula v1 possession-informed transparent baseline box-score model", isPublic: false, weights: assumptions, effectiveFrom: now }
  });
  const league = await prisma.league.findFirst({ where: { name: leagueName, ageGroup, deletedAt: null }, select: { id: true, name: true } });
  if (!league) throw new Error(`Missing ${leagueName}.`);
  const season = await prisma.season.findUnique({ where: { leagueId_name: { leagueId: league.id, name: seasonName } }, select: { id: true, name: true, deletedAt: true } });
  if (!season || season.deletedAt) throw new Error(`Missing active ${seasonName}.`);
  const stats = await prisma.gameStat.findMany({
    where: { deletedAt: null, game: { seasonId: season.id, deletedAt: null }, player: { gender, deletedAt: null } },
    select: { id: true, gameId: true, playerId: true, points: true, fieldGoalsMade: true, fieldGoalsAttempt: true, threeMade: true, threeAttempt: true, freeThrowsMade: true, freeThrowsAttempt: true, offensiveRebounds: true, defensiveRebounds: true, rebounds: true, assists: true, steals: true, blocks: true, turnovers: true, fouls: true, foulsDrawn: true }
  });
  if (stats.length !== expectedEligibleGameStats) throw new Error(`Expected ${expectedEligibleGameStats} U16 GameStats, found ${stats.length}.`);
  const skippedRows = stats.map((stat) => ({ stat, reasons: requireFields(stat) })).filter((row) => row.reasons.length);
  if (skippedRows.length) throw new Error(`U16 GameStats have missing required fields: ${JSON.stringify(skippedRows)}`);
  const totals = stats.reduce((sum, stat) => ({ points: sum.points + stat.points, fga: sum.fga + stat.fieldGoalsAttempt!, oreb: sum.oreb + stat.offensiveRebounds!, dreb: sum.dreb + stat.defensiveRebounds!, tov: sum.tov + stat.turnovers!, fta: sum.fta + stat.freeThrowsAttempt! }), { points: 0, fga: 0, oreb: 0, dreb: 0, tov: 0, fta: 0 });
  const leaguePossessions = totals.fga - totals.oreb + totals.tov + 0.44 * totals.fta;
  const leaguePPP = safeDivide(totals.points, leaguePossessions);
  const leagueDefRebRate = safeDivide(totals.dreb, totals.dreb + totals.oreb);
  const leagueOffRebRate = safeDivide(totals.oreb, totals.oreb + totals.dreb);
  if (leaguePPP === null || leagueDefRebRate === null || leagueOffRebRate === null) throw new Error("Could not compute U16 league context.");
  const rawScores = stats.map((stat) => {
    const fgm = stat.fieldGoalsMade!, fga = stat.fieldGoalsAttempt!, threeMade = stat.threeMade!, threeAttempt = stat.threeAttempt!, ftm = stat.freeThrowsMade!, fta = stat.freeThrowsAttempt!;
    const missedFG = fga - fgm, missedFT = fta - ftm, twoMade = fgm - threeMade, twoAttempt = fga - threeAttempt;
    if (missedFG < 0 || missedFT < 0 || twoMade < 0 || twoAttempt < 0) throw new Error(`Invalid shot math for ${stat.id}.`);
    const efg = fga === 0 ? null : (fgm + 0.5 * threeMade) / fga;
    const tsDen = 2 * (fga + 0.44 * fta);
    const ts = tsDen === 0 ? null : stat.points / tsDen;
    const raw = stat.points + stat.offensiveRebounds! * leaguePPP * assumptions.offensiveReboundValueFactor + stat.defensiveRebounds! * leaguePPP * leagueOffRebRate + stat.assists * leaguePPP * assumptions.assistCreationShare + stat.steals! * leaguePPP * assumptions.stealFactor + stat.blocks! * leaguePPP * assumptions.blockRetentionFactor + stat.foulsDrawn! * leaguePPP * assumptions.foulDrawnFactor - missedFG * leaguePPP * leagueDefRebRate - missedFT * 0.44 * leaguePPP - stat.turnovers! * leaguePPP - stat.fouls! * leaguePPP * assumptions.foulCostFactor;
    return { stat, raw, efg, ts };
  });
  const scaled = percentileScale(rawScores.map((score) => score.raw));
  let created = 0, updated = 0;
  for (let i = 0; i < rawScores.length; i += 1) {
    const score = rawScores[i];
    const existing = await prisma.gamePerformanceScore.findUnique({ where: { gameStatId: score.stat.id }, select: { id: true } });
    await prisma.gamePerformanceScore.upsert({
      where: { gameStatId: score.stat.id },
      update: { gameId: score.stat.gameId, playerId: score.stat.playerId, formulaVersionId: formulaVersion.id, productionScore: score.raw, leagueWeight: 1, opponentFactor: 1, teamFactor: 1, performanceScore: scaled[i], formulaVersionTag: 1, effectiveFieldGoalPct: score.efg, trueShootingPct: score.ts, finalPerformanceScore: scaled[i], processedAt: now, deletedAt: null },
      create: { gameId: score.stat.gameId, gameStatId: score.stat.id, playerId: score.stat.playerId, formulaVersionId: formulaVersion.id, productionScore: score.raw, leagueWeight: 1, opponentFactor: 1, teamFactor: 1, performanceScore: scaled[i], formulaVersionTag: 1, effectiveFieldGoalPct: score.efg, trueShootingPct: score.ts, finalPerformanceScore: scaled[i], processedAt: now }
    });
    if (existing) updated += 1; else created += 1;
  }
  console.log(JSON.stringify({ formulaVersionId: formulaVersion.id, pool: { leagueName, seasonName, ageGroup, gender, leaguePossessions, leaguePPP, leagueDefRebRate, leagueOffRebRate }, totalEligibleGameStats: stats.length, gamePerformanceScoresCreated: created, gamePerformanceScoresUpdated: updated, minRawGameValue: Math.min(...rawScores.map((s) => s.raw)), maxRawGameValue: Math.max(...rawScores.map((s) => s.raw)), minScaledGameScore: Math.min(...scaled), maxScaledGameScore: Math.max(...scaled) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
