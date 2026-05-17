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
  const now = new Date();
  const summary = {
    groupsProcessed: 0,
    duplicatePlayersSoftDeleted: 0,
    gameStatsReassigned: 0,
    gamePerformanceScoresReassigned: 0,
    playerRatingsDeleted: 0,
    rankingSnapshotRowsDeleted: 0,
    skippedGroups: [] as Array<{ group: number; reason: string }>,
    errors: [] as string[]
  };

  await prisma.$transaction(async (tx) => {
    for (const group of plan.approvedGroups) {
      if (!group.approved) {
        summary.skippedGroups.push({ group: group.group, reason: "Group is not approved." });
        continue;
      }
      if (group.sameGameConflict) {
        throw new Error(`Group ${group.group} has same-game conflict in approved plan.`);
      }

      const canonical = await tx.player.findFirst({
        where: { id: group.canonicalPlayerId, deletedAt: null },
        select: { id: true, displayName: true }
      });
      if (!canonical) throw new Error(`Group ${group.group}: canonical player is missing or deleted.`);

      const duplicates = await tx.player.findMany({
        where: { id: { in: group.duplicatePlayerIds }, deletedAt: null },
        select: { id: true, displayName: true }
      });
      if (duplicates.length !== group.duplicatePlayerIds.length) {
        throw new Error(`Group ${group.group}: one or more duplicate players are missing or already deleted.`);
      }

      const canonicalStats = await tx.gameStat.findMany({
        where: { playerId: canonical.id },
        select: { gameId: true }
      });
      const canonicalGameIds = new Set(canonicalStats.map((stat) => stat.gameId));
      const duplicateStats = await tx.gameStat.findMany({
        where: { playerId: { in: group.duplicatePlayerIds } },
        select: { id: true, gameId: true, playerId: true }
      });

      const conflict = duplicateStats.find((stat) => canonicalGameIds.has(stat.gameId));
      if (conflict) {
        throw new Error(`Group ${group.group}: same-game conflict on game ${conflict.gameId}.`);
      }

      const gameStatUpdate = await tx.gameStat.updateMany({
        where: { playerId: { in: group.duplicatePlayerIds } },
        data: { playerId: canonical.id }
      });
      summary.gameStatsReassigned += gameStatUpdate.count;

      const gpsUpdate = await tx.gamePerformanceScore.updateMany({
        where: { playerId: { in: group.duplicatePlayerIds } },
        data: { playerId: canonical.id }
      });
      summary.gamePerformanceScoresReassigned += gpsUpdate.count;

      const ratingDelete = await tx.playerRating.deleteMany({
        where: { playerId: { in: group.duplicatePlayerIds } }
      });
      summary.playerRatingsDeleted += ratingDelete.count;

      const snapshotRowsDelete = await tx.rankingSnapshotRow.deleteMany({
        where: { playerId: { in: group.duplicatePlayerIds } }
      });
      summary.rankingSnapshotRowsDeleted += snapshotRowsDelete.count;

      await tx.player.update({
        where: { id: canonical.id },
        data: {
          displayName: group.canonicalPlayerDisplayName,
          firstName: group.canonicalPlayerDisplayName.split(/\s+/)[0] ?? group.canonicalPlayerDisplayName,
          lastName: group.canonicalPlayerDisplayName.split(/\s+/).slice(1).join(" ") || group.canonicalPlayerDisplayName
        }
      });

      const playerDelete = await tx.player.updateMany({
        where: { id: { in: group.duplicatePlayerIds }, deletedAt: null },
        data: { deletedAt: now }
      });
      summary.duplicatePlayersSoftDeleted += playerDelete.count;
      summary.groupsProcessed += 1;
    }
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());