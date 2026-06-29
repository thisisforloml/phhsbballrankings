/**
 * Merge Keefy Iledan (duplicate) into Keefe Iledan (canonical) and recompute Formula v1 ratings.
 *
 * Usage:
 *   npx tsx scripts/merge-keefe-iledan.ts           # dry-run
 *   npx tsx scripts/merge-keefe-iledan.ts --execute # backup + merge + rating recompute
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  buildCumulativePlayerRatingTarget,
  loadCumulativeFormulaV1Gps,
  upsertCumulativePlayerRatings
} from "../src/lib/player-rating-cumulative";
import { FORMULA_V1_POLICY_ID, FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const CANONICAL_PLAYER_ID = "ed94eaa9-0923-433e-a2d9-a319b3ab7ba6";
const DUPLICATE_PLAYER_ID = "484ff142-89b3-4752-91b4-d03d79df742e";
const CANONICAL_DISPLAY_NAME = "Keefe Iledan";
const DUPLICATE_DISPLAY_NAME = "Keefy Iledan";

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function loadPlayers() {
  const [canonical, duplicate] = await Promise.all([
    prisma.player.findFirst({
      where: { id: CANONICAL_PLAYER_ID, deletedAt: null },
      include: {
        currentRatings: { where: { policyVersionId: FORMULA_V1_POLICY_ID } },
        gameStats: {
          where: { deletedAt: null },
          select: {
            id: true,
            gameId: true,
            game: { select: { season: { select: { league: { select: { ageGroup: true, name: true } } } } } }
          }
        },
        rosterSeasons: { where: { deletedAt: null }, select: { id: true, seasonId: true, teamId: true } }
      }
    }),
    prisma.player.findFirst({
      where: { id: DUPLICATE_PLAYER_ID, deletedAt: null },
      include: {
        currentRatings: { where: { policyVersionId: FORMULA_V1_POLICY_ID } },
        gameStats: {
          where: { deletedAt: null },
          select: {
            id: true,
            gameId: true,
            game: { select: { season: { select: { league: { select: { ageGroup: true, name: true } } } } } }
          }
        },
        rosterSeasons: { where: { deletedAt: null }, select: { id: true, seasonId: true, teamId: true } }
      }
    })
  ]);

  if (!canonical) throw new Error("Canonical player Keefe Iledan is missing or deleted.");
  if (!duplicate) throw new Error("Duplicate player Keefy Iledan is missing or deleted.");
  return { canonical, duplicate };
}

function gamesByAgeGroup(
  stats: Array<{ game: { season: { league: { ageGroup: AgeGroup; name: string } } } }>
) {
  const counts = new Map<string, number>();
  for (const stat of stats) {
    const key = String(stat.game.season.league.ageGroup);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

async function buildPreview() {
  const { canonical, duplicate } = await loadPlayers();
  const canonicalGameIds = new Set(canonical.gameStats.map((stat) => stat.gameId));
  const collisions = duplicate.gameStats.filter((stat) => canonicalGameIds.has(stat.gameId));

  const formulaVersion = await prisma.formulaVersion.findFirst({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 version row not found.");

  const projectedGps = await prisma.$queryRaw<
    Array<{ ageGroup: AgeGroup; gpsCount: number; avgFinalScore: number }>
  >`
    SELECT
      l."ageGroup" AS "ageGroup",
      COUNT(*)::int AS "gpsCount",
      AVG(gps."finalPerformanceScore")::float AS "avgFinalScore"
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    WHERE gps."deletedAt" IS NULL
      AND fv."versionNumber" = ${FORMULA_V1_VERSION_NUMBER}
      AND gps."finalPerformanceScore" IS NOT NULL
      AND gps."playerId" IN (
        CAST(${CANONICAL_PLAYER_ID} AS uuid),
        CAST(${DUPLICATE_PLAYER_ID} AS uuid)
      )
    GROUP BY l."ageGroup"
    ORDER BY l."ageGroup" ASC
  `;

  const projectedRatings = projectedGps.map((row) =>
    buildCumulativePlayerRatingTarget({
      playerId: CANONICAL_PLAYER_ID,
      ageGroup: row.ageGroup,
      gpsCount: row.gpsCount,
      avgFinalScore: row.avgFinalScore
    })
  );

  const rosterConflicts = duplicate.rosterSeasons.filter((row) =>
    canonical.rosterSeasons.some((canonicalRow) => canonicalRow.seasonId === row.seasonId)
  );

  return {
    canonical: {
      id: canonical.id,
      displayName: canonical.displayName,
      gameCount: canonical.gameStats.length,
      gamesByAgeGroup: gamesByAgeGroup(canonical.gameStats),
      ratings: canonical.currentRatings.map((rating) => ({
        ageGroup: rating.ageGroup,
        verifiedGameCount: rating.verifiedGameCount,
        adjustedRating: Number(rating.adjustedRating)
      }))
    },
    duplicate: {
      id: duplicate.id,
      displayName: duplicate.displayName,
      gameCount: duplicate.gameStats.length,
      gamesByAgeGroup: gamesByAgeGroup(duplicate.gameStats),
      ratings: duplicate.currentRatings.map((rating) => ({
        ageGroup: rating.ageGroup,
        verifiedGameCount: rating.verifiedGameCount,
        adjustedRating: Number(rating.adjustedRating)
      }))
    },
    sameGameCollisions: collisions.map((stat) => stat.gameId),
    rosterSeasonConflicts: rosterConflicts.map((row) => row.seasonId),
    projectedRatingsAfterMerge: projectedRatings
  };
}

async function buildBackup() {
  const [canonicalRatings, duplicateRatings, canonicalStats, duplicateStats, duplicateRosters] = await Promise.all([
    prisma.playerRating.findMany({ where: { playerId: CANONICAL_PLAYER_ID } }),
    prisma.playerRating.findMany({ where: { playerId: DUPLICATE_PLAYER_ID } }),
    prisma.gameStat.findMany({ where: { playerId: CANONICAL_PLAYER_ID, deletedAt: null } }),
    prisma.gameStat.findMany({ where: { playerId: DUPLICATE_PLAYER_ID, deletedAt: null } }),
    prisma.playerTeamSeason.findMany({ where: { playerId: DUPLICATE_PLAYER_ID, deletedAt: null } })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    canonicalPlayerId: CANONICAL_PLAYER_ID,
    duplicatePlayerId: DUPLICATE_PLAYER_ID,
    canonicalRatings,
    duplicateRatings,
    canonicalGameStatIds: canonicalStats.map((row) => row.id),
    duplicateGameStatIds: duplicateStats.map((row) => row.id),
    duplicateRosterSeasonIds: duplicateRosters.map((row) => row.id)
  };
}

async function executeMerge() {
  const formulaVersion = await prisma.formulaVersion.findFirst({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 version row not found.");

  const preview = await buildPreview();
  if (preview.sameGameCollisions.length) {
    throw new Error(`Same-game collision(s) block merge: ${preview.sameGameCollisions.join(", ")}`);
  }

  const mergeSummary = await prisma.$transaction(async (tx) => {
    const now = new Date();

    const gameStatUpdate = await tx.gameStat.updateMany({
      where: { playerId: DUPLICATE_PLAYER_ID, deletedAt: null },
      data: { playerId: CANONICAL_PLAYER_ID }
    });

    const gpsUpdate = await tx.gamePerformanceScore.updateMany({
      where: { playerId: DUPLICATE_PLAYER_ID, deletedAt: null },
      data: { playerId: CANONICAL_PLAYER_ID }
    });

    await tx.playerProgramHistory.updateMany({
      where: { playerId: DUPLICATE_PLAYER_ID },
      data: { playerId: CANONICAL_PLAYER_ID }
    });

    await tx.playerProfileSubmission.updateMany({
      where: { playerId: DUPLICATE_PLAYER_ID },
      data: { playerId: CANONICAL_PLAYER_ID }
    });

    for (const seasonId of preview.rosterSeasonConflicts) {
      await tx.playerTeamSeason.updateMany({
        where: { playerId: DUPLICATE_PLAYER_ID, seasonId, deletedAt: null },
        data: { deletedAt: now }
      });
    }

    const rosterReassign = await tx.playerTeamSeason.updateMany({
      where: {
        playerId: DUPLICATE_PLAYER_ID,
        deletedAt: null,
        seasonId: { notIn: preview.rosterSeasonConflicts }
      },
      data: { playerId: CANONICAL_PLAYER_ID }
    });

    const duplicateRatingsDeleted = await tx.playerRating.deleteMany({
      where: { playerId: DUPLICATE_PLAYER_ID }
    });

    const duplicateSnapshotRowsDeleted = await tx.rankingSnapshotRow.deleteMany({
      where: { playerId: DUPLICATE_PLAYER_ID }
    });

    await tx.playerAlias.upsert({
      where: {
        aliasName_gender: {
          aliasName: DUPLICATE_DISPLAY_NAME,
          gender: PlayerGender.BOYS
        }
      },
      update: {
        playerId: CANONICAL_PLAYER_ID,
        source: "merge-keefe-iledan",
        note: "Merged duplicate identity Keefy Iledan"
      },
      create: {
        playerId: CANONICAL_PLAYER_ID,
        aliasName: DUPLICATE_DISPLAY_NAME,
        gender: PlayerGender.BOYS,
        source: "merge-keefe-iledan",
        note: "Merged duplicate identity Keefy Iledan"
      }
    });

    await tx.player.update({
      where: { id: CANONICAL_PLAYER_ID },
      data: {
        displayName: CANONICAL_DISPLAY_NAME,
        firstName: "Keefe",
        lastName: "Iledan"
      }
    });

    const duplicateSoftDeleted = await tx.player.updateMany({
      where: { id: DUPLICATE_PLAYER_ID, deletedAt: null },
      data: { deletedAt: now }
    });

    return {
      gameStatsReassigned: gameStatUpdate.count,
      gamePerformanceScoresReassigned: gpsUpdate.count,
      rosterSeasonsReassigned: rosterReassign.count,
      rosterSeasonConflictsSoftDeleted: preview.rosterSeasonConflicts.length,
      duplicateRatingsDeleted: duplicateRatingsDeleted.count,
      duplicateSnapshotRowsDeleted: duplicateSnapshotRowsDeleted.count,
      duplicatePlayersSoftDeleted: duplicateSoftDeleted.count
    };
  });

  const cumulativeRows = await loadCumulativeFormulaV1Gps({
    playerIds: [CANONICAL_PLAYER_ID]
  });
  const ratingTargets = cumulativeRows.map((row) => buildCumulativePlayerRatingTarget(row));
  const ratingUpsert = await upsertCumulativePlayerRatings(ratingTargets, {
    formulaVersionId: formulaVersion.id,
    policyVersionId: FORMULA_V1_POLICY_ID
  });

  const staleRatings = await prisma.playerRating.findMany({
    where: {
      playerId: CANONICAL_PLAYER_ID,
      policyVersionId: FORMULA_V1_POLICY_ID,
      formulaVersionId: formulaVersion.id
    }
  });
  const targetKeys = new Set(ratingTargets.map((row) => row.ageGroup));
  let staleRatingsDeleted = 0;
  for (const rating of staleRatings) {
    if (!targetKeys.has(rating.ageGroup)) {
      await prisma.playerRating.delete({ where: { id: rating.id } });
      staleRatingsDeleted += 1;
    }
  }

  return {
    mergeSummary,
    ratingUpsert,
    recalculatedRatings: ratingTargets,
    staleRatingsDeleted
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const recomputeOnly = process.argv.includes("--recompute-only");
  mkdirSync(REPORT_DIR, { recursive: true });

  if (recomputeOnly) {
    const formulaVersion = await prisma.formulaVersion.findFirst({
      where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
      select: { id: true }
    });
    if (!formulaVersion) throw new Error("Formula v1 version row not found.");

    const cumulativeRows = await loadCumulativeFormulaV1Gps({
      playerIds: [CANONICAL_PLAYER_ID]
    });
    const ratingTargets = cumulativeRows.map((row) => buildCumulativePlayerRatingTarget(row));
    const ratingUpsert = await upsertCumulativePlayerRatings(ratingTargets, {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_V1_POLICY_ID
    });

    const staleRatings = await prisma.playerRating.findMany({
      where: {
        playerId: CANONICAL_PLAYER_ID,
        policyVersionId: FORMULA_V1_POLICY_ID,
        formulaVersionId: formulaVersion.id
      }
    });
    const targetKeys = new Set(ratingTargets.map((row) => row.ageGroup));
    let staleRatingsDeleted = 0;
    for (const rating of staleRatings) {
      if (!targetKeys.has(rating.ageGroup)) {
        await prisma.playerRating.delete({ where: { id: rating.id } });
        staleRatingsDeleted += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: "recompute-only",
          ratingUpsert,
          recalculatedRatings: ratingTargets,
          staleRatingsDeleted,
          canonicalRatings: await prisma.playerRating.findMany({
            where: { playerId: CANONICAL_PLAYER_ID, policyVersionId: FORMULA_V1_POLICY_ID },
            select: { ageGroup: true, verifiedGameCount: true, adjustedRating: true, starRating: true }
          })
        },
        null,
        2
      )
    );
    return;
  }

  const preview = await buildPreview();
  const previewPath = join(REPORT_DIR, "keefe-iledan-merge-preview.json");
  writeFileSync(previewPath, JSON.stringify(preview, null, 2), "utf8");

  if (!execute) {
    if (!preview.duplicate) {
      console.log(JSON.stringify({ mode: "dry-run", message: "Duplicate already merged.", canonical: preview.canonical }, null, 2));
      return;
    }
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          previewPath,
          canonical: preview.canonical,
          duplicate: preview.duplicate,
          projectedRatingsAfterMerge: preview.projectedRatingsAfterMerge,
          hint: "Re-run with --execute to merge Keefy into Keefe and recompute ratings."
        },
        null,
        2
      )
    );
    return;
  }

  const backupPath = join(REPORT_DIR, `keefe-iledan-merge-backup-${timestampForFilename()}.json`);
  writeFileSync(backupPath, JSON.stringify(await buildBackup(), null, 2), "utf8");

  const result = await executeMerge();

  const validation = {
    duplicateStillActive: await prisma.player.count({
      where: { id: DUPLICATE_PLAYER_ID, deletedAt: null }
    }),
    duplicateGameStatsRemaining: await prisma.gameStat.count({
      where: { playerId: DUPLICATE_PLAYER_ID, deletedAt: null }
    }),
    canonicalGameStats: await prisma.gameStat.count({
      where: { playerId: CANONICAL_PLAYER_ID, deletedAt: null }
    }),
    canonicalRatings: await prisma.playerRating.findMany({
      where: { playerId: CANONICAL_PLAYER_ID, policyVersionId: FORMULA_V1_POLICY_ID },
      select: { ageGroup: true, verifiedGameCount: true, adjustedRating: true, starRating: true }
    })
  };

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "execute",
    backupPath,
    previewPath,
    ...result,
    validation
  };
  const reportPath = join(REPORT_DIR, "keefe-iledan-merge-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath, backupPath, ...report }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
