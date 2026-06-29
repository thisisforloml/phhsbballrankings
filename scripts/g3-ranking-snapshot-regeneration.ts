/**
 * G3 - RankingSnapshot regeneration from live cumulative PlayerRating data.
 *
 * Snapshot Policy Rev 2: preview/dry-run only. --execute is disabled to protect
 * historical snapshot rows. Forward publishes use buildSnapshotBoardRows paths.
 *
 * Usage:
 *   npx tsx scripts/g3-ranking-snapshot-regeneration.ts           # preview only
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { buildSnapshotBoardRows } from "../src/lib/snapshot-board-rows";
import { getMonthStart } from "../src/lib/ranking-eligibility";
import { prisma } from "../src/lib/prisma";

const FORMULA_V1 = 1;
const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const AGE_GROUPS = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const;
const GENDERS = [PlayerGender.BOYS, PlayerGender.GIRLS] as const;

type SnapshotMeta = {
  id: string;
  scope: RankingScope;
  ageGroup: AgeGroup | null;
  gender: PlayerGender;
  formulaVersionId: string;
  city: string | null;
  region: string | null;
  weekOf: Date;
  createdAt: Date;
};

type SnapshotRowInput = {
  playerId: string;
  rank: number;
  rating: number;
  starRating: number;
  verifiedGameCount: number;
  movement: number;
  ageVerificationStatus: string;
};

type SnapshotPlan = {
  snapshot: SnapshotMeta;
  beforeRows: number;
  expectedRows: SnapshotRowInput[];
  eligibleByThreshold: number;
  excludedByEligibility: number;
  action: "update" | "skip";
};

function displayGender(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function boardKey(snapshot: Pick<SnapshotMeta, "scope" | "ageGroup" | "gender" | "formulaVersionId" | "city" | "region">) {
  return [
    snapshot.scope,
    snapshot.ageGroup ?? "ALL",
    snapshot.gender,
    snapshot.formulaVersionId,
    snapshot.city ?? "national",
    snapshot.region ?? "national"
  ].join("|");
}

async function loadSnapshotBackup() {
  const snapshots = await prisma.rankingSnapshot.findMany({
    include: {
      rows: {
        orderBy: [{ rank: "asc" }, { playerId: "asc" }]
      }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  return {
    generatedAt: new Date().toISOString(),
    phase: "G3-ranking-snapshot-backup",
    tableScope: ["ranking_snapshots", "ranking_snapshot_rows"],
    snapshotCount: snapshots.length,
    snapshotRowCount: snapshots.reduce((sum, snapshot) => sum + snapshot.rows.length, 0),
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      scope: snapshot.scope,
      ageGroup: snapshot.ageGroup,
      gender: snapshot.gender,
      formulaVersionId: snapshot.formulaVersionId,
      city: snapshot.city,
      region: snapshot.region,
      weekOf: snapshot.weekOf.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
      rowCount: snapshot.rows.length,
      rows: snapshot.rows.map((row) => ({
        id: row.id,
        snapshotId: row.snapshotId,
        playerId: row.playerId,
        rank: row.rank,
        rating: Number(row.rating),
        starRating: row.starRating,
        verifiedGameCount: row.verifiedGameCount,
        movement: row.movement
      }))
    })),
    rollbackInstructions: {
      summary:
        "Delete snapshots created by G3, delete all current rows for backed-up snapshot IDs, then restore ranking_snapshots and ranking_snapshot_rows from snapshots[].",
      tables: ["ranking_snapshots", "ranking_snapshot_rows"],
      protectedTables: ["players", "teams", "games", "game_stats", "game_performance_scores", "player_ratings"],
      notes: [
        "For each snapshots[] item, upsert ranking_snapshots by id with the saved metadata.",
        "For each backed-up snapshot id, delete current ranking_snapshot_rows before inserting saved rows[] by id.",
        "Delete any RankingSnapshot ids listed in the regeneration report under createdSnapshots before restoring backup rows."
      ]
    }
  };
}

async function expectedRowsForSnapshot(snapshot: SnapshotMeta): Promise<{
  rows: SnapshotRowInput[];
  eligibleByThreshold: number;
  excludedByEligibility: number;
}> {
  if (!snapshot.ageGroup) return { rows: [], eligibleByThreshold: 0, excludedByEligibility: 0 };

  const built = await buildSnapshotBoardRows({
    ageGroup: snapshot.ageGroup,
    gender: snapshot.gender,
    evaluationDate: snapshot.weekOf,
    formulaVersionId: snapshot.formulaVersionId,
    city: snapshot.city,
    region: snapshot.region
  });

  return {
    rows: built.rows.map((row) => ({
      playerId: row.playerId,
      rank: row.rank,
      rating: row.rating,
      starRating: row.starRating,
      verifiedGameCount: row.verifiedGameCount,
      movement: row.movement,
      ageVerificationStatus: row.ageVerificationStatus
    })),
    eligibleByThreshold: built.poolAtThreshold,
    excludedByEligibility: built.excludedByVisibility
  };
}

async function loadExistingSnapshotPlans(snapshots: SnapshotMeta[]): Promise<SnapshotPlan[]> {
  return Promise.all(snapshots.map(async (snapshot) => {
    const beforeRows = await prisma.rankingSnapshotRow.count({ where: { snapshotId: snapshot.id } });
    const expected = await expectedRowsForSnapshot(snapshot);

    return {
      snapshot,
      beforeRows,
      expectedRows: expected.rows,
      eligibleByThreshold: expected.eligibleByThreshold,
      excludedByEligibility: expected.excludedByEligibility,
      action: snapshot.ageGroup ? "update" : "skip"
    };
  }));
}

async function loadMissingActiveNationalBoards(formulaVersionId: string, existingSnapshots: SnapshotMeta[]) {
  const existingKeys = new Set(
    existingSnapshots
      .filter((snapshot) => snapshot.scope === RankingScope.NATIONAL && snapshot.city === null && snapshot.region === null)
      .map(boardKey)
  );
  const snapshotDate = getMonthStart(new Date());
  const missing: Array<{
    scope: RankingScope.NATIONAL;
    ageGroup: AgeGroup;
    gender: PlayerGender;
    formulaVersionId: string;
    city: null;
    region: null;
    weekOf: Date;
    rows: SnapshotRowInput[];
    eligibleByThreshold: number;
    excludedByEligibility: number;
  }> = [];

  for (const ageGroup of AGE_GROUPS) {
    for (const gender of GENDERS) {
      const candidate = {
        scope: RankingScope.NATIONAL,
        ageGroup,
        gender,
        formulaVersionId,
        city: null,
        region: null,
        weekOf: snapshotDate,
        createdAt: new Date()
      };
      if (existingKeys.has(boardKey(candidate))) continue;

      const expected = await expectedRowsForSnapshot(candidate);
      if (expected.rows.length === 0) continue;

      missing.push({
        scope: RankingScope.NATIONAL,
        ageGroup,
        gender,
        formulaVersionId,
        city: null,
        region: null,
        weekOf: snapshotDate,
        rows: expected.rows,
        eligibleByThreshold: expected.eligibleByThreshold,
        excludedByEligibility: expected.excludedByEligibility
      });
    }
  }

  return missing;
}

async function loadSnapshotCounts() {
  const snapshots = await prisma.rankingSnapshot.findMany({
    select: {
      id: true,
      scope: true,
      ageGroup: true,
      gender: true,
      formulaVersionId: true,
      city: true,
      region: true,
      weekOf: true,
      createdAt: true,
      _count: { select: { rows: true } }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  return {
    snapshotCount: snapshots.length,
    snapshotRowCount: snapshots.reduce((sum, snapshot) => sum + snapshot._count.rows, 0),
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      scope: snapshot.scope,
      ageGroup: snapshot.ageGroup,
      gender: snapshot.gender,
      formulaVersionId: snapshot.formulaVersionId,
      city: snapshot.city,
      region: snapshot.region,
      weekOf: snapshot.weekOf.toISOString(),
      createdAt: snapshot.createdAt.toISOString(),
      rowCount: snapshot._count.rows
    }))
  };
}

async function executeRegeneration(plans: SnapshotPlan[], missingBoards: Awaited<ReturnType<typeof loadMissingActiveNationalBoards>>) {
  return prisma.$transaction(async (tx) => {
    const updatedSnapshots: Array<{ snapshotId: string; beforeRows: number; afterRows: number }> = [];
    const skippedSnapshots: Array<{ snapshotId: string; reason: string }> = [];
    const createdSnapshots: Array<{ snapshotId: string; ageGroup: AgeGroup; gender: PlayerGender; rowsCreated: number }> = [];
    let rowsDeleted = 0;
    let rowsCreated = 0;

    for (const plan of plans) {
      if (plan.action === "skip") {
        skippedSnapshots.push({ snapshotId: plan.snapshot.id, reason: "Snapshot has no ageGroup metadata." });
        continue;
      }

      const deleted = await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId: plan.snapshot.id } });
      rowsDeleted += deleted.count;

      if (plan.expectedRows.length > 0) {
        const created = await tx.rankingSnapshotRow.createMany({
          data: plan.expectedRows.map((row) => ({
            snapshotId: plan.snapshot.id,
            ...row
          }))
        });
        rowsCreated += created.count;
      }

      updatedSnapshots.push({
        snapshotId: plan.snapshot.id,
        beforeRows: plan.beforeRows,
        afterRows: plan.expectedRows.length
      });
    }

    for (const board of missingBoards) {
      const snapshot = await tx.rankingSnapshot.create({
        data: {
          scope: board.scope,
          ageGroup: board.ageGroup,
          gender: board.gender,
          formulaVersionId: board.formulaVersionId,
          city: board.city,
          region: board.region,
          weekOf: board.weekOf,
          rows: {
            create: board.rows
          }
        },
        select: { id: true, _count: { select: { rows: true } } }
      });
      rowsCreated += snapshot._count.rows;
      createdSnapshots.push({
        snapshotId: snapshot.id,
        ageGroup: board.ageGroup,
        gender: board.gender,
        rowsCreated: snapshot._count.rows
      });
    }

    return { updatedSnapshots, skippedSnapshots, createdSnapshots, rowsDeleted, rowsCreated };
  });
}

async function validateSnapshots(formulaVersionId: string) {
  const snapshots = await prisma.rankingSnapshot.findMany({
    include: {
      rows: {
        orderBy: { rank: "asc" }
      }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const issues: Array<Record<string, unknown>> = [];
  const snapshotSummaries: Array<Record<string, unknown>> = [];

  for (const snapshot of snapshots) {
    const expected = await expectedRowsForSnapshot(snapshot);
    const expectedByPlayer = new Map(expected.rows.map((row) => [row.playerId, row]));
    const actualPlayers = new Set<string>();
    const actualRanks = new Set<number>();
    let previousRating: number | null = null;

    if (snapshot.rows.length !== expected.rows.length) {
      issues.push({
        snapshotId: snapshot.id,
        issue: "row_count_mismatch",
        expected: expected.rows.length,
        actual: snapshot.rows.length
      });
    }

    for (const row of snapshot.rows) {
      const expectedRow = expectedByPlayer.get(row.playerId);
      const actualRating = Number(row.rating);

      if (!expectedRow) {
        issues.push({ snapshotId: snapshot.id, playerId: row.playerId, issue: "row_without_current_live_eligible_rating" });
        continue;
      }
      if (actualPlayers.has(row.playerId)) issues.push({ snapshotId: snapshot.id, playerId: row.playerId, issue: "duplicate_player" });
      actualPlayers.add(row.playerId);
      if (actualRanks.has(row.rank)) issues.push({ snapshotId: snapshot.id, rank: row.rank, issue: "duplicate_rank" });
      actualRanks.add(row.rank);
      if (previousRating !== null && actualRating > previousRating) {
        issues.push({ snapshotId: snapshot.id, playerId: row.playerId, issue: "rank_order_violation" });
      }
      previousRating = actualRating;
      if (row.rank !== expectedRow.rank) issues.push({ snapshotId: snapshot.id, playerId: row.playerId, issue: "rank_mismatch", expected: expectedRow.rank, actual: row.rank });
      if (Math.abs(actualRating - expectedRow.rating) > 0.01) issues.push({ snapshotId: snapshot.id, playerId: row.playerId, issue: "rating_mismatch", expected: expectedRow.rating, actual: actualRating });
      if (row.starRating !== expectedRow.starRating) issues.push({ snapshotId: snapshot.id, playerId: row.playerId, issue: "star_mismatch", expected: expectedRow.starRating, actual: row.starRating });
      if (row.verifiedGameCount !== expectedRow.verifiedGameCount) {
        issues.push({
          snapshotId: snapshot.id,
          playerId: row.playerId,
          issue: "verified_game_count_mismatch",
          expected: expectedRow.verifiedGameCount,
          actual: row.verifiedGameCount
        });
      }
    }

    for (let rank = 1; rank <= snapshot.rows.length; rank += 1) {
      if (!actualRanks.has(rank)) issues.push({ snapshotId: snapshot.id, rank, issue: "missing_continuous_rank" });
    }

    snapshotSummaries.push({
      snapshotId: snapshot.id,
      scope: snapshot.scope,
      ageGroup: snapshot.ageGroup,
      gender: snapshot.gender,
      city: snapshot.city,
      region: snapshot.region,
      weekOf: snapshot.weekOf.toISOString(),
      rows: snapshot.rows.length,
      expectedRows: expected.rows.length,
      eligibleByThreshold: expected.eligibleByThreshold,
      excludedByEligibility: expected.excludedByEligibility
    });
  }

  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM ranking_snapshot_rows r
    LEFT JOIN ranking_snapshots s ON s.id = r."snapshotId"
    LEFT JOIN players p ON p.id = r."playerId" AND p."deletedAt" IS NULL
    LEFT JOIN player_ratings pr ON pr."playerId" = r."playerId" AND pr."ageGroup" = s."ageGroup"
    WHERE s.id IS NULL OR p.id IS NULL OR pr.id IS NULL
  `;

  const missingBoardIssues = [];
  for (const ageGroup of AGE_GROUPS) {
    for (const gender of GENDERS) {
      const candidate = {
        id: "validation-candidate",
        scope: RankingScope.NATIONAL,
        ageGroup,
        gender,
        formulaVersionId,
        city: null,
        region: null,
        weekOf: getMonthStart(new Date()),
        createdAt: new Date()
      };
      const expected = await expectedRowsForSnapshot(candidate);
      if (expected.rows.length === 0) continue;
      const hasBoard = snapshots.some(
        (snapshot) =>
          snapshot.scope === RankingScope.NATIONAL &&
          snapshot.ageGroup === ageGroup &&
          snapshot.gender === gender &&
          snapshot.formulaVersionId === formulaVersionId &&
          snapshot.city === null &&
          snapshot.region === null
      );
      if (!hasBoard) {
        missingBoardIssues.push({
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender,
          expectedRows: expected.rows.length
        });
      }
    }
  }

  const orphanRowCount = Number(orphanRows[0]?.count ?? 0);
  return {
    snapshotSummaries,
    issueCount: issues.length,
    issues: issues.slice(0, 100),
    orphanSnapshotRows: orphanRowCount,
    missingBoards: missingBoardIssues,
    validationPassed: issues.length === 0 && orphanRowCount === 0 && missingBoardIssues.length === 0
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  mkdirSync(REPORT_DIR, { recursive: true });

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1 },
    select: { id: true, versionNumber: true }
  });
  if (!formulaVersion) throw new Error(`Missing FormulaVersion v${FORMULA_V1}.`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = await loadSnapshotBackup();
  const backupPath = join(REPORT_DIR, `g3-ranking-snapshot-backup-${timestamp}.json`);
  const backupLatestPath = join(REPORT_DIR, "g3-ranking-snapshot-backup.json");
  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");

  const beforeCounts = await loadSnapshotCounts();
  const snapshotMetas: SnapshotMeta[] = beforeCounts.snapshots.map((snapshot) => ({
    id: snapshot.id,
    scope: snapshot.scope,
    ageGroup: snapshot.ageGroup,
    gender: snapshot.gender,
    formulaVersionId: snapshot.formulaVersionId,
    city: snapshot.city,
    region: snapshot.region,
    weekOf: new Date(snapshot.weekOf),
    createdAt: new Date(snapshot.createdAt)
  }));
  const plans = await loadExistingSnapshotPlans(snapshotMetas);
  const missingBoards = await loadMissingActiveNationalBoards(formulaVersion.id, snapshotMetas);

  if (!execute) {
    const previewPath = join(REPORT_DIR, "g3-ranking-snapshot-regeneration-preview.json");
    writeFileSync(
      previewPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          phase: "G3-ranking-snapshot-regeneration-preview",
          mode: "read-only",
          backupPath,
          beforeCounts,
          plannedExistingSnapshotUpdates: plans.map((plan) => ({
            snapshotId: plan.snapshot.id,
            scope: plan.snapshot.scope,
            ageGroup: plan.snapshot.ageGroup,
            gender: plan.snapshot.gender,
            weekOf: plan.snapshot.weekOf.toISOString(),
            beforeRows: plan.beforeRows,
            afterRows: plan.expectedRows.length,
            eligibleByThreshold: plan.eligibleByThreshold,
            excludedByEligibility: plan.excludedByEligibility,
            action: plan.action
          })),
          plannedMissingBoardCreates: missingBoards.map((board) => ({
            scope: board.scope,
            ageGroup: board.ageGroup,
            gender: board.gender,
            weekOf: board.weekOf.toISOString(),
            rows: board.rows.length,
            eligibleByThreshold: board.eligibleByThreshold,
            excludedByEligibility: board.excludedByEligibility
          })),
          nextStep: "Preview only. G3 --execute is disabled under Snapshot Policy Rev 2 — historical snapshots must not be rewritten.",
          snapshotPolicy: "rev-2-public-rank-allowed",
          historicalRewriteProhibited: true,
          protectedTables: backup.rollbackInstructions.protectedTables
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(JSON.stringify({ mode: "preview", backupPath, previewPath, snapshots: beforeCounts.snapshotCount, rows: beforeCounts.snapshotRowCount }, null, 2));
    return;
  }

  throw new Error(
    "G3 --execute is disabled under Snapshot Policy Rev 2. Historical RankingSnapshot rows must not be rewritten. " +
      "Use forward publish paths (generateImportedSubmissionMonthlyRankings, generate-ranking-snapshots-v1) instead."
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
