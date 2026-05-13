import { prisma } from "../src/lib/prisma";

const planPath = "D:\\OnCourt Rankings PH\\scripts\\reports\\approved-player-merge-plan.json";

async function main() {
  const fs = await import("node:fs/promises");
  const plan = JSON.parse(await fs.readFile(planPath, "utf8"));

  const exactNames = ["Mark Jade Dulin", "Mark jade Dulin"];
  const exactPlayers = await prisma.player.findMany({
    where: {
      displayName: {
        in: exactNames
      }
    },
    include: {
      gameStats: {
        select: { id: true }
      },
      performanceScores: {
        select: { id: true }
      },
      currentRatings: {
        select: { id: true }
      },
      rankingRows: {
        select: { id: true }
      }
    },
    orderBy: { displayName: "asc" }
  });

  const dulinPlayers = await prisma.player.findMany({
    where: {
      displayName: {
        contains: "Dulin",
        mode: "insensitive"
      }
    },
    include: {
      gameStats: {
        select: { id: true }
      },
      performanceScores: {
        select: { id: true }
      },
      currentRatings: {
        select: { id: true }
      },
      rankingRows: {
        select: { id: true }
      }
    },
    orderBy: { displayName: "asc" }
  });

  const formatPlayer = (player: typeof dulinPlayers[number]) => ({
    id: player.id,
    displayName: player.displayName,
    firstName: player.firstName,
    lastName: player.lastName,
    gender: player.gender,
    deletedAt: player.deletedAt ? player.deletedAt.toISOString() : null,
    gameStatCount: player.gameStats.length,
    gamePerformanceScoreCount: player.performanceScores.length,
    playerRatingCount: player.currentRatings.length,
    rankingSnapshotRowCount: player.rankingRows.length
  });

  const mergePlanGroup = plan.approvedGroups.find((group: any) =>
    group.canonicalPlayerDisplayName === "Mark Jade Dulin" ||
    group.canonicalPlayerDisplayName === "Mark jade Dulin" ||
    group.duplicatePlayerDisplayNames?.includes("Mark Jade Dulin") ||
    group.duplicatePlayerDisplayNames?.includes("Mark jade Dulin")
  );

  console.log(JSON.stringify({
    exactNamePlayers: exactPlayers.map(formatPlayer),
    caseInsensitiveDulinPlayers: dulinPlayers.map(formatPlayer),
    approvedMergePlanGroup: mergePlanGroup ? {
      groupNumber: mergePlanGroup.groupNumber,
      canonicalPlayerId: mergePlanGroup.canonicalPlayerId,
      canonicalPlayerDisplayName: mergePlanGroup.canonicalPlayerDisplayName,
      duplicatePlayerIds: mergePlanGroup.duplicatePlayerIds,
      duplicatePlayerDisplayNames: mergePlanGroup.duplicatePlayerDisplayNames
    } : null
  }, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });