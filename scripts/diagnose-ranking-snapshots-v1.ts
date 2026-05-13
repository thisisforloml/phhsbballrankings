import { prisma } from "../src/lib/prisma";

async function main() {
  const formula = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true, versionNumber: true }
  });

  if (!formula) {
    throw new Error("FormulaVersion v1 not found.");
  }

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: {
      formulaVersionId: formula.id
    },
    include: {
      rows: {
        orderBy: { rank: "asc" },
        include: {
          player: {
            select: { displayName: true }
          }
        }
      }
    },
    orderBy: [
      { weekOf: "asc" },
      { gender: "asc" },
      { createdAt: "asc" }
    ]
  });

  const snapshotReports = snapshots.map((snapshot) => ({
    id: snapshot.id,
    scope: snapshot.scope,
    ageGroup: snapshot.ageGroup,
    gender: snapshot.gender,
    formulaVersionId: snapshot.formulaVersionId,
    weekOf: snapshot.weekOf.toISOString(),
    rowCount: snapshot.rows.length,
    createdAt: snapshot.createdAt.toISOString(),
    top5Rows: snapshot.rows.slice(0, 5).map((row) => ({
      rank: row.rank,
      playerDisplayName: row.player.displayName,
      rating: Number(row.rating),
      starRating: row.starRating,
      verifiedGameCount: row.verifiedGameCount
    }))
  }));

  const grouped = new Map<string, typeof snapshotReports>();
  for (const snapshot of snapshotReports) {
    const key = `${snapshot.weekOf}|${snapshot.gender}`;
    grouped.set(key, [...(grouped.get(key) ?? []), snapshot]);
  }

  console.log(JSON.stringify({
    formulaVersion: formula,
    totalSnapshots: snapshots.length,
    snapshots: snapshotReports,
    groupedByWeekOfAndGender: Array.from(grouped.entries()).map(([key, items]) => {
      const [weekOf, gender] = key.split("|");
      return {
        weekOf,
        gender,
        count: items.length,
        snapshotIds: items.map((item) => item.id)
      };
    })
  }, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });