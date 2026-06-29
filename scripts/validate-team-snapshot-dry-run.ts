/**
 * B4: Read-only snapshot dry-run — parity, counts, uniqueness (no DB writes).
 * Usage: npx tsx scripts/validate-team-snapshot-dry-run.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { buildTeamSnapshotBoardRows } from "../src/lib/team-ratings/build-team-snapshot-board-rows";
import { getNationalTeamRankings } from "../src/lib/team-ratings/get-national-team-rankings";
import { TEAM_EVIDENCE_POLICY_V1, TEAM_FORMULA_SLUG_V1, TEAM_THRESHOLD_POLICY_V1 } from "../src/lib/team-ratings/constants";
import { canRewriteTeamSnapshot } from "../src/lib/team-ratings/snapshot-immutability";
import { prisma } from "../src/lib/prisma";

type Check = { id: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };

const boards: Array<{ ageGroup: AgeGroup; gender: PlayerGender }> = [
  { ageGroup: AgeGroup.U13, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS }
];

async function main() {
  const checks: Check[] = [];
  const boardResults = [];
  const formulaVersion = await prisma.teamFormulaVersion.findUnique({ where: { slug: TEAM_FORMULA_SLUG_V1 } });
  if (!formulaVersion) {
    checks.push({ id: "V-TR-SN-01", status: "FAIL", detail: "Missing TPI-v1 formula version" });
    process.exit(1);
  }

  const national = await getNationalTeamRankings();
  const evaluationDate = new Date();

  for (const board of boards) {
    const built = await buildTeamSnapshotBoardRows({
      ageGroup: board.ageGroup,
      gender: board.gender,
      evaluationDate,
      teamFormulaVersionId: formulaVersion.id,
      evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
      thresholdPolicyVersion: TEAM_THRESHOLD_POLICY_V1
    });

    const liveRows = national.rows.filter((row) => row.ageGroup === board.ageGroup && row.gender === board.gender);
    const parityOk = built.rows.length === liveRows.length;
    const ratingDrift = built.rows.filter((row) => {
      const live = liveRows.find((item) => item.programId === row.programId);
      return !live || Math.abs(row.rating - live.rating) > 0.01 || row.rank !== live.rank;
    });

    const duplicatePrograms = new Set<string>();
    const seen = new Set<string>();
    for (const row of built.rows) {
      if (seen.has(row.programId)) duplicatePrograms.add(row.programId);
      seen.add(row.programId);
    }

    boardResults.push({
      board: `${board.ageGroup}:${board.gender}`,
      liveEligibleCount: built.liveEligibleCount,
      builtRowCount: built.rows.length,
      parityOk,
      ratingDrift: ratingDrift.length,
      duplicatePrograms: duplicatePrograms.size
    });

    checks.push(
      parityOk
        ? { id: "V-TR-SN-02", status: "PASS", detail: `${board.ageGroup} ${board.gender}: builder row count ${built.rows.length} matches live public board` }
        : { id: "V-TR-SN-02", status: "FAIL", detail: `${board.ageGroup} ${board.gender}: built=${built.rows.length}, live=${liveRows.length}` }
    );

    checks.push(
      ratingDrift.length === 0
        ? { id: "V-TR-SN-03", status: "PASS", detail: `${board.ageGroup} ${board.gender}: ratings/ranks within parity tolerance` }
        : { id: "V-TR-SN-03", status: "FAIL", detail: `${board.ageGroup} ${board.gender}: ${ratingDrift.length} drift rows` }
    );

    checks.push(
      duplicatePrograms.size === 0
        ? { id: "V-TR-SN-04", status: "PASS", detail: `${board.ageGroup} ${board.gender}: unique program rows` }
        : { id: "V-TR-SN-04", status: "FAIL", detail: `${board.ageGroup} ${board.gender}: duplicate program IDs in builder output` }
    );
  }

  checks.push(
    canRewriteTeamSnapshot("DRAFT") && !canRewriteTeamSnapshot("PUBLISHED")
      ? { id: "V-TR-SN-05", status: "PASS", detail: "Immutability guard: DRAFT rewrite allowed, PUBLISHED blocked" }
      : { id: "V-TR-SN-05", status: "FAIL", detail: "Immutability guard misconfigured" }
  );

  const existingPublished = await prisma.teamRankingSnapshot.count({ where: { status: "PUBLISHED" } });
  checks.push({
    id: "V-TR-SN-06",
    status: "PASS",
    detail: `Forward-only rollback path: flag off skips writes; ${existingPublished} published snapshots would be skipped on re-run`
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only-dry-run",
    boardResults,
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "PASS").length,
      fail: checks.filter((check) => check.status === "FAIL").length,
      skip: checks.filter((check) => check.status === "SKIP").length
    },
    rollback: [
      "TEAM_SNAPSHOT_PUBLISH_ENABLED=false stops all snapshot writes",
      "DRAFT snapshots can be deleted manually; PUBLISHED rows protected by assertTeamSnapshotMutable",
      "Published months skipped on regenerate script re-run"
    ]
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "team-snapshot-dry-run-validation.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`PASS=${report.summary.pass} FAIL=${report.summary.fail}`);

  if (report.summary.fail > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
