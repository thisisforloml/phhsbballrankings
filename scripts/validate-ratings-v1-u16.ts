import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const formulaVersionNumber = 1;
const expectedGameStats = 79;
const ageGroup = AgeGroup.U16;
const gender = PlayerGender.BOYS;
const leagueName = "UAAP Season 88 16U Boys Basketball";
const seasonName = "Season 88";
function expectedStar(value: number) { if (value >= 90) return 5; if (value >= 80) return 4; if (value >= 70) return 3; if (value >= 60) return 2; return 1; }
async function main() {
  const issues: string[] = [];
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: formulaVersionNumber }, select: { id: true } });
  if (!formulaVersion) throw new Error("Missing FormulaVersion v1.");
  const league = await prisma.league.findFirst({ where: { name: leagueName, ageGroup, deletedAt: null }, select: { id: true } });
  if (!league) throw new Error(`Missing ${leagueName}.`);
  const season = await prisma.season.findUnique({ where: { leagueId_name: { leagueId: league.id, name: seasonName } }, select: { id: true, deletedAt: true } });
  if (!season || season.deletedAt) throw new Error(`Missing active ${seasonName}.`);
  const gameStats = await prisma.gameStat.findMany({ where: { deletedAt: null, game: { seasonId: season.id, deletedAt: null }, player: { gender, deletedAt: null } }, include: { player: { select: { displayName: true } } } });
  const scores = await prisma.gamePerformanceScore.findMany({ where: { formulaVersionId: formulaVersion.id, deletedAt: null, game: { seasonId: season.id, deletedAt: null }, player: { gender, deletedAt: null } } });
  if (gameStats.length !== expectedGameStats) issues.push(`Expected ${expectedGameStats} GameStats, found ${gameStats.length}.`);
  if (scores.length !== expectedGameStats) issues.push(`Expected ${expectedGameStats} GamePerformanceScores, found ${scores.length}.`);
  const scoreByGameStat = new Map(scores.map((score) => [score.gameStatId, score]));
  for (const stat of gameStats) if (!scoreByGameStat.has(stat.id)) issues.push(`Missing GamePerformanceScore for ${stat.player.displayName} / ${stat.id}.`);
  const countsByPlayer = new Map<string, number>();
  for (const score of scores) countsByPlayer.set(score.playerId, (countsByPlayer.get(score.playerId) ?? 0) + 1);
  const missingPlayerRatings: Array<{ playerId: string; expected: number }> = [];
  const invalidRatings: string[] = [];
  for (const [playerId, count] of countsByPlayer) {
    const rating = await prisma.playerRating.findUnique({ where: { playerId_ageGroup: { playerId, ageGroup } }, select: { observedRating: true, adjustedRating: true, verifiedGameCount: true, starRating: true } });
    if (!rating) { missingPlayerRatings.push({ playerId, expected: count }); continue; }
    const observed = Number(rating.observedRating), adjusted = Number(rating.adjustedRating);
    if (rating.verifiedGameCount !== count) invalidRatings.push(`${playerId} verifiedGameCount expected ${count}, found ${rating.verifiedGameCount}.`);
    if (observed < 1 || observed > 100 || adjusted < 1 || adjusted > 100) invalidRatings.push(`${playerId} rating out of range.`);
    if (rating.starRating !== expectedStar(adjusted)) invalidRatings.push(`${playerId} star expected ${expectedStar(adjusted)}, found ${rating.starRating}.`);
  }
  console.log(JSON.stringify({ formulaVersionId: formulaVersion.id, expectedGameStats: gameStats.length, gamePerformanceScoresChecked: scores.length, playersChecked: countsByPlayer.size, missingPlayerRatings, invalidRatings, issues, validationPassed: issues.length === 0 && missingPlayerRatings.length === 0 && invalidRatings.length === 0 }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
