import { backfillAllRostersFromGameStats } from "../src/lib/admin/roster-from-game-evidence";
import { prisma } from "../src/lib/prisma";

const apply = process.argv.includes("--apply");

async function main() {
  if (!apply) {
    const missing = await prisma.player.count({
      where: {
        deletedAt: null,
        gameStats: { some: { deletedAt: null } },
        rosterSeasons: {
          none: {
            deletedAt: null,
            OR: [{ endsOn: null }, { endsOn: { gte: new Date() } }]
          }
        }
      }
    });
    console.log(`Players with game stats but no active roster row: ${missing}`);
    console.log("Re-run with --apply to assign rosters from latest game-stat evidence.");
    return;
  }

  const result = await backfillAllRostersFromGameStats();
  console.log("Roster backfill complete:", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
