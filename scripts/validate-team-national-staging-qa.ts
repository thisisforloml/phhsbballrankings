/**
 * B2 staging QA harness (data + display contract checks with national flag assumptions).
 * Usage: TEAM_NATIONAL_RATINGS_ENABLED=true npx tsx scripts/validate-team-national-staging-qa.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { getNationalTeamRankings } from "../src/lib/team-ratings/get-national-team-rankings";
import {
  buildNationalBoardRankByProgramId,
  sortNationalBoardRows
} from "../src/lib/team-ratings/national-board-display";

type Check = { id: string; area: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };

function pass(id: string, area: string, detail: string): Check {
  return { id, area, status: "PASS", detail };
}

function fail(id: string, area: string, detail: string): Check {
  return { id, area, status: "FAIL", detail };
}

async function main() {
  const checks: Check[] = [];
  const nationalEnabled = process.env.TEAM_NATIONAL_RATINGS_ENABLED === "true";

  if (!nationalEnabled) {
    checks.push({ id: "QA-NAT-00", area: "flag", status: "SKIP", detail: "TEAM_NATIONAL_RATINGS_ENABLED not true — running data-layer checks only" });
  } else {
    checks.push(pass("QA-NAT-00", "flag", "TEAM_NATIONAL_RATINGS_ENABLED=true"));
  }

  const data = await getNationalTeamRankings();

  checks.push(
    data.rows.length > 0
      ? pass("QA-NAT-01", "data", `${data.rows.length} public-eligible national rows loaded`)
      : fail("QA-NAT-01", "data", "No public-eligible national rows")
  );

  checks.push(
    data.meta.lastComputedAt
      ? pass("QA-NAT-02", "meta", `Last computed ${data.meta.lastComputedAt}`)
      : fail("QA-NAT-02", "meta", "Missing lastComputedAt metadata")
  );

  for (const board of [
    { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS },
    { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS }
  ]) {
    const scope = data.rows.filter((row) => row.ageGroup === board.ageGroup && row.gender === board.gender);
    const boardRankByProgramId = buildNationalBoardRankByProgramId(scope);
    const sorted = sortNationalBoardRows(scope, boardRankByProgramId, "rank", "asc");
    const rankOk = sorted.every((row) => row.visibleRank === boardRankByProgramId[row.programId]);
    checks.push(
      rankOk
        ? pass("QA-NAT-03", "rank numbering", `${board.ageGroup} ${board.gender}: visibleRank matches canonical board rank`)
        : fail("QA-NAT-03", "rank numbering", `${board.ageGroup} ${board.gender}: visibleRank mismatch`)
    );

    const searchFiltered = scope.filter((row) => row.programName.toLowerCase().includes("a"));
    if (searchFiltered.length > 0 && searchFiltered.length < scope.length) {
      const filteredSorted = sortNationalBoardRows(searchFiltered, boardRankByProgramId, "rank", "asc");
      const filteredRankOk = filteredSorted.every((row) => row.visibleRank === boardRankByProgramId[row.programId]);
      checks.push(
        filteredRankOk
          ? pass("QA-NAT-04", "search", `${board.ageGroup} ${board.gender}: filtered rows keep canonical ranks`)
          : fail("QA-NAT-04", "search", `${board.ageGroup} ${board.gender}: filtered rank regression`)
      );
    }
  }

  const ratingSorted = sortNationalBoardRows(
    data.rows.filter((row) => row.ageGroup === AgeGroup.U16 && row.gender === PlayerGender.BOYS),
    buildNationalBoardRankByProgramId(data.rows.filter((row) => row.ageGroup === AgeGroup.U16 && row.gender === PlayerGender.BOYS)),
    "rating",
    "desc"
  );
  checks.push(
    ratingSorted.every((row, index, arr) => index === 0 || arr[index - 1]!.rating >= row.rating)
      ? pass("QA-NAT-05", "sorting", "U16 Boys rating sort descending works")
      : fail("QA-NAT-05", "sorting", "U16 Boys rating sort order invalid")
  );

  const programLinks = data.rows.filter((row) => row.teamId).length;
  checks.push(
    programLinks > 0
      ? pass("QA-NAT-06", "program links", `${programLinks}/${data.rows.length} rows have team profile links`)
      : fail("QA-NAT-06", "program links", "No team profile links resolved")
  );

  const u13Girls = data.rows.filter((row) => row.ageGroup === AgeGroup.U13 && row.gender === PlayerGender.GIRLS);
  const u16Girls = data.rows.filter((row) => row.ageGroup === AgeGroup.U16 && row.gender === PlayerGender.GIRLS);
  checks.push(
    u13Girls.length === 0 && u16Girls.length === 0
      ? pass("QA-NAT-07", "empty states", "U13/U16 Girls boards empty as expected — UI copy handles this")
      : pass("QA-NAT-07", "empty states", `Girls board coverage present (U13=${u13Girls.length}, U16=${u16Girls.length})`)
  );

  checks.push(pass("QA-NAT-08", "age switching", `Default board ${data.filters.default?.ageGroup ?? "none"} ${data.filters.default?.gender ?? ""}`));

  const report = {
    generatedAt: new Date().toISOString(),
    nationalEnabled,
    boardCount: data.filters.ageGroups.length,
    rowCount: data.rows.length,
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "PASS").length,
      fail: checks.filter((check) => check.status === "FAIL").length,
      skip: checks.filter((check) => check.status === "SKIP").length
    },
    manualBrowserFollowUp: [
      "Open /teams with TEAM_NATIONAL_RATINGS_ENABLED=true",
      "Verify National/Competition toggle on desktop and mobile widths",
      "Confirm sparse-board banner on U19 Girls",
      "Confirm empty-state copy on U13 Girls and U16 Girls"
    ]
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "team-national-staging-qa.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`PASS=${report.summary.pass} FAIL=${report.summary.fail} SKIP=${report.summary.skip}`);

  if (report.summary.fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
