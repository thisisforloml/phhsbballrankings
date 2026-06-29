import { prisma } from "../src/lib/prisma";

async function main() {
  const player = await prisma.player.findFirst({
    where: { displayName: { contains: "Ethan Kaw", mode: "insensitive" }, deletedAt: null },
    include: {
      currentProgram: true,
      rosterSeasons: {
        where: { deletedAt: null },
        include: {
          team: { include: { program: true } },
          season: { include: { league: true } }
        }
      },
      gameStats: {
        where: { deletedAt: null },
        include: { team: { include: { program: true } }, game: { select: { gameDate: true } } },
        orderBy: { game: { gameDate: "desc" } },
        take: 10
      }
    }
  });
  console.log(JSON.stringify(player, null, 2));

  const multiSchool = await prisma.player.findMany({
    where: {
      deletedAt: null,
      currentProgram: { type: "SCHOOL" },
      rosterSeasons: {
        some: {
          deletedAt: null,
          team: { program: { type: "SCHOOL", NOT: { id: prisma.player.fields.currentProgramId } } }
        }
      }
    },
    take: 5,
    select: { displayName: true }
  });
  console.log("\nSample multi-school roster conflicts:", multiSchool);
}

main()
  .finally(() => prisma.$disconnect());
