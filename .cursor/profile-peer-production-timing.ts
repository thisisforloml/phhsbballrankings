import { performance } from "node:perf_hooks";
import { AgeGroup } from "@prisma/client";
import { getActivePolicyVersionId } from "../src/lib/ratings/active-formula";
import { prisma } from "../src/lib/prisma";

async function main() {
  const policyVersionId = getActivePolicyVersionId();
  for (const ageGroup of [AgeGroup.U16, AgeGroup.U19] as const) {
    const t0 = performance.now();
    const ratings = await prisma.playerRating.findMany({
      where: {
        policyVersionId,
        ageGroup,
        player: { deletedAt: null, gender: "BOYS" },
      },
      select: {
        player: {
          select: {
            gameStats: {
              where: {
                deletedAt: null,
                performanceScores: {
                  some: { deletedAt: null, formulaVersion: { versionNumber: 1 } },
                },
              },
              select: {
                points: true,
                rebounds: true,
                assists: true,
                steals: true,
                blocks: true,
                turnovers: true,
                minutes: true,
                fieldGoalsAttempt: true,
                freeThrowsAttempt: true,
              },
            },
          },
        },
      },
    });
    const ms = Math.round(performance.now() - t0);
    const gameStatRows = ratings.reduce((sum, r) => sum + r.player.gameStats.length, 0);
    const peersWith3Plus = ratings.filter((r) => r.player.gameStats.length >= 3).length;
    console.log(JSON.stringify({ ageGroup, ms, ratingRows: ratings.length, nestedGameStatRows: gameStatRows, peersWith3Plus }, null, 2));
  }
  await prisma.$disconnect();
}

main();
