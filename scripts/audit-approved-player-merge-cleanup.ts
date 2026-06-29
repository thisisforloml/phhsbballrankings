import { prisma } from "../src/lib/prisma";

const planPath = "D:\\Peach Basket\\scripts\\reports\\approved-player-merge-plan.json";
const formulaVersionNumber = 1;

type ApprovedGroup = {
  groupNumber: number;
  canonicalPlayerId: string;
  canonicalPlayerDisplayName: string;
  duplicatePlayerIds: string[];
  duplicatePlayerDisplayNames: string[];
  approved: boolean;
};

type ApprovedPlan = {
  approvedGroups: ApprovedGroup[];
};

async function main() {
  const fs = await import("node:fs/promises");
  const plan = JSON.parse(await fs.readFile(planPath, "utf8")) as ApprovedPlan;
  const approvedGroups = plan.approvedGroups.filter((group) => group.approved);
  const duplicateIds = Array.from(new Set(approvedGroups.flatMap((group) => group.duplicatePlayerIds)));
  const duplicateNames = Array.from(new Set(approvedGroups.flatMap((group) => group.duplicatePlayerDisplayNames)));
  const canonicalIds = Array.from(new Set(approvedGroups.map((group) => group.canonicalPlayerId)));

  const duplicatePlayers = await prisma.player.findMany({
    where: { id: { in: duplicateIds } },
    select: { id: true, displayName: true, deletedAt: true }
  });
  const duplicateById = new Map(duplicatePlayers.map((player) => [player.id, player]));
  const duplicatePlayersNotSoftDeleted = duplicateIds
    .map((id) => duplicateById.get(id))
    .filter((player) => !player || player.deletedAt === null)
    .map((player, index) => player ? { id: player.id, displayName: player.displayName, deletedAt: null } : { id: duplicateIds[index], displayName: null, deletedAt: null });

  const canonicalPlayers = await prisma.player.findMany({
    where: { id: { in: canonicalIds } },
    select: { id: true, displayName: true, deletedAt: true }
  });
  const canonicalById = new Map(canonicalPlayers.map((player) => [player.id, player]));
  const canonicalPlayersInactive = canonicalIds
    .map((id) => canonicalById.get(id))
    .filter((player) => !player || player.deletedAt !== null)
    .map((player, index) => player ? { id: player.id, displayName: player.displayName, deletedAt: player.deletedAt?.toISOString() ?? null } : { id: canonicalIds[index], displayName: null, deletedAt: null });

  const activeDuplicateNamesRemaining = await prisma.player.findMany({
    where: {
      id: { in: duplicateIds },
      deletedAt: null
    },
    select: { id: true, displayName: true, gender: true }
  });

  const lingeringDuplicateGameStats = await prisma.gameStat.findMany({
    where: { playerId: { in: duplicateIds } },
    select: { id: true, gameId: true, playerId: true }
  });

  const lingeringDuplicatePerformanceScores = await prisma.gamePerformanceScore.findMany({
    where: {
      playerId: { in: duplicateIds },
      formulaVersion: { versionNumber: formulaVersionNumber }
    },
    select: { id: true, gameStatId: true, playerId: true }
  });

  const duplicatePlayerRatingsRemaining = await prisma.playerRating.findMany({
    where: { playerId: { in: duplicateIds } },
    select: { id: true, playerId: true, ageGroup: true }
  });

  const duplicateSnapshotRowsRemaining = await prisma.rankingSnapshotRow.findMany({
    where: { playerId: { in: duplicateIds } },
    select: { id: true, snapshotId: true, playerId: true, rank: true }
  });

  const qMolinaPlayers = await prisma.player.findMany({
    where: {
      displayName: { in: ["Q. Molina", "Q Molina"] }
    },
    include: {
      gameStats: { select: { id: true } },
      currentRatings: { select: { id: true } }
    },
    orderBy: { displayName: "asc" }
  });

  const qMolinaUntouched = qMolinaPlayers.some((player) =>
    player.displayName === "Q. Molina" && player.deletedAt === null && player.gameStats.length > 0
  ) && qMolinaPlayers.every((player) => !duplicateIds.includes(player.id));

  const summary = {
    approvedGroupsChecked: approvedGroups.length,
    duplicatePlayersSoftDeleted: duplicatePlayers.filter((player) => player.deletedAt !== null).length,
    canonicalPlayersActive: canonicalPlayers.filter((player) => player.deletedAt === null).length,
    activeDuplicateNamesRemaining: activeDuplicateNamesRemaining.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      gender: player.gender
    })),
    gameStatReassignmentIssues: lingeringDuplicateGameStats,
    gamePerformanceScoreReassignmentIssues: lingeringDuplicatePerformanceScores,
    duplicatePlayerRatingsRemaining,
    duplicateSnapshotRowsRemaining,
    qMolinaUntouched,
    qMolinaPlayers: qMolinaPlayers.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      deletedAt: player.deletedAt ? player.deletedAt.toISOString() : null,
      gameStatCount: player.gameStats.length,
      playerRatingCount: player.currentRatings.length
    })),
    duplicatePlayersNotSoftDeleted,
    canonicalPlayersInactive,
    validationPassed:
      duplicatePlayersNotSoftDeleted.length === 0 &&
      canonicalPlayersInactive.length === 0 &&
      activeDuplicateNamesRemaining.length === 0 &&
      lingeringDuplicateGameStats.length === 0 &&
      lingeringDuplicatePerformanceScores.length === 0 &&
      duplicatePlayerRatingsRemaining.length === 0 &&
      duplicateSnapshotRowsRemaining.length === 0 &&
      qMolinaUntouched
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });