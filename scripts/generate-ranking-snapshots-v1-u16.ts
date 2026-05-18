import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getClassYear, getMonthStart, isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U16;
const gender = PlayerGender.BOYS;
const minimumVerifiedGames = 1;

type Row = { playerId: string; displayName: string; adjustedRating: number; verifiedGameCount: number; starRating: number; birthDate: Date | null; classYear: number | null };

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: formulaVersionNumber }, select: { id: true } });
  if (!formulaVersion) throw new Error("Missing FormulaVersion v1.");
  const snapshotDate = getMonthStart(new Date());
  const ratings = await prisma.playerRating.findMany({ where: { ageGroup, verifiedGameCount: { gte: minimumVerifiedGames }, player: { gender, deletedAt: null } }, include: { player: { select: { displayName: true, birthDate: true } } }, orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }] });
  const eligibleByGames: Row[] = ratings.map((rating) => ({ playerId: rating.playerId, displayName: rating.player.displayName, adjustedRating: Number(rating.adjustedRating), verifiedGameCount: rating.verifiedGameCount, starRating: rating.starRating, birthDate: rating.player.birthDate, classYear: getClassYear(rating.player.birthDate) }));
  const excludedByClassYear = eligibleByGames.filter((rating) => !isRankingEligibleByClassYear(rating.birthDate, snapshotDate));
  const excludedIds = new Set(excludedByClassYear.map((rating) => rating.playerId));
  const finalRows = eligibleByGames.filter((rating) => !excludedIds.has(rating.playerId));
  const existing = await prisma.rankingSnapshot.findMany({ where: { scope: RankingScope.NATIONAL, ageGroup, gender, formulaVersionId: formulaVersion.id, weekOf: snapshotDate, city: null, region: null }, select: { id: true } });
  if (existing.length > 1) throw new Error(`Found ${existing.length} U16 Boys snapshots for ${snapshotDate.toISOString()}.`);
  const rows = finalRows.map((rating, index) => ({ playerId: rating.playerId, rank: index + 1, rating: rating.adjustedRating, starRating: rating.starRating, verifiedGameCount: rating.verifiedGameCount, movement: 0 }));
  let action: "created" | "updated" | "skipped" = "skipped";
  let snapshotId: string | null = null;
  if (rows.length) {
    if (existing.length === 1) {
      snapshotId = existing[0].id;
      await prisma.$transaction(async (tx) => { await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId: snapshotId! } }); await tx.rankingSnapshot.update({ where: { id: snapshotId! }, data: { rows: { create: rows } } }); });
      action = "updated";
    } else {
      const snapshot = await prisma.rankingSnapshot.create({ data: { scope: RankingScope.NATIONAL, ageGroup, gender, formulaVersionId: formulaVersion.id, weekOf: snapshotDate, city: null, region: null, rows: { create: rows } }, select: { id: true } });
      snapshotId = snapshot.id;
      action = "created";
    }
  }
  console.log(JSON.stringify({ formulaVersionId: formulaVersion.id, ageGroup, gender, snapshotDate: snapshotDate.toISOString(), eligibilityRule: { minimumVerifiedGames, note: "Temporary U16 launch/test threshold because only 3 games are imported." }, eligibleByGames: eligibleByGames.length, excludedByClassYear: excludedByClassYear.length, missingBirthDate: eligibleByGames.filter((row) => row.birthDate === null).length, rowsCreated: rows.length, snapshotId, action, top10Preview: finalRows.slice(0, 10).map((row, index) => ({ rank: index + 1, playerId: row.playerId, displayName: row.displayName, adjustedRating: row.adjustedRating, verifiedGameCount: row.verifiedGameCount, starRating: row.starRating, classYear: row.classYear })) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
