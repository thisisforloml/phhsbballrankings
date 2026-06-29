import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { buildSnapshotBoardRows } from "../src/lib/snapshot-board-rows";
import { prisma } from "../src/lib/prisma";
import { getMonthStart } from "../src/lib/ranking-eligibility";

const formulaVersionNumber = 1;
const ageGroup = AgeGroup.U19;

type SnapshotResult = {
  gender: PlayerGender;
  snapshotId: string | null;
  rowsCreated: number;
  action: "created" | "updated" | "skipped";
  reason?: string;
  verifiedCount?: number;
  pendingCount?: number;
};

async function createOrUpdateSnapshotForGender(params: {
  gender: PlayerGender;
  formulaVersionId: string;
  snapshotDate: Date;
}): Promise<SnapshotResult> {
  const built = await buildSnapshotBoardRows({
    ageGroup,
    gender: params.gender,
    evaluationDate: params.snapshotDate,
    formulaVersionId: params.formulaVersionId
  });

  if (built.rows.length === 0) {
    return {
      gender: params.gender,
      snapshotId: null,
      rowsCreated: 0,
      action: "skipped",
      reason: "No snapshot-visible players.",
      verifiedCount: 0,
      pendingCount: 0
    };
  }

  const existingSnapshots = await prisma.rankingSnapshot.findMany({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      weekOf: params.snapshotDate,
      city: null,
      region: null
    },
    select: { id: true }
  });

  if (existingSnapshots.length > 1) {
    throw new Error(`Found ${existingSnapshots.length} existing ${params.gender} snapshots for Formula v1 / ${ageGroup} / ${params.snapshotDate.toISOString()}.`);
  }

  const rows = built.rows.map((row) => ({
    playerId: row.playerId,
    rank: row.rank,
    rating: row.rating,
    starRating: row.starRating,
    verifiedGameCount: row.verifiedGameCount,
    movement: row.movement,
    ageVerificationStatus: row.ageVerificationStatus
  }));

  if (existingSnapshots.length === 1) {
    const snapshotId = existingSnapshots[0].id;
    const updatedSnapshot = await prisma.$transaction(async (tx) => {
      await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId } });
      return tx.rankingSnapshot.update({
        where: { id: snapshotId },
        data: {
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender: params.gender,
          formulaVersionId: params.formulaVersionId,
          city: null,
          region: null,
          weekOf: params.snapshotDate,
          rows: { create: rows }
        },
        select: { id: true, rows: { select: { id: true } } }
      });
    });

    return {
      gender: params.gender,
      snapshotId: updatedSnapshot.id,
      rowsCreated: updatedSnapshot.rows.length,
      action: "updated",
      verifiedCount: built.verifiedCount,
      pendingCount: built.pendingCount
    };
  }

  const snapshot = await prisma.rankingSnapshot.create({
    data: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender: params.gender,
      formulaVersionId: params.formulaVersionId,
      city: null,
      region: null,
      weekOf: params.snapshotDate,
      rows: { create: rows }
    },
    select: { id: true, rows: { select: { id: true } } }
  });

  return {
    gender: params.gender,
    snapshotId: snapshot.id,
    rowsCreated: snapshot.rows.length,
    action: "created",
    verifiedCount: built.verifiedCount,
    pendingCount: built.pendingCount
  };
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: formulaVersionNumber },
    select: { id: true }
  });

  if (!formulaVersion) throw new Error(`Missing FormulaVersion versionNumber ${formulaVersionNumber}.`);

  const snapshotDate = getMonthStart(new Date());
  const boysResult = await createOrUpdateSnapshotForGender({
    gender: PlayerGender.BOYS,
    formulaVersionId: formulaVersion.id,
    snapshotDate
  });
  const girlsResult = await createOrUpdateSnapshotForGender({
    gender: PlayerGender.GIRLS,
    formulaVersionId: formulaVersion.id,
    snapshotDate
  });

  console.log(
    JSON.stringify(
      {
        formulaVersionId: formulaVersion.id,
        ageGroup,
        snapshotDate: snapshotDate.toISOString(),
        snapshotPolicy: "rev-2-public-rank-allowed",
        snapshotsCreated: [boysResult, girlsResult].filter((result) => result.action === "created"),
        snapshotsUpdated: [boysResult, girlsResult].filter((result) => result.action === "updated"),
        snapshotsSkipped: [boysResult, girlsResult].filter((result) => result.action === "skipped")
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
  .finally(async () => {
    await prisma.$disconnect();
  });
