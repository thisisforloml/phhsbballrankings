import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.rankingSnapshotRow.deleteMany();
  await prisma.rankingSnapshot.deleteMany();
  await prisma.playerRating.deleteMany();
  await prisma.gamePerformanceScore.deleteMany();
  await prisma.gameStat.deleteMany();
  await prisma.playerTeamSeason.deleteMany();
  await prisma.playerProfileSubmission.deleteMany();
  await prisma.player.deleteMany();

  console.log("Cleared player profiles, player stats, ratings, rankings, and profile submissions.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
