import { readFileSync } from "node:fs";
import { AgeGroup, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const scriptPath = "D:\\Peach Basket\\scripts\\repair-approved-duplicate-players-with-ratings.ts";
const inputPath = "scripts/reports/approved-player-merge-with-rating-recompute-plan.json";
const expectedAffectedSnapshots = [
  "0e7cf39c-b67c-4c3a-8f10-08ab801a8734",
  "319b72cd-91c1-4e8b-bf0e-2f870ea1eadc"
];

type GroupPlan = {
  groupId: string;
  canonicalPlayer: { playerId: string; displayName: string };
  sourcePlayers: Array<{ playerId: string; displayName: string }>;
  executionPlan: {
    recalculateOnlyAffectedCanonicalPlayerRatings: Array<{ canonicalPlayerId: string; ageGroup: string }>;
    rankingSnapshotHandling: { affectedSnapshots: Array<{ snapshotId: string }> };
  };
};

type RepairPlan = { groupPlans: GroupPlan[] };

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function starFromAdjustedRating(adjustedRating: number) {
  if (adjustedRating >= 90) return 5;
  if (adjustedRating >= 80) return 4;
  if (adjustedRating >= 70) return 3;
  if (adjustedRating >= 60) return 2;
  return 1;
}

function parseAgeGroup(value: string): AgeGroup {
  if (!Object.values(AgeGroup).includes(value as AgeGroup)) throw new Error(`Unsupported ageGroup in plan: ${value}`);
  return value as AgeGroup;
}

async function getCounts(client: PrismaClient | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const [totalPlayers, activePlayers, gameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows] = await Promise.all([
    client.player.count(),
    client.player.count({ where: { deletedAt: null } }),
    client.gameStat.count({ where: { deletedAt: null } }),
    client.gamePerformanceScore.count({ where: { deletedAt: null } }),
    client.playerRating.count(),
    client.rankingSnapshot.count(),
    client.rankingSnapshotRow.count()
  ]);
  return { totalPlayers, activePlayers, gameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows };
}

async function main() {
  const plan = JSON.parse(readFileSync(inputPath, "utf8")) as RepairPlan;
  const groupPlans = plan.groupPlans;
  if (groupPlans.length !== 12) throw new Error(`Expected 12 groups, found ${groupPlans.length}.`);

  const canonicalIds = groupPlans.map((group) => group.canonicalPlayer.playerId);
  const sourceIds = groupPlans.flatMap((group) => group.sourcePlayers.map((player) => player.playerId));
  const allIds = [...canonicalIds, ...sourceIds];
  if (new Set(canonicalIds).size !== 12) throw new Error("Canonical player ids are not unique.");
  if (new Set(sourceIds).size !== 12) throw new Error("Source player ids are not unique.");
  if (sourceIds.some((id) => canonicalIds.includes(id))) throw new Error("A source player is also a canonical player.");

  const beforeCounts = await getCounts(prisma);
  const sourcePlayersBefore = await prisma.player.findMany({ where: { id: { in: sourceIds } }, select: { id: true, displayName: true, deletedAt: true } });
  if (sourcePlayersBefore.length !== sourceIds.length) throw new Error("One or more source players are missing.");
  if (sourcePlayersBefore.some((player) => player.deletedAt !== null)) throw new Error("One or more source players are already deleted.");

  const canonicalPlayersBefore = await prisma.player.findMany({ where: { id: { in: canonicalIds }, deletedAt: null }, select: { id: true } });
  if (canonicalPlayersBefore.length !== canonicalIds.length) throw new Error("One or more canonical players are missing or deleted.");

  const gameStatCollisionChecks = [];
  for (const group of groupPlans) {
    const groupSourceIds = group.sourcePlayers.map((player) => player.playerId);
    const [canonicalStats, sourceStats] = await Promise.all([
      prisma.gameStat.findMany({ where: { playerId: group.canonicalPlayer.playerId, deletedAt: null }, select: { gameId: true, id: true } }),
      prisma.gameStat.findMany({ where: { playerId: { in: groupSourceIds }, deletedAt: null }, select: { gameId: true, id: true, playerId: true } })
    ]);
    const canonicalGameIds = new Set(canonicalStats.map((stat) => stat.gameId));
    const collisions = sourceStats.filter((stat) => canonicalGameIds.has(stat.gameId));
    if (collisions.length) gameStatCollisionChecks.push({ groupId: group.groupId, collisions });
  }
  if (gameStatCollisionChecks.length) throw new Error(`GameStat uniqueness collisions found: ${JSON.stringify(gameStatCollisionChecks)}`);

  const beforeSourceRows = await Promise.all([
    prisma.gameStat.count({ where: { playerId: { in: sourceIds }, deletedAt: null } }),
    prisma.gamePerformanceScore.count({ where: { playerId: { in: sourceIds }, deletedAt: null } }),
    prisma.playerProgramHistory.count({ where: { playerId: { in: sourceIds } } }),
    prisma.playerProfileSubmission.count({ where: { playerId: { in: sourceIds } } }),
    prisma.playerRating.count({ where: { playerId: { in: sourceIds } } }),
    prisma.rankingSnapshotRow.count({ where: { playerId: { in: sourceIds } } })
  ]);
  const [sourceGameStatsBefore, sourceScoresBefore, sourceHistoryBefore, sourceSubmissionsBefore, sourceRatingsBefore, sourceSnapshotRowsBefore] = beforeSourceRows;
  const sourceSnapshotRows = await prisma.rankingSnapshotRow.findMany({
    where: { playerId: { in: sourceIds } },
    include: { snapshot: { select: { id: true, ageGroup: true, gender: true, weekOf: true } }, player: { select: { displayName: true } } },
    orderBy: [{ snapshotId: "asc" }, { rank: "asc" }]
  });

  const result = await prisma.$transaction(async (tx) => {
    let gameStatsReassigned = 0;
    let gamePerformanceScoresReassigned = 0;
    let playerProgramHistoryReassigned = 0;
    let playerProfileSubmissionsReassigned = 0;
    let sourceRatingsDeleted = 0;
    let sourceSnapshotRowsRemoved = 0;
    let sourcePlayersSoftDeleted = 0;
    const groupsMerged = [];
    const recalculatedRatings = [];
    const deletedAt = new Date();

    for (const group of groupPlans) {
      const canonicalId = group.canonicalPlayer.playerId;
      const groupSourceIds = group.sourcePlayers.map((player) => player.playerId);
      const gameStatUpdate = await tx.gameStat.updateMany({ where: { playerId: { in: groupSourceIds }, deletedAt: null }, data: { playerId: canonicalId } });
      const scoreUpdate = await tx.gamePerformanceScore.updateMany({ where: { playerId: { in: groupSourceIds }, deletedAt: null }, data: { playerId: canonicalId } });
      const historyUpdate = await tx.playerProgramHistory.updateMany({ where: { playerId: { in: groupSourceIds } }, data: { playerId: canonicalId } });
      const submissionUpdate = await tx.playerProfileSubmission.updateMany({ where: { playerId: { in: groupSourceIds } }, data: { playerId: canonicalId } });
      const snapshotDelete = await tx.rankingSnapshotRow.deleteMany({ where: { playerId: { in: groupSourceIds } } });
      const ratingDelete = await tx.playerRating.deleteMany({ where: { playerId: { in: groupSourceIds } } });
      const playerSoftDelete = await tx.player.updateMany({ where: { id: { in: groupSourceIds }, deletedAt: null }, data: { deletedAt } });

      gameStatsReassigned += gameStatUpdate.count;
      gamePerformanceScoresReassigned += scoreUpdate.count;
      playerProgramHistoryReassigned += historyUpdate.count;
      playerProfileSubmissionsReassigned += submissionUpdate.count;
      sourceSnapshotRowsRemoved += snapshotDelete.count;
      sourceRatingsDeleted += ratingDelete.count;
      sourcePlayersSoftDeleted += playerSoftDelete.count;
      groupsMerged.push({
        groupId: group.groupId,
        canonicalPlayer: group.canonicalPlayer,
        sourcePlayers: group.sourcePlayers,
        gameStatsReassigned: gameStatUpdate.count,
        gamePerformanceScoresReassigned: scoreUpdate.count,
        playerProgramHistoryReassigned: historyUpdate.count,
        playerProfileSubmissionsReassigned: submissionUpdate.count,
        sourceSnapshotRowsRemoved: snapshotDelete.count,
        sourceRatingsDeleted: ratingDelete.count,
        sourcePlayersSoftDeleted: playerSoftDelete.count
      });
    }

    const uniqueRatingTargets = new Map<string, { playerId: string; ageGroup: AgeGroup }>();
    for (const group of groupPlans) {
      for (const target of group.executionPlan.recalculateOnlyAffectedCanonicalPlayerRatings) {
        uniqueRatingTargets.set(`${target.canonicalPlayerId}:${target.ageGroup}`, { playerId: target.canonicalPlayerId, ageGroup: parseAgeGroup(target.ageGroup) });
      }
    }

    for (const target of uniqueRatingTargets.values()) {
      const scores = await tx.gamePerformanceScore.findMany({
        where: {
          playerId: target.playerId,
          deletedAt: null,
          game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null, ageGroup: target.ageGroup } } }
        },
        select: { id: true, finalPerformanceScore: true, performanceScore: true }
      });
      if (!scores.length) throw new Error(`No GamePerformanceScores found for ${target.playerId} / ${target.ageGroup}.`);
      const values = scores.map((score) => Number(score.finalPerformanceScore ?? score.performanceScore));
      const observedRating = average(values);
      const adjustedRating = observedRating;
      const starRating = starFromAdjustedRating(adjustedRating);
      await tx.playerRating.upsert({
        where: { playerId_ageGroup: { playerId: target.playerId, ageGroup: target.ageGroup } },
        update: { observedRating, adjustedRating, verifiedGameCount: values.length, starRating, computedAt: new Date() },
        create: { playerId: target.playerId, ageGroup: target.ageGroup, observedRating, adjustedRating, verifiedGameCount: values.length, starRating }
      });
      recalculatedRatings.push({
        playerId: target.playerId,
        ageGroup: target.ageGroup,
        inputGamePerformanceScoreCount: values.length,
        observedRating: Number(observedRating.toFixed(2)),
        adjustedRating: Number(adjustedRating.toFixed(2)),
        starRating
      });
    }

    const countsAfterTransaction = await getCounts(tx as any);
    return {
      groupsMerged,
      reassignedCounts: {
        GameStat_playerId: gameStatsReassigned,
        GamePerformanceScore_playerId: gamePerformanceScoresReassigned,
        PlayerProgramHistory_playerId: playerProgramHistoryReassigned,
        PlayerProfileSubmission_playerId: playerProfileSubmissionsReassigned,
        RankingSnapshotRowsRemovedForSourcePlayers: sourceSnapshotRowsRemoved,
        sourcePlayerRatingsDeleted: sourceRatingsDeleted
      },
      sourcePlayersSoftDeleted,
      recalculatedRatings,
      countsAfterTransaction
    };
  }, { timeout: 60000, maxWait: 10000 });

  const afterCounts = await getCounts(prisma);
  const [sourcePlayersStillActive, sourceRatingsRemaining, sourceGameStatsRemaining, sourceScoresRemaining, sourceSnapshotRowsRemaining] = await Promise.all([
    prisma.player.count({ where: { id: { in: sourceIds }, deletedAt: null } }),
    prisma.playerRating.count({ where: { playerId: { in: sourceIds } } }),
    prisma.gameStat.count({ where: { playerId: { in: sourceIds }, deletedAt: null } }),
    prisma.gamePerformanceScore.count({ where: { playerId: { in: sourceIds }, deletedAt: null } }),
    prisma.rankingSnapshotRow.count({ where: { playerId: { in: sourceIds } } })
  ]);
  const affectedSnapshots = Array.from(new Set([
    ...expectedAffectedSnapshots,
    ...sourceSnapshotRows.map((row) => row.snapshotId),
    ...groupPlans.flatMap((group) => group.executionPlan.rankingSnapshotHandling.affectedSnapshots.map((snapshot) => snapshot.snapshotId))
  ]));
  const affectedRankingSnapshotRowsRemoved = sourceSnapshotRows.map((row) => ({
    rowId: row.id,
    playerId: row.playerId,
    playerName: row.player.displayName,
    snapshotId: row.snapshotId,
    ageGroup: row.snapshot.ageGroup ? String(row.snapshot.ageGroup) : null,
    gender: String(row.snapshot.gender),
    weekOf: row.snapshot.weekOf.toISOString().slice(0, 10),
    oldRank: row.rank
  }));
  const validation = {
    sourcePlayersSoftDeleted: result.sourcePlayersSoftDeleted === 12,
    gameStatsReassigned: result.reassignedCounts.GameStat_playerId === 25,
    gamePerformanceScoresReassigned: result.reassignedCounts.GamePerformanceScore_playerId === 25,
    canonicalPlayerRatingsRecalculated: result.recalculatedRatings.length === 12,
    noPlayerRatingRowsRemainForDeletedSourcePlayers: sourceRatingsRemaining === 0,
    noGameStatsPointToDeletedSourcePlayers: sourceGameStatsRemaining === 0,
    noGamePerformanceScoresPointToDeletedSourcePlayers: sourceScoresRemaining === 0,
    activePlayerCountDecreasedBy12: beforeCounts.activePlayers - afterCounts.activePlayers === 12,
    totalPlayerCountUnchanged: beforeCounts.totalPlayers === afterCounts.totalPlayers,
    gameStatCountUnchanged: beforeCounts.gameStats === afterCounts.gameStats,
    gamePerformanceScoreCountUnchanged: beforeCounts.gamePerformanceScores === afterCounts.gamePerformanceScores,
    rankingSnapshotCountUnchanged: beforeCounts.rankingSnapshots === afterCounts.rankingSnapshots,
    noRankingSnapshotRowsPointToDeletedSourcePlayers: sourceSnapshotRowsRemaining === 0
  };
  const validationPassed = Object.values(validation).every(Boolean);

  console.log(JSON.stringify({
    scriptPath,
    groupsMerged: result.groupsMerged,
    sourcePlayersSoftDeleted: result.sourcePlayersSoftDeleted,
    sourcePlayersToSoftDelete: sourcePlayersBefore.map((player) => ({ playerId: player.id, displayName: player.displayName })),
    reassignedCounts: result.reassignedCounts,
    recalculatedRatings: result.recalculatedRatings,
    beforeCounts,
    afterCounts,
    sourceRowsBefore: {
      GameStat_playerId: sourceGameStatsBefore,
      GamePerformanceScore_playerId: sourceScoresBefore,
      PlayerProgramHistory_playerId: sourceHistoryBefore,
      PlayerProfileSubmission_playerId: sourceSubmissionsBefore,
      PlayerRating_rows: sourceRatingsBefore,
      RankingSnapshotRow_rows: sourceSnapshotRowsBefore
    },
    affectedSnapshotsNeedingRegeneration: affectedSnapshots,
    affectedRankingSnapshotRowsRemoved,
    affectedRankingSnapshotRowsStillNeedRegenerationOrCleanup: affectedSnapshots.map((snapshotId) => ({
      snapshotId,
      needsRegeneration: true,
      reason: "Source duplicate snapshot rows were removed and/or canonical ratings changed. Rank order was not updated inline. Regenerate this affected snapshot in the separately approved step."
    })),
    validation,
    validationPassed
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
