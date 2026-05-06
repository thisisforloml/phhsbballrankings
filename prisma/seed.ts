import { PrismaClient, UserRole } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

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

  await prisma.user.create({
    data: {
      name: "Darwin Owner",
      username: "DarwinOwner",
      email: "owner@oncourt.local",
      passwordHash: passwordHash("DarwinRanks"),
      role: UserRole.ADMIN
    }
  });

  await prisma.formulaVersion.create({
    data: {
      versionNumber: 1,
      description: "Theoretically motivated internal pre-launch weights.",
      isPublic: false,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      weights: {
        points: 1,
        assists: 1.35,
        rebounds: 0.9,
        turnovers: -1.15,
        leagueMultipliers: {
          tier1: 1,
          tier2: 1.1,
          tier3: 1.25,
          tier4: 1.4
        }
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
