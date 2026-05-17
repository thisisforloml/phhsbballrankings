import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const planPath = path.join(process.cwd(), "scripts", "reports", "approved-player-merge-plan-round-2.json");

type ApprovedGroup = {
  group: number;
  canonicalPlayerId: string;
  canonicalPlayerDisplayName: string;
  duplicatePlayerIds: string[];
  duplicatePlayerDisplayNames: string[];
  approved: boolean;
  sameGameConflict: boolean;
};

type ApprovedPlan = {
  approvedGroups: ApprovedGroup[];
};

async function main() {
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as ApprovedPlan;
  const approvedGroups = plan.approvedGroups.filter((group) => group.approved);
  const duplicatePlayerIds = approvedGroups.flatMap((group) => group.duplicatePlayerIds);

  const canonicalIssues = [];
  const duplicateSoftDeleteIssues = [];
  const gameStatReassignmentIssues = [];
  const gamePerformanceScoreReassignmentIssues = [];

  for (const group of approvedGroups) {
    const canonical = await prisma.player.findUnique({
      where: { id: group.canonicalPlayerId },
      select: { id: true, displayName: true, deletedAt: true }
    });

    if (!canonical || canonical.deletedAt !== null) {
      canonicalIssues.push({
        group: group.group,
        canonicalPlayerId: group.canonicalPlayerId,
        issue: canonical ? "canonical_player_deleted" : "canonical_player_missing"
      });
    }

    const duplicates = await prisma.player.findMany({
      where: { id: { in: group.duplicatePlayerIds } },
      select: { id: true, displayName: true, deletedAt: true }
    });
    const duplicateById = new Map(duplicates.map((player) => [player.id, player]));

    for (const duplicatePlayerId of group.duplicatePlayerIds) {
      const duplicate = duplicateById.get(duplicatePlayerId);
      if (!duplicate || duplicate.deletedAt === null) {
        duplicateSoftDeleteIssues.push({
          group: group.group,
          duplicatePlayerId,
          issue: duplicate ? "duplicate_player_still_active" : "duplicate_player_missing"
        });
      }
    }

    const duplicateGameStats = await prisma.gameStat.findMany({
      where: { playerId: { in: group.duplicatePlayerIds } },
      select: { id: true, gameId: true, playerId: true }
    });
    if (duplicateGameStats.length > 0) {
      gameStatReassignmentIssues.push({
        group: group.group,
        duplicateGameStats
      });
    }

    const duplicateGamePerformanceScores = await prisma.gamePerformanceScore.findMany({
      where: { playerId: { in: group.duplicatePlayerIds } },
      select: { id: true, gameStatId: true, playerId: true }
    });
    if (duplicateGamePerformanceScores.length > 0) {
      gamePerformanceScoreReassignmentIssues.push({
        group: group.group,
        duplicateGamePerformanceScores
      });
    }
  }

  const [duplicatePlayerRatingsRemaining, duplicateSnapshotRowsRemaining] = await Promise.all([
    prisma.playerRating.findMany({
      where: { playerId: { in: duplicatePlayerIds } },
      select: { id: true, playerId: true }
    }),
    prisma.rankingSnapshotRow.findMany({
      where: { playerId: { in: duplicatePlayerIds } },
      select: { id: true, playerId: true, snapshotId: true }
    })
  ]);

  const validationPassed =
    canonicalIssues.length === 0 &&
    duplicateSoftDeleteIssues.length === 0 &&
    gameStatReassignmentIssues.length === 0 &&
    gamePerformanceScoreReassignmentIssues.length === 0 &&
    duplicatePlayerRatingsRemaining.length === 0 &&
    duplicateSnapshotRowsRemaining.length === 0;

  console.log(
    JSON.stringify(
      {
        approvedGroupsChecked: approvedGroups.length,
        duplicatePlayersSoftDeleted: duplicatePlayerIds.length - duplicateSoftDeleteIssues.length,
        canonicalPlayersActive: approvedGroups.length - canonicalIssues.length,
        canonicalIssues,
        duplicateSoftDeleteIssues,
        gameStatReassignmentIssues,
        gamePerformanceScoreReassignmentIssues,
        duplicatePlayerRatingsRemaining,
        duplicateSnapshotRowsRemaining,
        validationPassed
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
