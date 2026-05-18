import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getMonthStart, isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U16;
const gender = PlayerGender.BOYS;
const minimumVerifiedGames = 1;
function isMonthStart(date: Date) { return date.getTime() === getMonthStart(date).getTime(); }
async function main() {
  const issues: string[] = [];
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: formulaVersionNumber }, select: { id: true } });
  if (!formulaVersion) throw new Error("Missing FormulaVersion v1.");
  const snapshots = await prisma.rankingSnapshot.findMany({ where: { scope: RankingScope.NATIONAL, ageGroup, gender, formulaVersionId: formulaVersion.id, city: null, region: null }, include: { rows: { include: { player: { select: { displayName: true, birthDate: true } } }, orderBy: { rank: "asc" } } }, orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }] });
  const latest = snapshots.find((snapshot) => isMonthStart(snapshot.weekOf)) ?? null;
  if (!latest) throw new Error("Missing latest monthly U16 Boys snapshot.");
  const expectedRatings = await prisma.playerRating.findMany({ where: { ageGroup, verifiedGameCount: { gte: minimumVerifiedGames }, player: { gender, deletedAt: null } }, include: { player: { select: { displayName: true, birthDate: true } } }, orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }] });
  const eligible = expectedRatings.filter((rating) => isRankingEligibleByClassYear(rating.player.birthDate, latest.weekOf));
  if (latest.rows.length !== eligible.length) issues.push(`Expected ${eligible.length} rows, found ${latest.rows.length}.`);
  const expectedByPlayer = new Map(eligible.map((rating, index) => [rating.playerId, { rating, rank: index + 1 }]));
  let prev: number | null = null;
  const ranks = new Set<number>(), players = new Set<string>();
  for (const row of latest.rows) {
    const expected = expectedByPlayer.get(row.playerId);
    const actualRating = Number(row.rating);
    if (!expected) issues.push(`${row.player.displayName} is not expected eligible.`);
    if (ranks.has(row.rank)) issues.push(`Duplicate rank ${row.rank}.`);
    ranks.add(row.rank);
    if (players.has(row.playerId)) issues.push(`Duplicate player ${row.playerId}.`);
    players.add(row.playerId);
    if (prev !== null && actualRating > prev) issues.push("Rows are not sorted by rating desc.");
    prev = actualRating;
    if (!isRankingEligibleByClassYear(row.player.birthDate, latest.weekOf)) issues.push(`${row.player.displayName} is class-year ineligible.`);
    if (expected) {
      if (row.rank !== expected.rank) issues.push(`${row.player.displayName} expected rank ${expected.rank}, found ${row.rank}.`);
      if (Math.abs(actualRating - Number(expected.rating.adjustedRating)) > 0.01) issues.push(`${row.player.displayName} rating mismatch.`);
      if (row.starRating !== expected.rating.starRating) issues.push(`${row.player.displayName} star mismatch.`);
      if (row.verifiedGameCount !== expected.rating.verifiedGameCount) issues.push(`${row.player.displayName} game count mismatch.`);
    }
  }
  for (let rank = 1; rank <= latest.rows.length; rank += 1) if (!ranks.has(rank)) issues.push(`Missing rank ${rank}.`);
  console.log(JSON.stringify({ formulaVersionId: formulaVersion.id, totalHistoricalU16BoysSnapshots: snapshots.length, latestSnapshotId: latest.id, weekOf: latest.weekOf.toISOString(), isMonthlySnapshot: isMonthStart(latest.weekOf), rowsChecked: latest.rows.length, expectedRows: eligible.length, missingBirthDate: eligible.filter((rating) => rating.player.birthDate === null).length, threshold: minimumVerifiedGames, top10Preview: latest.rows.slice(0, 10).map((row) => ({ rank: row.rank, displayName: row.player.displayName, rating: Number(row.rating), starRating: row.starRating, verifiedGameCount: row.verifiedGameCount, classYear: getClassYear(row.player.birthDate) })), issues, validationPassed: issues.length === 0 }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
