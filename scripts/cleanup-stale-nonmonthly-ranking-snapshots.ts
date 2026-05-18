import { prisma } from "../src/lib/prisma";

const staleSnapshotIds = [
  "da5d3383-b708-4a53-b244-d8f5ea287778",
  "9e9c491b-97f8-43fa-92a4-7cd5d0db3fbb"
];

const protectedMonthlySnapshotIds = new Set([
  "0e7cf39c-b67c-4c3a-8f10-08ab801a8734",
  "c4b062ad-015f-4ce4-9beb-4d55058b224b"
]);

async function main() {
  const staleSnapshots = await prisma.rankingSnapshot.findMany({
    where: {
      id: {
        in: staleSnapshotIds
      }
    },
    select: {
      id: true,
      gender: true,
      weekOf: true,
      formulaVersion: {
        select: {
          versionNumber: true
        }
      },
      _count: {
        select: {
          rows: true
        }
      }
    }
  });

  if (staleSnapshots.length !== staleSnapshotIds.length) {
    throw new Error(`Expected ${staleSnapshotIds.length} stale snapshots, found ${staleSnapshots.length}.`);
  }

  for (const snapshot of staleSnapshots) {
    if (protectedMonthlySnapshotIds.has(snapshot.id)) {
      throw new Error(`Refusing to delete protected monthly snapshot ${snapshot.id}.`);
    }

    if (snapshot.formulaVersion.versionNumber !== 1) {
      throw new Error(`Snapshot ${snapshot.id} is not Formula v1.`);
    }

    if (snapshot.weekOf.toISOString() !== "2026-05-17T00:00:00.000Z") {
      throw new Error(`Snapshot ${snapshot.id} is not a May 17 stale snapshot.`);
    }
  }

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

    return {
      rowsDeleted: rowsDeleted.count,
      snapshotsDeleted: snapshotsDeleted.count
    };
  });

  const remainingSnapshots = await prisma.rankingSnapshot.findMany({
    where: {
      formulaVersion: {
        versionNumber: 1
      },
      ageGroup: "U19",
      scope: "NATIONAL",
      city: null,
      region: null
    },
    select: {
      id: true,
      gender: true,
      weekOf: true,
      _count: {
        select: {
          rows: true
        }
      }
    },
    orderBy: [
      { weekOf: "asc" },
      { gender: "asc" }
    ]
  });

  console.log(JSON.stringify({
    staleSnapshotIds,
    rowsDeleted: result.rowsDeleted,
    snapshotsDeleted: result.snapshotsDeleted,
    remainingSnapshots: remainingSnapshots.map((snapshot) => ({
      id: snapshot.id,
      gender: snapshot.gender,
      weekOf: snapshot.weekOf.toISOString(),
      rowCount: snapshot._count.rows
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
