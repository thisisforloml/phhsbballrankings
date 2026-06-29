/**
 * Read-only audit of Stallion and PYBC league fragmentation.
 */
import { prisma } from "../src/lib/prisma";

async function auditLeagues(label: string, nameFilter: string) {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null, name: { contains: nameFilter, mode: "insensitive" } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: { _count: { select: { games: { where: { deletedAt: null } } } } },
        orderBy: { seasonYear: "asc" }
      }
    },
    orderBy: { name: "asc" }
  });

  console.log(`\n=== ${label} (${leagues.length} active leagues) ===`);
  for (const league of leagues) {
    const games = league.seasons.reduce((sum, s) => sum + s._count.games, 0);
    console.log(`\n${league.name}`);
    console.log(`  id: ${league.id}`);
    console.log(`  ageGroup: ${league.ageGroup}  tier: ${league.tier}`);
    console.log(`  seasons: ${league.seasons.length}  games: ${games}`);
    for (const season of league.seasons) {
      console.log(`    - "${season.name}" (${season.seasonYear}) ${season._count.games} games [${season.id}]`);
    }
  }
}

async function main() {
  await auditLeagues("Stallion (active)", "Stallion");
  await auditLeagues("PYBC (active)", "PYBC");
  await auditLeagues("Philippine Youth (active)", "Philippine Youth");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
