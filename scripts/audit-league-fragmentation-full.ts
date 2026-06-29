/**
 * Read-only audit of all PYBC/Stallion leagues including soft-deleted.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const leagues = await prisma.league.findMany({
    where: {
      OR: [
        { name: { contains: "PYBC", mode: "insensitive" } },
        { name: { contains: "Philippine Youth", mode: "insensitive" } },
        { name: { contains: "Stallion", mode: "insensitive" } }
      ]
    },
    include: {
      seasons: {
        include: { _count: { select: { games: { where: { deletedAt: null } } } } },
        orderBy: { seasonYear: "asc" }
      }
    },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }]
  });

  for (const league of leagues) {
    const games = league.seasons.filter((s) => !s.deletedAt).reduce((sum, s) => sum + s._count.games, 0);
    console.log(
      `${league.deletedAt ? "[deleted]" : "[active]"} ${league.name} | ${league.ageGroup} | ${games} games | ${league.id}`
    );
    for (const season of league.seasons) {
      if (season.deletedAt) continue;
      console.log(`  "${season.name}" (${season.seasonYear}): ${season._count.games} games`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
