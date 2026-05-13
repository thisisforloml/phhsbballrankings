import { prisma } from "../src/lib/prisma";

const staleSnapshotIds = [
  "e8c7b4ba-53fd-47f3-8518-1068971eaf8f",
  "9416e5ab-f753-4333-9cd1-2d4dfdb4dfb6"
];

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const rowsDeleted = await tx.rankingSnapshotRow.deleteMany({
      where: {
        snapshotId: {
          in: staleSnapshotIds
        }
      }
    });

    const snapshotsDeleted = await tx.rankingSnapshot.deleteMany({
      where: {
        id: {
          in: staleSnapshotIds
        }
      }
    });

    const remainingSnapshots = await tx.rankingSnapshot.findMany({
      select: {
        id: true,
        weekOf: true,
        gender: true,
        ageGroup: true,
        scope: true,
        rows: {
          select: {
            id: true
          }
        }
      },
      orderBy: [
        { weekOf: "asc" },
        { gender: "asc" },
        { createdAt: "asc" }
      ]
    });

    return {
      rowsDeleted: rowsDeleted.count,
      snapshotsDeleted: snapshotsDeleted.count,
      remainingSnapshots
    };
  });

  console.log(JSON.stringify({
    staleSnapshotIds,
    rowsDeleted: result.rowsDeleted,
    snapshotsDeleted: result.snapshotsDeleted,
    remainingSnapshots: result.remainingSnapshots.map((snapshot) => ({
      id: snapshot.id,
      weekOf: snapshot.weekOf.toISOString(),
      gender: snapshot.gender,
      ageGroup: snapshot.ageGroup,
      scope: snapshot.scope,
      rowCount: snapshot.rows.length
    }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });