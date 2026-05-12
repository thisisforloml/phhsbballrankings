import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearSeedData() {
  await prisma.auditLog.deleteMany();
  await prisma.rankingSnapshotRow.deleteMany();
  await prisma.rankingSnapshot.deleteMany();
  await prisma.playerRating.deleteMany();
  await prisma.teamRating.deleteMany();
  await prisma.gamePerformanceScore.deleteMany();
  await prisma.gameStat.deleteMany();
  await prisma.game.deleteMany();
  await prisma.playerTeamSeason.deleteMany();
  await prisma.userLeagueAccess.deleteMany();
  await prisma.formulaVersion.deleteMany();
  await prisma.season.deleteMany();
  await prisma.league.deleteMany();
  await prisma.team.deleteMany();
  await prisma.player.deleteMany();
  await prisma.playerProfileSubmission.deleteMany();
  await prisma.organizerApplication.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearSeedData();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
