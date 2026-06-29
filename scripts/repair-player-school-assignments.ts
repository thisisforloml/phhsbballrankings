/**
 * Repair players whose currentProgramId points to a club/team instead of their school.
 * Dry-run by default. Pass --apply to execute.
 */
import { ProgramType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { inferSchoolProgramIdFromEvidence } from "../src/lib/player-display-affiliation";

const apply = process.argv.includes("--apply");

async function main() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      currentProgramId: true,
      currentProgram: { select: { id: true, fullName: true, type: true } },
      gameStats: {
        where: { deletedAt: null },
        select: { team: { select: { program: { select: { id: true, fullName: true, type: true } } } } }
      },
      rosterSeasons: {
        where: { deletedAt: null },
        select: { team: { select: { program: { select: { id: true, fullName: true, type: true } } } } }
      }
    },
    orderBy: { displayName: "asc" }
  });

  const repairs: Array<{
    id: string;
    displayName: string;
    from: string;
    to: string;
    schoolProgramId: string;
  }> = [];

  const clears: Array<{ id: string; displayName: string; from: string }> = [];

  for (const player of players) {
    const currentType = player.currentProgram?.type ?? null;
    if (currentType === ProgramType.SCHOOL) continue;

    const schoolProgramId = inferSchoolProgramIdFromEvidence({
      gameStats: player.gameStats,
      rosterSeasons: player.rosterSeasons
    });

    if (schoolProgramId) {
      const school = await prisma.program.findUnique({
        where: { id: schoolProgramId },
        select: { fullName: true }
      });
      repairs.push({
        id: player.id,
        displayName: player.displayName,
        from: player.currentProgram?.fullName ?? "(none)",
        to: school?.fullName ?? schoolProgramId,
        schoolProgramId
      });
      continue;
    }

    if (player.currentProgramId) {
      clears.push({
        id: player.id,
        displayName: player.displayName,
        from: player.currentProgram?.fullName ?? player.currentProgramId
      });
    }
  }

  console.log(`=== Repair player school assignments ===\n`);
  console.log(`Set school program: ${repairs.length}`);
  for (const row of repairs) {
    console.log(`  ${row.displayName}: ${row.from} → ${row.to}`);
  }
  console.log(`\nClear non-school currentProgram with no school evidence: ${clears.length}`);
  for (const row of clears) {
    console.log(`  ${row.displayName}: clear ${row.from}`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to execute.");
    return;
  }

  for (const row of repairs) {
    await prisma.player.update({
      where: { id: row.id },
      data: { currentProgramId: row.schoolProgramId }
    });
  }

  for (const row of clears) {
    await prisma.player.update({
      where: { id: row.id },
      data: { currentProgramId: null }
    });
  }

  console.log(`\nApplied ${repairs.length} school repairs and ${clears.length} clears.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
