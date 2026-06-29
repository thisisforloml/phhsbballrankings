/**
 * G1 — cumulative Formula v1 PlayerRating remediation.
 *
 * Usage:
 *   npx tsx scripts/g1-player-rating-remediation.ts           # preview only
 *   npx tsx scripts/g1-player-rating-remediation.ts --execute # backup + recompute + validate
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { publicBoardMinimumGames } from "../src/lib/public-board-ranks";
import type { RankingAgeGroup } from "../src/lib/rankings";

const FORMULA_V1 = 1;
const RATING_TOLERANCE = 0.01;
const RATING_AGE_GROUPS: RankingAgeGroup[] = ["U13", "U16", "U19"];
const REPORT_DIR = join(process.cwd(), "scripts", "reports");

function starFromAdjustedRating(value: number) {
  if (value >= 90) return 5;
  if (value >= 80) return 4;
  if (value >= 70) return 3;
  if (value >= 60) return 2;
  return 1;
}

function genderLabel(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

type TargetRating = {
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  ageGroup: AgeGroup;
  observedRating: number;
  adjustedRating: number;
  verifiedGameCount: number;
  starRating: number;
  dominantLeagues: string[];
};

type BoardRow = {
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  ageGroup: AgeGroup;
  rating: number;
  verifiedGameCount: number;
  starRating: number;
  computedAgeBracket: ReturnType<typeof getCurrentRankingAgeBracket>;
};

function isPublicEligible(row: BoardRow, ageGroup: AgeGroup) {
  const minGames = publicBoardMinimumGames(genderLabel(row.gender));
  if (row.verifiedGameCount < minGames) return false;
  if (row.computedAgeBracket !== null && row.computedAgeBracket !== ageGroup && row.computedAgeBracket !== "OUT_OF_RANGE") {
    return false;
  }
  if (row.computedAgeBracket === "OUT_OF_RANGE") return false;
  return true;
}

async function loadGpsAggregation() {
  return prisma.$queryRaw<
    Array<{
      player_id: string;
      age_group: AgeGroup;
      gps_count: number;
      avg_final_score: number;
      league_names: string[];
    }>
  >`
    SELECT
      gps."playerId" AS player_id,
      l."ageGroup" AS age_group,
      COUNT(*)::int AS gps_count,
      AVG(gps."finalPerformanceScore")::float AS avg_final_score,
      array_agg(DISTINCT l.name ORDER BY l.name) AS league_names
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
  `;
}

async function buildTargetRatings() {
  const [gpsRows, players] = await Promise.all([
    loadGpsAggregation(),
    prisma.player.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true, gender: true }
    })
  ]);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const targets: TargetRating[] = [];

  for (const row of gpsRows) {
    const player = playerById.get(row.player_id);
    if (!player) continue;
    const observedRating = round(row.avg_final_score);
    targets.push({
      playerId: row.player_id,
      displayName: player.displayName,
      gender: player.gender,
      ageGroup: row.age_group,
      observedRating,
      adjustedRating: observedRating,
      verifiedGameCount: row.gps_count,
      starRating: starFromAdjustedRating(observedRating),
      dominantLeagues: row.league_names
    });
  }

  return targets;
}

async function loadStoredRatings() {
  return prisma.playerRating.findMany({
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true,
          deletedAt: true
        }
      }
    }
  });
}

function toBoardRow(
  target: TargetRating,
  computedAgeBracket: ReturnType<typeof getCurrentRankingAgeBracket>
): BoardRow {
  return {
    playerId: target.playerId,
    displayName: target.displayName,
    gender: target.gender,
    ageGroup: target.ageGroup,
    rating: target.adjustedRating,
    verifiedGameCount: target.verifiedGameCount,
    starRating: target.starRating,
    computedAgeBracket
  };
}

function computeEligibilityChanges(
  beforeTargets: Map<string, TargetRating>,
  afterTargets: Map<string, TargetRating>,
  playerMeta: Map<string, { birthDate: Date | null; classYearOverride: number | null }>
) {
  const changes: Array<{
    playerId: string;
    displayName: string;
    board: string;
    wasPublic: boolean;
    willBePublic: boolean;
    reason: string;
  }> = [];

  for (const [key, after] of afterTargets) {
    const before = beforeTargets.get(key);
    if (!before) continue;
    const meta = playerMeta.get(after.playerId);
    const bracket = getCurrentRankingAgeBracket(
      meta?.birthDate ?? null,
      new Date(),
      meta?.classYearOverride ?? null,
      after.ageGroup
    );
    const wasPublic = isPublicEligible(toBoardRow(before, bracket), after.ageGroup);
    const willBePublic = isPublicEligible(toBoardRow(after, bracket), after.ageGroup);
    if (wasPublic !== willBePublic) {
      changes.push({
        playerId: after.playerId,
        displayName: after.displayName,
        board: `${after.ageGroup} ${genderLabel(after.gender)}`,
        wasPublic,
        willBePublic,
        reason: willBePublic ? "gains_public_eligibility" : "loses_public_eligibility"
      });
    }
  }

  return changes;
}

async function buildBackupReport(stored: Awaited<ReturnType<typeof loadStoredRatings>>) {
  const active = stored.filter((row) => !row.player.deletedAt);
  return {
    generatedAt: new Date().toISOString(),
    phase: "G1-player-rating-backup",
    aggregationScope: "playerId + league.ageGroup (Formula v1 cumulative GPS)",
    rowCount: active.length,
    rows: active.map((row) => ({
      id: row.id,
      playerId: row.playerId,
      displayName: row.player.displayName,
      gender: row.player.gender,
      ageGroup: row.ageGroup,
      observedRating: Number(row.observedRating),
      adjustedRating: Number(row.adjustedRating),
      verifiedGameCount: row.verifiedGameCount,
      starRating: row.starRating,
      computedAt: row.computedAt.toISOString()
    })),
    rollbackInstructions: {
      summary: "Restore each PlayerRating row from rows[] via upsert by (playerId, ageGroup). Re-create deleted rows from backup.",
      tables: ["player_ratings"],
      note: "Does not restore RankingSnapshot rows — G1 scope excludes snapshots."
    }
  };
}

async function buildDiff(stored: Awaited<ReturnType<typeof loadStoredRatings>>, targets: TargetRating[]) {
  const storedMap = new Map<string, (typeof stored)[number]>();
  for (const row of stored) {
    if (row.player.deletedAt) continue;
    storedMap.set(`${row.playerId}|${row.ageGroup}`, row);
  }

  const targetMap = new Map(targets.map((row) => [`${row.playerId}|${row.ageGroup}`, row]));
  const playerMeta = new Map(
    stored
      .filter((row) => !row.player.deletedAt)
      .map((row) => [
        row.playerId,
        { birthDate: row.player.birthDate, classYearOverride: row.player.classYearOverride }
      ])
  );

  const beforeTargetMap = new Map<string, TargetRating>();
  for (const [key, row] of storedMap) {
    beforeTargetMap.set(key, {
      playerId: row.playerId,
      displayName: row.player.displayName,
      gender: row.player.gender,
      ageGroup: row.ageGroup,
      observedRating: Number(row.observedRating),
      adjustedRating: Number(row.adjustedRating),
      verifiedGameCount: row.verifiedGameCount,
      starRating: row.starRating,
      dominantLeagues: []
    });
  }

  const creates: TargetRating[] = [];
  const updates: Array<{ before: TargetRating; after: TargetRating; ratingDelta: number; gameDelta: number }> = [];
  const deletes: Array<{ playerId: string; displayName: string; ageGroup: AgeGroup; stored: TargetRating }> = [];
  let unchanged = 0;

  for (const [key, after] of targetMap) {
    const existing = storedMap.get(key);
    if (!existing) {
      creates.push(after);
      continue;
    }
    const before: TargetRating = beforeTargetMap.get(key)!;
    const ratingDelta = round(after.adjustedRating - before.adjustedRating);
    const gameDelta = after.verifiedGameCount - before.verifiedGameCount;
    const changed =
      Math.abs(before.observedRating - after.observedRating) > RATING_TOLERANCE ||
      before.verifiedGameCount !== after.verifiedGameCount ||
      before.starRating !== after.starRating;
    if (changed) updates.push({ before, after, ratingDelta, gameDelta });
    else unchanged += 1;
  }

  for (const [key, row] of storedMap) {
    if (!targetMap.has(key)) {
      deletes.push({
        playerId: row.playerId,
        displayName: row.player.displayName,
        ageGroup: row.ageGroup,
        stored: beforeTargetMap.get(key)!
      });
    }
  }

  const eligibilityChanges = computeEligibilityChanges(beforeTargetMap, targetMap, playerMeta);
  const largestMovers = updates
    .map((row) => ({
      playerId: row.after.playerId,
      displayName: row.after.displayName,
      board: `${row.after.ageGroup} ${genderLabel(row.after.gender)}`,
      ratingDelta: row.ratingDelta,
      verifiedGameCountDelta: row.gameDelta,
      beforeRating: row.before.adjustedRating,
      afterRating: row.after.adjustedRating,
      beforeGames: row.before.verifiedGameCount,
      afterGames: row.after.verifiedGameCount
    }))
    .sort((left, right) => Math.abs(right.ratingDelta) - Math.abs(left.ratingDelta))
    .slice(0, 50);

  return {
    changeCounts: {
      creates: creates.length,
      updates: updates.length,
      deletes: deletes.length,
      unchanged,
      totalTargets: targets.length,
      totalStoredBefore: storedMap.size
    },
    creates,
    updates,
    deletes,
    largestMovers,
    eligibilityChanges
  };
}

async function executeRecompute(targets: TargetRating[]) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const target of targets) {
      const existing = await tx.playerRating.findUnique({
        where: { playerId_ageGroup: { playerId: target.playerId, ageGroup: target.ageGroup } },
        select: { id: true }
      });
      await tx.playerRating.upsert({
        where: { playerId_ageGroup: { playerId: target.playerId, ageGroup: target.ageGroup } },
        update: {
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          computedAt: now
        },
        create: {
          playerId: target.playerId,
          ageGroup: target.ageGroup,
          observedRating: target.observedRating,
          adjustedRating: target.adjustedRating,
          verifiedGameCount: target.verifiedGameCount,
          starRating: target.starRating,
          computedAt: now
        }
      });
      if (existing) updated += 1;
      else created += 1;
    }

    const stored = await tx.playerRating.findMany({
      where: { player: { deletedAt: null } },
      select: { playerId: true, ageGroup: true }
    });
    const targetKeys = new Set(targets.map((row) => `${row.playerId}|${row.ageGroup}`));
    for (const row of stored) {
      const key = `${row.playerId}|${row.ageGroup}`;
      if (!targetKeys.has(key)) {
        await tx.playerRating.delete({
          where: { playerId_ageGroup: { playerId: row.playerId, ageGroup: row.ageGroup } }
        });
        deleted += 1;
      }
    }

    return { created, updated, deleted, totalAfter: targets.length };
  });
}

async function runPhaseEValidation() {
  const [playerRatings, gpsByPlayerAge] = await Promise.all([
    prisma.playerRating.findMany({
      include: { player: { select: { deletedAt: true } } }
    }),
    loadGpsAggregation()
  ]);

  const gpsMap = new Map(gpsByPlayerAge.map((row) => [`${row.player_id}|${row.age_group}`, row]));
  let verifiedGameMismatches = 0;
  let ratingMismatches = 0;
  let ratingsWithoutGps = 0;
  let missingRatingsForGps = 0;
  let starMismatches = 0;

  const ratingKeys = new Set<string>();

  for (const rating of playerRatings) {
    if (rating.player.deletedAt) continue;
    const key = `${rating.playerId}|${rating.ageGroup}`;
    ratingKeys.add(key);
    const gps = gpsMap.get(key);
    const gpsCount = gps?.gps_count ?? 0;
    const recomputed = gps?.avg_final_score ?? null;
    if (gpsCount === 0) ratingsWithoutGps += 1;
    if (rating.verifiedGameCount !== gpsCount) verifiedGameMismatches += 1;
    if (recomputed !== null && Math.abs(Number(rating.observedRating) - recomputed) > 0.5) ratingMismatches += 1;
    if (rating.starRating !== starFromAdjustedRating(Number(rating.adjustedRating))) starMismatches += 1;
  }

  for (const row of gpsByPlayerAge) {
    const key = `${row.player_id}|${row.age_group}`;
    if (!ratingKeys.has(key)) missingRatingsForGps += 1;
  }

  const passed =
    verifiedGameMismatches === 0 &&
    ratingMismatches === 0 &&
    ratingsWithoutGps === 0 &&
    missingRatingsForGps === 0 &&
    starMismatches === 0;

  return {
    verifiedGameMismatches,
    ratingMismatches,
    starMismatches,
    ratingsWithoutGps,
    missingRatingsForGps,
    orphanRatings: ratingsWithoutGps + missingRatingsForGps,
    recommendation: passed ? "PROCEED" : "STOP",
    validationPassed: passed
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  mkdirSync(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const [stored, targets] = await Promise.all([loadStoredRatings(), buildTargetRatings()]);
  const backup = await buildBackupReport(stored);
  const diff = await buildDiff(stored, targets);

  const backupPath = join(REPORT_DIR, `g1-player-rating-backup-${timestamp}.json`);
  const backupLatestPath = join(REPORT_DIR, "g1-player-rating-backup.json");
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
  writeFileSync(backupLatestPath, JSON.stringify(backup, null, 2), "utf8");

  if (!execute) {
    const previewPath = join(REPORT_DIR, "g1-player-rating-recompute-preview.json");
    writeFileSync(
      previewPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          phase: "G1-preview",
          mode: "read-only",
          backupPath,
          changeCounts: diff.changeCounts,
          largestMovers: diff.largestMovers.slice(0, 25),
          eligibilityChanges: diff.eligibilityChanges.slice(0, 25),
          nextStep: "npx tsx scripts/g1-player-rating-remediation.ts --execute"
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(JSON.stringify({ mode: "preview", backupPath, previewPath, changeCounts: diff.changeCounts }, null, 2));
    return;
  }

  const beforeSummary = {
    rowCount: backup.rowCount,
    changeCounts: diff.changeCounts
  };

  const repairResult = await executeRecompute(targets);

  const afterStored = await loadStoredRatings();
  const phaseE = await runPhaseEValidation();

  const recomputeReport = {
    generatedAt: new Date().toISOString(),
    phase: "G1-player-rating-recompute",
    aggregationScope: "playerId + league.ageGroup (Formula v1 cumulative GPS)",
    backupPath,
    backupLatestPath,
    beforeSummary,
    afterSummary: {
      rowCount: afterStored.filter((row) => !row.player.deletedAt).length,
      repairResult
    },
    changeCounts: diff.changeCounts,
    repairResult,
    largestMovers: diff.largestMovers,
    eligibilityChanges: diff.eligibilityChanges,
    rollbackInstructions: backup.rollbackInstructions
  };

  const validationReport = {
    generatedAt: new Date().toISOString(),
    phase: "G1-player-rating-validation",
    phaseEChecks: phaseE,
    postRecomputeRowCount: afterStored.filter((row) => !row.player.deletedAt).length,
    snapshotRegeneration: "not performed (out of scope)",
    rollbackInstructions: backup.rollbackInstructions
  };

  const recomputePath = join(REPORT_DIR, "g1-player-rating-recompute-report.json");
  const validationPath = join(REPORT_DIR, "g1-player-rating-validation-report.json");
  writeFileSync(recomputePath, JSON.stringify(recomputeReport, null, 2), "utf8");
  writeFileSync(validationPath, JSON.stringify(validationReport, null, 2), "utf8");

  if (!phaseE.validationPassed) {
    throw new Error(`G1 validation failed: ${JSON.stringify(phaseE)}`);
  }

  console.log(
    JSON.stringify(
      {
        mode: "executed",
        backupPath,
        recomputePath,
        validationPath,
        repairResult,
        phaseE,
        eligibilityChanges: diff.eligibilityChanges.length
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
