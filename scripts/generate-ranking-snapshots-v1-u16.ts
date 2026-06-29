import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { buildSnapshotBoardRows } from "../src/lib/snapshot-board-rows";
import { prisma } from "../src/lib/prisma";
import { getMonthStart } from "../src/lib/ranking-eligibility";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U16;
const gender = PlayerGender.BOYS;

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: formulaVersionNumber }, select: { id: true } });
  if (!formulaVersion) throw new Error("Missing FormulaVersion v1.");

  const snapshotDate = getMonthStart(new Date());
  const built = await buildSnapshotBoardRows({
    ageGroup,
    gender,
    evaluationDate: snapshotDate,
    formulaVersionId: formulaVersion.id
  });

  const existing = await prisma.rankingSnapshot.findMany({
    where: { scope: RankingScope.NATIONAL, ageGroup, gender, formulaVersionId: formulaVersion.id, weekOf: snapshotDate, city: null, region: null },
    select: { id: true }
  });
  if (existing.length > 1) throw new Error(`Found ${existing.length} U16 Boys snapshots for ${snapshotDate.toISOString()}.`);

  const rows = built.rows.map((row) => ({
    playerId: row.playerId,
    rank: row.rank,
    rating: row.rating,
    starRating: row.starRating,
    verifiedGameCount: row.verifiedGameCount,
    movement: row.movement,
    ageVerificationStatus: row.ageVerificationStatus
  }));

  let action: "created" | "updated" | "skipped" = "skipped";
  let snapshotId: string | null = null;
  if (rows.length) {
    if (existing.length === 1) {
      snapshotId = existing[0].id;
      await prisma.$transaction(async (tx) => {
        await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId: snapshotId! } });
        await tx.rankingSnapshot.update({ where: { id: snapshotId! }, data: { rows: { create: rows } } });
      });
      action = "updated";
    } else {
      const snapshot = await prisma.rankingSnapshot.create({
        data: {
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender,
          formulaVersionId: formulaVersion.id,
          weekOf: snapshotDate,
          city: null,
          region: null,
          rows: { create: rows }
        },
        select: { id: true }
      });
      snapshotId = snapshot.id;
      action = "created";
    }
  }

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion.id,
        ageGroup,
        gender,
        snapshotDate: snapshotDate.toISOString(),
        snapshotPolicy: "rev-2-public-rank-allowed",
        poolAtThreshold: built.poolAtThreshold,
        excludedByVisibility: built.excludedByVisibility,
        verifiedCount: built.verifiedCount,
        pendingCount: built.pendingCount,
        rowsCreated: rows.length,
        snapshotId,
        action,
        top10Preview: built.rows.slice(0, 10)
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
