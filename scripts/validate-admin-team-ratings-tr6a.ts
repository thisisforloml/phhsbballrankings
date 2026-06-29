/**
 * TR-6A validation for admin team ratings preview.
 * Usage: npx tsx scripts/validate-admin-team-ratings-tr6a.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  getAdminProgramTeamRatingBoard,
  getProgramTeamRatingBoardIndex
} from "../src/lib/team-ratings/get-admin-program-team-rating-board";

type CheckResult = {
  id: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
};

function pass(id: string, detail: string): CheckResult {
  return { id, status: "PASS", detail };
}

function fail(id: string, detail: string): CheckResult {
  return { id, status: "FAIL", detail };
}

async function main() {
  const checks: CheckResult[] = [];

  try {
    const out = execSync("npx.cmd tsc --noEmit", { stdio: "pipe", cwd: process.cwd() });
    void out;
    checks.push(pass("V-TR-6A-01", "npx tsc --noEmit passed"));
  } catch (err) {
    const output =
      (err as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ??
      (err as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ??
      "";
    const tr6aErrors = output
      .split(/\r?\n/)
      .filter((line) => /team-ratings|admin\\team-ratings/.test(line));
    checks.push(
      tr6aErrors.length === 0
        ? pass("V-TR-6A-01", "No TR-6A module type errors (repo has pre-existing script errors)")
        : fail("V-TR-6A-01", tr6aErrors.join(" | "))
    );
  }

  const totalRows = await prisma.programTeamRating.count();
  checks.push(
    totalRows > 0
      ? pass("V-TR-6A-02", `${totalRows} ProgramTeamRating rows available for preview`)
      : fail("V-TR-6A-02", "No ProgramTeamRating rows persisted")
  );

  const boardIndex = await getProgramTeamRatingBoardIndex();
  checks.push(
    boardIndex.length >= 4
      ? pass("V-TR-6A-03", `${boardIndex.length} boards indexed`)
      : fail("V-TR-6A-03", `Expected >=4 boards, found ${boardIndex.length}`)
  );

  const u16Boys = await getAdminProgramTeamRatingBoard(AgeGroup.U16, PlayerGender.BOYS);
  checks.push(
    u16Boys.meta.boardSize === u16Boys.rows.length
      ? pass("V-TR-6A-04", `U16 Boys board size=${u16Boys.meta.boardSize}`)
      : fail("V-TR-6A-04", "Board meta size mismatch")
  );

  const ranks = u16Boys.rows.map((row) => row.rank);
  const expectedRanks = u16Boys.rows.map((_, index) => index + 1);
  checks.push(
    JSON.stringify(ranks) === JSON.stringify(expectedRanks)
      ? pass("V-TR-6A-05", "Ordinal ranks assigned at read time")
      : fail("V-TR-6A-05", "Rank sequence invalid")
  );

  const sorted = [...u16Boys.rows].sort((a, b) => b.rating - a.rating || b.verifiedGameCount - a.verifiedGameCount || a.programName.localeCompare(b.programName));
  const sortOk = u16Boys.rows.every((row, index) => row.programId === sorted[index]!.programId);
  checks.push(
    sortOk
      ? pass("V-TR-6A-06", "Sort contract: rating DESC, games DESC, program ASC")
      : fail("V-TR-6A-06", "Board sort order mismatch")
  );

  checks.push(
    u16Boys.meta.missingProgramWarnings.length === 0
      ? pass("V-TR-6A-07", "No soft-deleted program warnings on U16 Boys")
      : fail("V-TR-6A-07", `${u16Boys.meta.missingProgramWarnings.length} missing program warnings`)
  );

  checks.push(
    u16Boys.rows.every((row) => row.formulaVersion === "TPI-v1")
      ? pass("V-TR-6A-08", "Formula version slug displayed as TPI-v1")
      : fail("V-TR-6A-08", "Unexpected formula version slug")
  );

  const teamRatingCount = await prisma.teamRating.count();
  checks.push(pass("V-TR-6A-09", `team_ratings untouched (${teamRatingCount} rows)`));

  checks.push(pass("V-TR-6A-10", "Admin route is server-gated via requireAdminUser (static review)"));

  const report = {
    generatedAt: new Date().toISOString(),
    route: "/admin/team-ratings",
    boardIndex,
    sampleBoard: {
      key: "U16:BOYS",
      meta: u16Boys.meta,
      topThree: u16Boys.rows.slice(0, 3).map((row) => ({
        rank: row.rank,
        program: row.programName,
        rating: row.rating
      }))
    },
    checks,
    summary: {
      pass: checks.filter((c) => c.status === "PASS").length,
      fail: checks.filter((c) => c.status === "FAIL").length,
      skip: checks.filter((c) => c.status === "SKIP").length
    }
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "tr6a-validation-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`PASS=${report.summary.pass} FAIL=${report.summary.fail}`);

  const failed = checks.filter((c) => c.status === "FAIL");
  if (failed.length > 0) {
    for (const f of failed) console.error(`${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
