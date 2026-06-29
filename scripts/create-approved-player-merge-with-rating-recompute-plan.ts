import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

type MergePlanInput = {
  mergePlans: Array<{
    groupId: string;
    classification: string;
    players: Array<{
      playerId: string;
      displayName: string;
    }>;
    proposedMerge: {
      canonicalPlayerId: string;
      canonicalDisplayName: string;
      sourcePlayerIds: string[];
      sourceDisplayNames: string[];
    } | null;
    duplicateRankingCollisionRisk: {
      hasRisk: boolean;
      ratingCollisions: Array<{ ageGroup: string; playerIds: string[] }>;
      snapshotCollisions: Array<{ snapshotId: string; ageGroup: string | null; gender: string; playerIds: string[] }>;
    };
  }>;
};

const inputPath = join(process.cwd(), "scripts", "reports", "all-player-merge-plan.json");
const outputPath = join(process.cwd(), "scripts", "reports", "approved-player-merge-with-rating-recompute-plan.json");

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

function dateOnly(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function main() {
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as MergePlanInput;
  const approvedGroups = input.mergePlans.filter((group) => group.classification === "MERGE_APPROVED_CANDIDATE" && group.proposedMerge);
  const affectedPlayerIds = Array.from(new Set(approvedGroups.flatMap((group) => [group.proposedMerge!.canonicalPlayerId, ...group.proposedMerge!.sourcePlayerIds])));

  const [players, profileSubmissionCounts] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: affectedPlayerIds } },
      include: {
        currentProgram: true,
        gameStats: { where: { deletedAt: null }, select: { id: true, gameId: true } },
        performanceScores: {
          where: { deletedAt: null },
          include: { game: { include: { season: { include: { league: true } } } } }
        },
        currentRatings: { select: { id: true, ageGroup: true, observedRating: true, adjustedRating: true, verifiedGameCount: true, starRating: true } },
        rankingRows: { include: { snapshot: { select: { id: true, ageGroup: true, gender: true, weekOf: true, scope: true } } } },
        programHistory: { select: { id: true } }
      }
    }),
    prisma.playerProfileSubmission.groupBy({
      by: ["playerId"],
      where: { playerId: { in: affectedPlayerIds } },
      _count: { _all: true }
    })
  ]);
  const profileSubmissionCountByPlayerId = new Map(profileSubmissionCounts.map((row) => [row.playerId, row._count._all]));
  const playerById = new Map(players.map((player) => [player.id, player]));

  const groupPlans = approvedGroups.map((group) => {
    const proposed = group.proposedMerge!;
    const canonical = playerById.get(proposed.canonicalPlayerId);
    if (!canonical) throw new Error(`Missing canonical player ${proposed.canonicalPlayerId}`);
    const sources = proposed.sourcePlayerIds.map((playerId) => {
      const source = playerById.get(playerId);
      if (!source) throw new Error(`Missing source player ${playerId}`);
      return source;
    });
    const allPlayers = [canonical, ...sources];
    const allPerformanceScores = allPlayers.flatMap((player) => player.performanceScores);
    const scoresByAgeGroup = new Map<string, number[]>();
    const performanceScoreIdsByAgeGroup = new Map<string, string[]>();
    for (const score of allPerformanceScores) {
      const ageGroup = String(score.game.season.league.ageGroup);
      const value = score.finalPerformanceScore ?? score.performanceScore;
      const values = scoresByAgeGroup.get(ageGroup) ?? [];
      values.push(Number(value));
      scoresByAgeGroup.set(ageGroup, values);
      const ids = performanceScoreIdsByAgeGroup.get(ageGroup) ?? [];
      ids.push(score.id);
      performanceScoreIdsByAgeGroup.set(ageGroup, ids);
    }

    const proposedRatingRecalculations = Array.from(scoresByAgeGroup.entries()).map(([ageGroup, values]) => {
      const observedRating = average(values);
      const adjustedRating = observedRating;
      return {
        canonicalPlayerId: canonical.id,
        ageGroup,
        inputGamePerformanceScoreIds: performanceScoreIdsByAgeGroup.get(ageGroup) ?? [],
        verifiedGameCount: values.length,
        observedRating: Number(observedRating.toFixed(2)),
        adjustedRating: Number(adjustedRating.toFixed(2)),
        starRating: starFromAdjustedRating(adjustedRating),
        existingCanonicalRating: canonical.currentRatings.find((rating) => String(rating.ageGroup) === ageGroup) ? {
          id: canonical.currentRatings.find((rating) => String(rating.ageGroup) === ageGroup)!.id,
          observedRating: Number(canonical.currentRatings.find((rating) => String(rating.ageGroup) === ageGroup)!.observedRating),
          adjustedRating: Number(canonical.currentRatings.find((rating) => String(rating.ageGroup) === ageGroup)!.adjustedRating),
          verifiedGameCount: canonical.currentRatings.find((rating) => String(rating.ageGroup) === ageGroup)!.verifiedGameCount,
          starRating: canonical.currentRatings.find((rating) => String(rating.ageGroup) === ageGroup)!.starRating
        } : null,
        sourceRatingsToConsolidate: sources.flatMap((source) => source.currentRatings.filter((rating) => String(rating.ageGroup) === ageGroup).map((rating) => ({
          playerId: source.id,
          ratingId: rating.id,
          observedRating: Number(rating.observedRating),
          adjustedRating: Number(rating.adjustedRating),
          verifiedGameCount: rating.verifiedGameCount,
          starRating: rating.starRating
        })))
      };
    });

    const affectedSnapshotRows = allPlayers.flatMap((player) => player.rankingRows.map((row) => ({
      rowId: row.id,
      playerId: player.id,
      playerName: player.displayName,
      snapshotId: row.snapshotId,
      scope: row.snapshot.scope,
      ageGroup: row.snapshot.ageGroup ? String(row.snapshot.ageGroup) : null,
      gender: String(row.snapshot.gender),
      weekOf: row.snapshot.weekOf.toISOString().slice(0, 10),
      rank: row.rank,
      rating: Number(row.rating),
      verifiedGameCount: row.verifiedGameCount,
      starRating: row.starRating
    })));
    const affectedSnapshots = Array.from(new Map(affectedSnapshotRows.map((row) => [row.snapshotId, row])).values()).map((row) => ({
      snapshotId: row.snapshotId,
      scope: row.scope,
      ageGroup: row.ageGroup,
      gender: row.gender,
      weekOf: row.weekOf,
      rowsForGroup: affectedSnapshotRows.filter((item) => item.snapshotId === row.snapshotId)
    }));
    const snapshotCollisionRisks = group.duplicateRankingCollisionRisk.snapshotCollisions;
    const partialSnapshotRowUpdateSafe = affectedSnapshots.length === 0 || snapshotCollisionRisks.length === 0 ? false : false;

    return {
      groupId: group.groupId,
      canonicalPlayer: {
        playerId: canonical.id,
        displayName: canonical.displayName,
        currentProgramId: canonical.currentProgramId,
        currentProgram: canonical.currentProgram ? { programId: canonical.currentProgram.id, fullName: canonical.currentProgram.fullName, abbreviation: canonical.currentProgram.abbreviation } : null,
        gender: canonical.gender,
        birthDate: dateOnly(canonical.birthDate)
      },
      sourcePlayers: sources.map((source) => ({
        playerId: source.id,
        displayName: source.displayName,
        currentProgramId: source.currentProgramId,
        currentProgram: source.currentProgram ? { programId: source.currentProgram.id, fullName: source.currentProgram.fullName, abbreviation: source.currentProgram.abbreviation } : null,
        gender: source.gender,
        birthDate: dateOnly(source.birthDate)
      })),
      combinedGameStatsCount: allPlayers.reduce((sum, player) => sum + player.gameStats.length, 0),
      combinedGamePerformanceScoreCount: allPerformanceScores.length,
      existingPlayerRatingRowsByAgeGroup: allPlayers.map((player) => ({
        playerId: player.id,
        displayName: player.displayName,
        ratings: player.currentRatings.map((rating) => ({
          ratingId: rating.id,
          ageGroup: String(rating.ageGroup),
          observedRating: Number(rating.observedRating),
          adjustedRating: Number(rating.adjustedRating),
          verifiedGameCount: rating.verifiedGameCount,
          starRating: rating.starRating
        }))
      })),
      existingRankingSnapshotRows: affectedSnapshotRows,
      ratingCollisionRisks: group.duplicateRankingCollisionRisk.ratingCollisions,
      snapshotCollisionRisks,
      executionPlan: {
        transactionRequired: true,
        reassignSourcePlayerRecordsToCanonical: {
          GameStat_playerId: sources.reduce((sum, source) => sum + source.gameStats.length, 0),
          GamePerformanceScore_playerId: sources.reduce((sum, source) => sum + source.performanceScores.length, 0),
          PlayerProgramHistory_playerId: sources.reduce((sum, source) => sum + source.programHistory.length, 0),
          PlayerProfileSubmission_playerId: sources.reduce((sum, source) => sum + (profileSubmissionCountByPlayerId.get(source.id) ?? 0), 0)
        },
        softDeleteSourcePlayersUsingDeletedAt: true,
        recalculateOnlyAffectedCanonicalPlayerRatings: proposedRatingRecalculations,
        playerRatingCollisionHandling: "Delete or retire source PlayerRating rows after canonical ratings are recalculated/upserted, otherwise unique(playerId, ageGroup) reassignment will collide.",
        rankingSnapshotHandling: {
          affectedSnapshots,
          partialSnapshotRowUpdateSafe,
          recommendation: affectedSnapshots.length ? "Do not perform partial row-only rank edits. Merging can change ratings and rank order, and same-snapshot duplicate rows exist for some groups. Regenerate only affected snapshots after merge/rating recalculation." : "No existing snapshot rows for this group; no snapshot row action needed during merge.",
          doNotRegenerateInThisTask: true
        },
        unchangedData: [
          "GamePerformanceScore values",
          "GameStat stat values",
          "Game records",
          "unaffected PlayerRating rows",
          "unaffected RankingSnapshots"
        ]
      }
    };
  });

  const affectedCanonicalPlayers = groupPlans.map((plan) => ({ playerId: plan.canonicalPlayer.playerId, displayName: plan.canonicalPlayer.displayName }));
  const sourcePlayersToSoftDelete = groupPlans.flatMap((plan) => plan.sourcePlayers.map((player) => ({ playerId: player.playerId, displayName: player.displayName })));
  const affectedSnapshotIds = Array.from(new Set(groupPlans.flatMap((plan) => plan.executionPlan.rankingSnapshotHandling.affectedSnapshots.map((snapshot) => snapshot.snapshotId))));
  const playerRatingsToRecalculate = groupPlans.flatMap((plan) => plan.executionPlan.recalculateOnlyAffectedCanonicalPlayerRatings.map((rating) => ({ playerId: rating.canonicalPlayerId, ageGroup: rating.ageGroup })));

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    inputPath,
    guardrails: {
      databaseModified: false,
      playersMerged: false,
      playersDeleted: false,
      migrationsRun: false,
      importsOrPublishRun: false,
      ratingsRecomputed: false,
      snapshotsRegenerated: false,
      formulaV1Changed: false
    },
    ratingRecalculationMethod: {
      source: "Existing Formula v1 player rating scripts compute observedRating as average(finalPerformanceScore or performanceScore), adjustedRating equal to observedRating, and starRating from fixed Formula v1 bands.",
      scope: "Only canonical players in this merge plan and only age groups represented by their combined GamePerformanceScores.",
      gamePerformanceScoresChanged: false
    },
    groupPlans,
    summary: {
      groupsPlanned: groupPlans.length,
      affectedCanonicalPlayers,
      sourcePlayersToSoftDelete,
      gameStatsToReassign: groupPlans.reduce((sum, plan) => sum + plan.executionPlan.reassignSourcePlayerRecordsToCanonical.GameStat_playerId, 0),
      gamePerformanceScoresToReassign: groupPlans.reduce((sum, plan) => sum + plan.executionPlan.reassignSourcePlayerRecordsToCanonical.GamePerformanceScore_playerId, 0),
      playerProgramHistoryRowsToReassign: groupPlans.reduce((sum, plan) => sum + plan.executionPlan.reassignSourcePlayerRecordsToCanonical.PlayerProgramHistory_playerId, 0),
      playerProfileSubmissionsToReassign: groupPlans.reduce((sum, plan) => sum + plan.executionPlan.reassignSourcePlayerRecordsToCanonical.PlayerProfileSubmission_playerId, 0),
      playerRatingsToRecalculate,
      playerRatingRecalculationCount: playerRatingsToRecalculate.length,
      rankingSnapshotsAffected: affectedSnapshotIds,
      rankingSnapshotsAffectedCount: affectedSnapshotIds.length,
      fullAffectedSnapshotRegenerationRecommended: affectedSnapshotIds.length > 0,
      safestExecutionRecommendation: "Execute one transaction for player record reassignment, source soft-delete, source PlayerRating cleanup, and canonical PlayerRating recalculation. Do not update snapshot ranks inline. After merge validation, regenerate only affected RankingSnapshots in a separately approved step."
    }
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
