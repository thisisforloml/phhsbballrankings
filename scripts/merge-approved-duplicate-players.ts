import { prisma } from "../src/lib/prisma";

const planPath = "D:\\Peach Basket\\scripts\\reports\\approved-player-merge-plan.json";

type ApprovedMergeGroup = {
  groupNumber: number;
  canonicalPlayerId: string;
  canonicalPlayerDisplayName: string;
  duplicatePlayerIds: string[];
  duplicatePlayerDisplayNames: string[];
  approved: boolean;
  reason: string;
  sameGameConflict: boolean;
};

type ApprovedMergePlan = {
  approvedGroups: ApprovedMergeGroup[];
  excludedGroups?: Array<{
    groupNumber: number;
    recommendedCanonicalPlayer: string;
    suspectedNames: string[];
    reasons: string[];
  }>;
};

type MergeSummary = {
  qMolinaExcluded: boolean;
  groupsProcessed: number;
  duplicatePlayersSoftDeleted: number;
  gameStatsReassigned: number;
  gamePerformanceScoresReassigned: number;
  playerRatingsDeleted: number;
  rankingSnapshotRowsDeleted: number;
  skippedGroups: Array<{ groupNumber: number; reason: string }>;
  errors: string[];
};

async function readPlan(): Promise<ApprovedMergePlan> {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(planPath, "utf8")) as ApprovedMergePlan;
}

function assertQMolinaExcluded(plan: ApprovedMergePlan) {
  const approvedNames = plan.approvedGroups.flatMap((group) => [
    group.canonicalPlayerDisplayName,
    ...group.duplicatePlayerDisplayNames
  ]);
  const qMolinaApproved = approvedNames.some((name) => name === "Q. Molina" || name === "Q Molina");
  const qMolinaExcluded = (plan.excludedGroups ?? []).some((group) =>
    group.suspectedNames.some((name) => name === "Q. Molina" || name === "Q Molina")
  );

  if (qMolinaApproved) {
    throw new Error("Q. Molina / Q Molina appears in approved merge groups. Aborting.");
  }

  if (!qMolinaExcluded) {
    throw new Error("Q. Molina / Q Molina is not recorded as excluded. Aborting.");
  }

  return true;
}

async function main() {
  const plan = await readPlan();
  const qMolinaExcluded = assertQMolinaExcluded(plan);
  const approvedGroups = plan.approvedGroups.filter((group) => group.approved);

  const summary: MergeSummary = {
    qMolinaExcluded,
    groupsProcessed: 0,
    duplicatePlayersSoftDeleted: 0,
    gameStatsReassigned: 0,
    gamePerformanceScoresReassigned: 0,
    playerRatingsDeleted: 0,
    rankingSnapshotRowsDeleted: 0,
    skippedGroups: [],
    errors: []
  };

  await prisma.$transaction(async (tx) => {
    for (const group of approvedGroups) {
      if (group.sameGameConflict) {
        throw new Error(`Group ${group.groupNumber} has sameGameConflict=true. Aborting.`);
      }

      if (!group.canonicalPlayerId || group.duplicatePlayerIds.length === 0) {
        summary.skippedGroups.push({
          groupNumber: group.groupNumber,
          reason: "Missing canonical player id or duplicate player ids."
        });
        continue;
      }

      const canonicalPlayer = await tx.player.findFirst({
        where: {
          id: group.canonicalPlayerId,
          deletedAt: null
        },
        select: {
          id: true,
          displayName: true
        }
      });

      if (!canonicalPlayer) {
        throw new Error(`Group ${group.groupNumber} canonical player does not exist or is deleted.`);
      }

      const duplicatePlayers = await tx.player.findMany({
        where: {
          id: {
            in: group.duplicatePlayerIds
          },
          deletedAt: null
        },
        select: {
          id: true,
          displayName: true
        }
      });

      if (duplicatePlayers.length !== group.duplicatePlayerIds.length) {
        const foundIds = new Set(duplicatePlayers.map((player) => player.id));
        const missingIds = group.duplicatePlayerIds.filter((id) => !foundIds.has(id));
        throw new Error(`Group ${group.groupNumber} duplicate player missing or deleted: ${missingIds.join(", ")}`);
      }

      const canonicalGameIds = new Set(
        (await tx.gameStat.findMany({
          where: {
            playerId: group.canonicalPlayerId,
            deletedAt: null
          },
          select: {
            gameId: true
          }
        })).map((stat) => stat.gameId)
      );

      const duplicateGameStats = await tx.gameStat.findMany({
        where: {
          playerId: {
            in: group.duplicatePlayerIds
          },
          deletedAt: null
        },
        select: {
          id: true,
          gameId: true,
          playerId: true
        }
      });

      const conflictingGameIds = duplicateGameStats
        .filter((stat) => canonicalGameIds.has(stat.gameId))
        .map((stat) => stat.gameId);

      if (conflictingGameIds.length > 0) {
        throw new Error(
          `Group ${group.groupNumber} would violate GameStat gameId+playerId uniqueness in games: ${Array.from(new Set(conflictingGameIds)).join(", ")}`
        );
      }

      const duplicateGameStatIds = duplicateGameStats.map((stat) => stat.id);
      const gamePerformanceScoresForDuplicateStats = duplicateGameStatIds.length > 0
        ? await tx.gamePerformanceScore.findMany({
            where: {
              gameStatId: {
                in: duplicateGameStatIds
              }
            },
            select: {
              id: true,
              gameStatId: true,
              playerId: true
            }
          })
        : [];

      const gameStatUpdate = await tx.gameStat.updateMany({
        where: {
          id: {
            in: duplicateGameStatIds
          }
        },
        data: {
          playerId: group.canonicalPlayerId
        }
      });

      const gamePerformanceUpdate = await tx.gamePerformanceScore.updateMany({
        where: {
          id: {
            in: gamePerformanceScoresForDuplicateStats.map((score) => score.id)
          }
        },
        data: {
          playerId: group.canonicalPlayerId
        }
      });

      if (gamePerformanceUpdate.count !== gamePerformanceScoresForDuplicateStats.length) {
        throw new Error(`Group ${group.groupNumber} GamePerformanceScore reassignment count mismatch.`);
      }

      const playerRatingDelete = await tx.playerRating.deleteMany({
        where: {
          playerId: {
            in: group.duplicatePlayerIds
          }
        }
      });

      const rankingSnapshotRowDelete = await tx.rankingSnapshotRow.deleteMany({
        where: {
          playerId: {
            in: group.duplicatePlayerIds
          }
        }
      });

      const now = new Date();
      const duplicatePlayerUpdate = await tx.player.updateMany({
        where: {
          id: {
            in: group.duplicatePlayerIds
          },
          deletedAt: null
        },
        data: {
          deletedAt: now
        }
      });

      if (duplicatePlayerUpdate.count !== group.duplicatePlayerIds.length) {
        throw new Error(`Group ${group.groupNumber} duplicate player soft-delete count mismatch.`);
      }

      summary.groupsProcessed += 1;
      summary.duplicatePlayersSoftDeleted += duplicatePlayerUpdate.count;
      summary.gameStatsReassigned += gameStatUpdate.count;
      summary.gamePerformanceScoresReassigned += gamePerformanceUpdate.count;
      summary.playerRatingsDeleted += playerRatingDelete.count;
      summary.rankingSnapshotRowsDeleted += rankingSnapshotRowDelete.count;
    }
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.log(JSON.stringify({
      qMolinaExcluded: null,
      groupsProcessed: 0,
      duplicatePlayersSoftDeleted: 0,
      gameStatsReassigned: 0,
      gamePerformanceScoresReassigned: 0,
      playerRatingsDeleted: 0,
      rankingSnapshotRowsDeleted: 0,
      skippedGroups: [],
      errors: [error instanceof Error ? error.message : String(error)]
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });