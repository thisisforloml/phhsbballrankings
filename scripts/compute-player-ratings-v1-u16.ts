import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const formulaVersionNumber = 1;
const expectedGamePerformanceScores = 79;
const leagueName = "UAAP Season 88 16U Boys Basketball";
const seasonName = "Season 88";
const ageGroup = AgeGroup.U16;
const gender = PlayerGender.BOYS;

function average(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function starFromAdjustedRating(value: number) { if (value >= 90) return 5; if (value >= 80) return 4; if (value >= 70) return 3; if (value >= 60) return 2; return 1; }

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: formulaVersionNumber }, select: { id: true } });
  if (!formulaVersion) throw new Error("Missing FormulaVersion v1.");
  const league = await prisma.league.findFirst({ where: { name: leagueName, ageGroup, deletedAt: null }, select: { id: true } });
  if (!league) throw new Error(`Missing ${leagueName}.`);
  const season = await prisma.season.findUnique({ where: { leagueId_name: { leagueId: league.id, name: seasonName } }, select: { id: true, deletedAt: true } });
  if (!season || season.deletedAt) throw new Error(`Missing active ${seasonName}.`);
  const scores = await prisma.gamePerformanceScore.findMany({
    where: { formulaVersionId: formulaVersion.id, deletedAt: null, game: { seasonId: season.id, deletedAt: null }, player: { gender, deletedAt: null } },
    include: { player: { select: { id: true, displayName: true } } }
  });
  if (scores.length !== expectedGamePerformanceScores) throw new Error(`Expected ${expectedGamePerformanceScores} U16 GamePerformanceScores, found ${scores.length}.`);
  const byPlayer = new Map<string, { playerId: string; displayName: string; values: number[] }>();
  for (const score of scores) {
    if (score.finalPerformanceScore === null) throw new Error(`Missing finalPerformanceScore for ${score.id}.`);
    const item = byPlayer.get(score.playerId) ?? { playerId: score.playerId, displayName: score.player.displayName, values: [] };
    item.values.push(Number(score.finalPerformanceScore));
    byPlayer.set(score.playerId, item);
  }
  const inputs = [...byPlayer.values()].map((player) => {
    const observedRating = average(player.values);
    const adjustedRating = observedRating;
    return { playerId: player.playerId, displayName: player.displayName, observedRating, adjustedRating, verifiedGameCount: player.values.length, starRating: starFromAdjustedRating(adjustedRating) };
  });
  let created = 0, updated = 0;
  for (const rating of inputs) {
    const existing = await prisma.playerRating.findUnique({ where: { playerId_ageGroup: { playerId: rating.playerId, ageGroup } }, select: { id: true } });
    await prisma.playerRating.upsert({ where: { playerId_ageGroup: { playerId: rating.playerId, ageGroup } }, update: { observedRating: rating.observedRating, adjustedRating: rating.adjustedRating, verifiedGameCount: rating.verifiedGameCount, starRating: rating.starRating }, create: { playerId: rating.playerId, ageGroup, observedRating: rating.observedRating, adjustedRating: rating.adjustedRating, verifiedGameCount: rating.verifiedGameCount, starRating: rating.starRating } });
    if (existing) updated += 1; else created += 1;
  }
  const distribution = inputs.reduce<Record<string, number>>((acc, row) => { acc[String(row.starRating)] = (acc[String(row.starRating)] ?? 0) + 1; return acc; }, {});
  console.log(JSON.stringify({ formulaVersionId: formulaVersion.id, totalEligibleGamePerformanceScores: scores.length, totalPlayersProcessed: inputs.length, playerRatingsCreated: created, playerRatingsUpdated: updated, ageGroup, gender, minObservedRating: Math.min(...inputs.map((row) => row.observedRating)), maxObservedRating: Math.max(...inputs.map((row) => row.observedRating)), starDistribution: distribution, verifiedGameCountDistribution: inputs.reduce<Record<string, number>>((acc, row) => { acc[String(row.verifiedGameCount)] = (acc[String(row.verifiedGameCount)] ?? 0) + 1; return acc; }, {}), recommendedTemporaryPublicThreshold: 1, thresholdReason: "Only 3 U16 games are imported; threshold 1 allows test dataset visibility and should be raised when coverage grows.", top10Preview: inputs.sort((a, b) => b.adjustedRating - a.adjustedRating).slice(0, 10) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
