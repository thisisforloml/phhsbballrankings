import { prisma } from "../src/lib/prisma";

async function audit(namePart: string) {
  const players = await prisma.player.findMany({
    where: { deletedAt: null, displayName: { contains: namePart, mode: "insensitive" } },
    select: {
      id: true,
      displayName: true,
      currentProgramId: true,
      currentProgram: { select: { fullName: true } },
      rosterSeasons: {
        where: { deletedAt: null, OR: [{ endsOn: null }, { endsOn: { gte: new Date() } }] },
        select: {
          team: { select: { name: true, program: { select: { fullName: true } } } },
          season: { select: { name: true, league: { select: { name: true } } } },
          startsOn: true,
          endsOn: true,
          adminOverride: true
        }
      },
      programHistory: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          effectiveDate: true,
          changeType: true,
          note: true,
          fromProgram: { select: { fullName: true } },
          toProgram: { select: { fullName: true } }
        }
      },
      gameStats: {
        where: { deletedAt: null },
        take: 3,
        orderBy: { game: { gameDate: "desc" } },
        select: {
          team: { select: { name: true, program: { select: { fullName: true } } } },
          game: { select: { gameDate: true } }
        }
      }
    }
  });
  console.log(`\n=== ${namePart} ===`);
  console.log(JSON.stringify(players, null, 2));
}

async function main() {
  await audit("Bench Copada");
  await audit("Eoin Braga");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
