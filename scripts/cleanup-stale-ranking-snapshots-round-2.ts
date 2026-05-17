import { AgeGroup, PrismaClient, RankingScope } from "@prisma/client";

const prisma = new PrismaClient();

const staleSnapshotIds = [
  "a9a8f50c-f563-4151-b2cf-ab8cd14fb9f1",
  "fd9079ea-cc8e-43ac-bbed-b8303e22e511"
];

const protectedSnapshotIds = [
  "da5d3383-b708-4a53-b244-d8f5ea287778",
  "9e9c491b-97f8-43fa-92a4-7cd5d0db3fbb"
];

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });

  if (!formulaVersion) {
    throw new Error("FormulaVersion versionNumber 1 was not found.");
  }

  const staleSnapshots = await prisma.rankingSnapshot.findMany({
    where: { id: { in: staleSnapshotIds } },
    select: {
      id: true,
      formulaVersionId: true,
      scope: true,
      ageGroup: true,
      weekOf: true
    }
  });

  if (staleSnapshots.length !== staleSnapshotIds.length) {
    throw new Error(`Expected ${staleSnapshotIds.length} stale snapshots, found ${staleSnapshots.length}.`);
  }

  for (const snapshot of staleSnapshots) {
    if (
      snapshot.formulaVersionId !== formulaVersion.id ||
      snapshot.scope !== RankingScope.NATIONAL ||
      snapshot.ageGroup !== AgeGroup.U19 ||
      snapshot.weekOf.toISOString() !== "2026-05-13T00:00:00.000Z"
    ) {
      throw new Error(`Snapshot ${snapshot.id} does not match the expected stale Formula v1 U19 NATIONAL May 13 scope.`);
    }
  }

  if (staleSnapshotIds.some((id) => protectedSnapshotIds.includes(id))) {
    throw new Error("A protected May 17 snapshot ID was included in staleSnapshotIds.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const rowsDeleted = await tx.rankingSnapshotRow.deleteMany({
      where: { snapshotId: { in: staleSnapshotIds } }
    });

    const snapshotsDeleted = await tx.rankingSnapshot.deleteMany({
      where: { id: { in: staleSnapshotIds } }
    });

    return {
      rowsDeleted: rowsDeleted.count,
      snapshotsDeleted: snapshotsDeleted.count
    };
  });

  const remainingSnapshots = await prisma.rankingSnapshot.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      scope: RankingScope.NATIONAL,
      ageGroup: AgeGroup.U19
    },
    orderBy: [{ weekOf: "asc" }, { gender: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      gender: true,
      weekOf: true,
      createdAt: true,
      _count: { select: { rows: true } }
    }
  });

  console.log(
    JSON.stringify(
      {
        staleSnapshotIds,
        rowsDeleted: result.rowsDeleted,
        snapshotsDeleted: result.snapshotsDeleted,
        remainingSnapshots: remainingSnapshots.map((snapshot) => ({
          id: snapshot.id,
          gender: snapshot.gender,
          weekOf: snapshot.weekOf.toISOString(),
          rowCount: snapshot._count.rows,
          createdAt: snapshot.createdAt.toISOString()
        }))
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
