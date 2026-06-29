/**
 * TR-6B validation export: V-TR-21 through V-TR-30
 * Usage: npx tsx scripts/validate-team-ratings-tr6b.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTeamRatingsBoardValidation } from "../src/lib/team-ratings/validate-team-ratings-board";
import { prisma } from "../src/lib/prisma";

function toMarkdown(report: Awaited<ReturnType<typeof runTeamRatingsBoardValidation>>) {
  const lines = [
    "# TR-6B Team Ratings Validation Report",
    "",
    `**Generated:** ${report.generatedAt}`,
    `**Persisted rows:** ${report.totalPersistedRows}`,
    "",
    "## Summary",
    "",
    `| Result | Count |`,
    `| --- | ---: |`,
    `| PASS | ${report.summary.pass} |`,
    `| FAIL | ${report.summary.fail} |`,
    `| SKIP | ${report.summary.skip} |`,
    "",
    "## Board Index",
    "",
    "| Board | Programs |",
    "| --- | ---: |",
    ...report.boardIndex.map((board) => `| ${board.key} | ${board.count} |`),
    "",
    "## Validation Checks",
    "",
    "| ID | Status | Detail |",
    "| --- | --- | --- |",
    ...report.checks.map((check) => `| ${check.id} | ${check.status} | ${check.detail} |`),
    "",
    "## Global Integrity",
    "",
    `- Duplicate keys: ${report.global.duplicateKeyCount}`,
    `- Orphan ratings: ${report.global.orphanRatingCount}`,
    `- Deleted-program refs: ${report.global.deletedProgramReferenceCount}`,
    `- Evidence policy violations: ${report.global.evidencePolicyViolationCount}`,
    "",
    "## Rollback",
    "",
    "Admin preview is read-only. Remove `/admin/team-ratings` route to roll back TR-6B UI without data impact.",
    ""
  ];
  return lines.join("\n");
}

async function main() {
  const report = await runTeamRatingsBoardValidation();
  const outDir = join(process.cwd(), "scripts", "reports");
  const docsDir = join(process.cwd(), "docs", "planning", "audits");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  const jsonPath = join(outDir, "team-ratings-validation.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdPath = join(docsDir, "TEAM_TR6B_VALIDATION_REPORT.md");
  writeFileSync(mdPath, toMarkdown(report));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`PASS=${report.summary.pass} FAIL=${report.summary.fail} SKIP=${report.summary.skip}`);

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
