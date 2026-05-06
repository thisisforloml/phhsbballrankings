import { PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const games = await prisma.game.findMany({
    where: {
      season: {
        league: {
          name: {
            in: ["UAAP Season 88 HS Boys Basketball", "UAAP Season 88 HS Girls Basketball"]
          }
        }
      }
    },
    include: {
      _count: { select: { stats: true } },
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });

  const incomplete = games.filter((game) => game._count.stats < 8);

  for (const game of incomplete) {
    await prisma.game.update({
      where: { id: game.id },
      data: {
        verificationStatus: VerificationStatus.SUBMITTED,
        sourceName: `${game.sourceName} - pending full player stat transcription`
      }
    });
  }

  console.log(`Flagged incomplete games: ${incomplete.length}`);
  for (const game of incomplete) {
    console.log(
      `${game.season.league.name} Game ${game.gameNumber}: ${game.homeTeam.name} ${game.homeScore}-${game.awayScore} ${game.awayTeam.name} (${game._count.stats} player stat rows)`
    );
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
