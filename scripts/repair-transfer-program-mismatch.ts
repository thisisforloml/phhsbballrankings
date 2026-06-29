/**
 * Repair players whose school transfer was undone by roster backfill.
 * Dry-run by default; pass --apply to write.
 */
import { prisma } from "../src/lib/prisma";

const apply = process.argv.includes("--apply");

async function main() {
  const mismatches = await prisma.playerProgramHistory.findMany({
    where: { changeType: "TRANSFER", toProgramId: { not: null } },
    orderBy: { createdAt: "desc" },
    distinct: ["playerId"],
    select: {
      playerId: true,
      effectiveDate: true,
      toProgramId: true,
      toProgram: { select: { fullName: true } },
      player: {
        select: {
          displayName: true,
          currentProgramId: true,
          currentProgram: { select: { fullName: true } }
        }
      }
    }
  });

  const needsRepair = mismatches.filter(
    (row) => row.toProgramId && row.player.currentProgramId !== row.toProgramId
  );

  console.log(`Transfers with currentProgram mismatch: ${needsRepair.length}`);
  for (const row of needsRepair) {
    console.log(`- ${row.player.displayName}: current=${row.player.currentProgram?.fullName ?? "none"} should be ${row.toProgram?.fullName}`);
  }

  if (!apply) {
    console.log("\nRe-run with --apply to fix currentProgramId and end stale roster rows.");
    return;
  }

  let repaired = 0;
  for (const row of needsRepair) {
    if (!row.toProgramId || !row.effectiveDate) continue;

    const activeOtherRosters = await prisma.playerTeamSeason.findMany({
      where: {
        playerId: row.playerId,
        deletedAt: null,
        OR: [{ endsOn: null }, { endsOn: { gt: row.effectiveDate } }],
        team: { programId: { not: row.toProgramId } }
      },
      select: { id: true }
    });

    await prisma.$transaction([
      prisma.player.update({
        where: { id: row.playerId },
        data: { currentProgramId: row.toProgramId }
      }),
      ...activeOtherRosters.map((roster) =>
        prisma.playerTeamSeason.update({
          where: { id: roster.id },
          data: { endsOn: row.effectiveDate }
        })
      )
    ]);
    repaired += 1;
  }

  console.log(`Repaired ${repaired} player(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
