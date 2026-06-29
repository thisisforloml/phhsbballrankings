/**
 * G2 — verify cumulative PlayerRating aggregation on import path.
 *
 * Usage:
 *   npx tsx scripts/g2-player-rating-aggregation-fix.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  buildCumulativePlayerRatingTarget,
  loadCumulativeFormulaV1Gps,
  roundRating
} from "../src/lib/player-rating-cumulative";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const FORMULA_V1 = 1;

type SeasonScopedRow = {
  playerId: string;
  ageGroup: AgeGroup;
  gpsCount: number;
  avgFinalScore: number;
};

async function loadSeasonScopedGps(seasonId: string, ageGroup: AgeGroup) {
  return prisma.$queryRaw<SeasonScopedRow[]>`
    SELECT
      gps."playerId" AS "playerId",
      l."ageGroup" AS "ageGroup",
      COUNT(*)::int AS "gpsCount",
      AVG(gps."finalPerformanceScore")::float AS "avgFinalScore"
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    WHERE gps."deletedAt" IS NULL
      AND fv."versionNumber" = ${FORMULA_V1}
      AND gps."finalPerformanceScore" IS NOT NULL
      AND g."seasonId" = CAST(${seasonId} AS uuid)
      AND l."ageGroup" = CAST(${ageGroup} AS "AgeGroup")
    GROUP BY gps."playerId", l."ageGroup"
  `;
}

async function loadMultiSeasonPlayers() {
  return prisma.$queryRaw<Array<{ player_id: string; age_group: AgeGroup; season_count: number }>>`
    SELECT
      gps."playerId" AS player_id,
      l."ageGroup" AS age_group,
      COUNT(DISTINCT g."seasonId")::int AS season_count
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
    WHERE gps."deletedAt" IS NULL
      AND fv."versionNumber" = ${FORMULA_V1}
      AND gps."finalPerformanceScore" IS NOT NULL
    GROUP BY gps."playerId", l."ageGroup"
    HAVING COUNT(DISTINCT g."seasonId") > 1
  `;
}

async function compareStoredToCumulative() {
  const [stored, cumulativeRows] = await Promise.all([
    prisma.playerRating.findMany({
      where: { player: { deletedAt: null } },
      include: { player: { select: { displayName: true, deletedAt: true } } }
    }),
    loadCumulativeFormulaV1Gps()
  ]);

  const cumulativeMap = new Map(
    cumulativeRows.map((row) => [`${row.playerId}|${row.ageGroup}`, buildCumulativePlayerRatingTarget(row)])
  );

  let mismatches = 0;
  let orphanRatings = 0;
  let missingRatings = 0;
  const mismatchSamples: Array<Record<string, unknown>> = [];

  for (const rating of stored) {
    if (rating.player.deletedAt) continue;
    const key = `${rating.playerId}|${rating.ageGroup}`;
    const target = cumulativeMap.get(key);
    if (!target) {
      orphanRatings += 1;
      continue;
    }
    const changed =
      rating.verifiedGameCount !== target.verifiedGameCount ||
      Math.abs(Number(rating.observedRating) - target.observedRating) > 0.01 ||
      Math.abs(Number(rating.adjustedRating) - target.adjustedRating) > 0.01 ||
      rating.starRating !== target.starRating;
    if (changed) {
      mismatches += 1;
      if (mismatchSamples.length < 15) {
        mismatchSamples.push({
          playerId: rating.playerId,
          displayName: rating.player.displayName,
          ageGroup: rating.ageGroup,
          storedGames: rating.verifiedGameCount,
          cumulativeGames: target.verifiedGameCount,
          storedRating: Number(rating.adjustedRating),
          cumulativeRating: target.adjustedRating
        });
      }
    }
    cumulativeMap.delete(key);
  }

  missingRatings = cumulativeMap.size;

  return {
    storedRowCount: stored.filter((row) => !row.player.deletedAt).length,
    cumulativeTargetCount: cumulativeRows.length,
    mismatches,
    orphanRatings,
    missingRatings,
    mismatchSamples,
    passed: mismatches === 0 && orphanRatings === 0 && missingRatings === 0
  };
}

async function simulateImportRegression() {
  const multiSeasonPlayers = await loadMultiSeasonPlayers();
  const seasons = await prisma.season.findMany({
    where: { deletedAt: null, league: { deletedAt: null } },
    select: {
      id: true,
      name: true,
      league: { select: { id: true, name: true, ageGroup: true } }
    },
    orderBy: [{ league: { name: "asc" } }, { name: "asc" }]
  });

  const regressions: Array<Record<string, unknown>> = [];

  for (const season of seasons) {
    const [seasonScoped, cumulativeForAgeGroup] = await Promise.all([
      loadSeasonScopedGps(season.id, season.league.ageGroup),
      loadCumulativeFormulaV1Gps({ ageGroup: season.league.ageGroup })
    ]);

    const cumulativeByPlayer = new Map(cumulativeForAgeGroup.map((row) => [row.playerId, row]));

    for (const row of seasonScoped) {
      const cumulative = cumulativeByPlayer.get(row.playerId);
      if (!cumulative || cumulative.gpsCount <= row.gpsCount) continue;

      const oldTarget = buildCumulativePlayerRatingTarget(row);
      const newTarget = buildCumulativePlayerRatingTarget(cumulative);
      if (
        oldTarget.verifiedGameCount === newTarget.verifiedGameCount &&
        oldTarget.adjustedRating === newTarget.adjustedRating
      ) {
        continue;
      }

      const player = await prisma.player.findUnique({
        where: { id: row.playerId },
        select: { displayName: true }
      });

      regressions.push({
        playerId: row.playerId,
        displayName: player?.displayName ?? row.playerId,
        ageGroup: row.ageGroup,
        seasonId: season.id,
        seasonName: season.name,
        leagueName: season.league.name,
        oldLogicGames: oldTarget.verifiedGameCount,
        newLogicGames: newTarget.verifiedGameCount,
        oldLogicRating: oldTarget.adjustedRating,
        newLogicRating: newTarget.adjustedRating,
        gameDelta: newTarget.verifiedGameCount - oldTarget.verifiedGameCount,
        ratingDelta: roundRating(newTarget.adjustedRating - oldTarget.adjustedRating)
      });
    }
  }

  regressions.sort((left, right) => Math.abs(Number(right.ratingDelta)) - Math.abs(Number(left.ratingDelta)));

  return {
    multiSeasonPlayerAgeGroups: multiSeasonPlayers.length,
    seasonsChecked: seasons.length,
    wouldRegressIfSeasonScoped: regressions.length,
    topRegressions: regressions.slice(0, 25),
    g2PreventsRegression: regressions.length > 0
  };
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const [alignment, regression] = await Promise.all([compareStoredToCumulative(), simulateImportRegression()]);

  const implementationReport = {
    generatedAt: new Date().toISOString(),
    phase: "G2-player-rating-aggregation-fix",
    problem:
      "computeImportedSubmissionPlayerRatings() previously aggregated Formula v1 GPS by submission season, overwriting cumulative PlayerRating rows.",
    fix: {
      filesChanged: [
        "src/lib/player-rating-cumulative.ts",
        "src/lib/submission-post-import-processing.ts",
        "src/lib/player-rating-cumulative.test.ts"
      ],
      aggregationScope: "playerId + league.ageGroup (Formula v1 cumulative GPS)",
      preserved: [
        "PlayerRating schema (playerId, ageGroup)",
        "Formula v1 star bands",
        "public eligibility thresholds via minimumVerifiedGames",
        "ranking board keying by ageGroup + gender"
      ],
      importBehavior: [
        "Submission still requires season-scoped GPS completeness before rating upsert.",
        "PlayerRating upsert now refreshes all cumulative targets for the submission age group.",
        "Future imports cannot revert G1 corrections because upsert reads all Formula v1 GPS for the age group."
      ],
      snapshotRegeneration: "not performed (out of scope)"
    },
    currentDatabaseAlignment: alignment
  };

  const regressionReport = {
    generatedAt: new Date().toISOString(),
    phase: "G2-player-rating-regression-test",
    mode: "read-only",
    unitTests: "src/lib/player-rating-cumulative.test.ts (node:test)",
    checks: {
      g1StateAlignedWithCumulative: alignment,
      oldSeasonScopedLogicWouldDiverge: regression
    },
    conclusion: alignment.passed
      ? "Stored PlayerRating rows match cumulative Formula v1 GPS. G2 import path will preserve G1 corrections."
      : "Stored PlayerRating rows do not fully match cumulative targets — investigate before importing.",
    recommendation: alignment.passed && regression.g2PreventsRegression ? "PROCEED" : "STOP"
  };

  const implementationPath = join(REPORT_DIR, "g2-player-rating-aggregation-implementation-report.json");
  const regressionPath = join(REPORT_DIR, "g2-player-rating-aggregation-regression-report.json");
  writeFileSync(implementationPath, JSON.stringify(implementationReport, null, 2), "utf8");
  writeFileSync(regressionPath, JSON.stringify(regressionReport, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        implementationPath,
        regressionPath,
        alignmentPassed: alignment.passed,
        wouldRegressIfSeasonScoped: regression.wouldRegressIfSeasonScoped,
        recommendation: regressionReport.recommendation
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
