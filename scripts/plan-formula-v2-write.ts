import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const projectRoot = "D:\\Peach Basket";
const reportsDir = path.join(projectRoot, "scripts", "reports");
const previewJsonPath = path.join(reportsDir, "formula-v2-preview.json");
const writePlanJsonPath = path.join(reportsDir, "formula-v2-write-plan.json");
const writePlanMarkdownPath = path.join(reportsDir, "formula-v2-write-plan.md");

function readPreviewSummary() {
  try {
    const parsed = JSON.parse(readFileSync(previewJsonPath, "utf8")) as {
      generatedAt?: string;
      inputs?: {
        totalOfficialActiveGames?: number;
        totalOfficialActiveGameStats?: number;
        totalPlayersWithStats?: number;
        leagueSeasonPools?: number;
      };
      warnings?: string[];
    };
    return {
      path: previewJsonPath,
      generatedAt: parsed.generatedAt ?? null,
      inputs: parsed.inputs ?? null,
      warnings: parsed.warnings ?? []
    };
  } catch {
    return {
      path: previewJsonPath,
      generatedAt: null,
      inputs: null,
      warnings: ["Formula v2 preview JSON was not found or could not be parsed. Run npm.cmd run ratings:v2:preview first."]
    };
  }
}

function markdownTable(rows: Array<Record<string, string | number | boolean | null>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "-").replace(/\|/g, "\\|")).join(" | ")} |`)
  ].join("\n");
}

function buildMarkdown(report: {
  generatedAt: string;
  executeRequested: boolean;
  executeReady: boolean;
  preview: ReturnType<typeof readPreviewSummary>;
  currentCounts: Record<string, number | null>;
  storageAssessment: Array<Record<string, string | boolean>>;
  guardedWriteStrategy: string[];
  blockers: string[];
  packageScripts: Record<string, string | null>;
}) {
  return [
    "# Formula v2 Write/Recompute Plan",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Result",
    "",
    `- Execute requested: ${report.executeRequested ? "yes" : "no"}.`,
    `- Execute ready: ${report.executeReady ? "yes" : "no"}.`,
    "- No database writes were performed.",
    "- No ranking snapshots were generated.",
    "",
    "## Preview Baseline",
    "",
    "```json",
    JSON.stringify(report.preview, null, 2),
    "```",
    "",
    "## Current Counts",
    "",
    "```json",
    JSON.stringify(report.currentCounts, null, 2),
    "```",
    "",
    "## Storage Assessment",
    "",
    markdownTable(report.storageAssessment),
    "",
    "## Blockers",
    "",
    report.blockers.map((blocker) => `- ${blocker}`).join("\n"),
    "",
    "## Guarded Write Strategy",
    "",
    report.guardedWriteStrategy.map((step) => `- ${step}`).join("\n"),
    "",
    "## Package Scripts",
    "",
    "```json",
    JSON.stringify(report.packageScripts, null, 2),
    "```",
    ""
  ].join("\n");
}

async function main() {
  const executeRequested = process.argv.includes("--execute");
  mkdirSync(reportsDir, { recursive: true });

  const [
    officialActiveGames,
    officialActiveGameStats,
    totalGamePerformanceScores,
    formulaV1GamePerformanceScores,
    formulaV2TaggedGamePerformanceScores,
    totalPlayerRatings,
    totalRankingSnapshots,
    totalRankingSnapshotRows,
    formulaVersionV1,
    formulaVersionV2
  ] = await Promise.all([
    prisma.game.count({
      where: {
        deletedAt: null,
        verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
        stats: { some: { deletedAt: null, player: { deletedAt: null } } }
      }
    }),
    prisma.gameStat.count({
      where: {
        deletedAt: null,
        player: { deletedAt: null },
        game: {
          deletedAt: null,
          verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
          season: { deletedAt: null, league: { deletedAt: null } }
        }
      }
    }),
    prisma.gamePerformanceScore.count(),
    prisma.gamePerformanceScore.count({ where: { formulaVersionTag: 1 } }),
    prisma.gamePerformanceScore.count({ where: { formulaVersionTag: 2 } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.formulaVersion.findUnique({ where: { versionNumber: 1 }, select: { id: true, isPublic: true } }),
    prisma.formulaVersion.findUnique({ where: { versionNumber: 2 }, select: { id: true, isPublic: true } })
  ]);

  const preview = readPreviewSummary();
  const blockers = [
    "`GamePerformanceScore.gameStatId` is globally unique, so v2 rows cannot be inserted alongside v1 rows for the same GameStat without replacing/updating existing rows.",
    "`PlayerRating` is globally unique on `[playerId, ageGroup]` and has no formula version field, so v2 PlayerRatings cannot coexist with production v1 PlayerRatings.",
    "Public ranking snapshots currently point to one FormulaVersion, but the live PlayerRating table is not versioned; switching public output requires a separate approved cutover plan.",
    "A side-by-side v2 write requires an approved storage change, such as versioned GamePerformanceScore uniqueness and versioned PlayerRating storage, or dedicated shadow/preview tables."
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    executeRequested,
    executeReady: false,
    preview,
    currentCounts: {
      officialActiveGamesWithStats: officialActiveGames,
      officialActiveGameStats,
      totalGamePerformanceScores,
      formulaV1GamePerformanceScores,
      formulaV2TaggedGamePerformanceScores,
      totalPlayerRatings,
      totalRankingSnapshots,
      totalRankingSnapshotRows,
      formulaVersionV1Exists: formulaVersionV1 ? 1 : 0,
      formulaVersionV1IsPublic: formulaVersionV1 ? Number(formulaVersionV1.isPublic) : null,
      formulaVersionV2Exists: formulaVersionV2 ? 1 : 0,
      formulaVersionV2IsPublic: formulaVersionV2 ? Number(formulaVersionV2.isPublic) : null
    },
    storageAssessment: [
      {
        table: "GamePerformanceScore",
        desired: "Store v2 rows beside v1 rows with formulaVersionTag = 2.",
        currentConstraint: "gameStatId @unique",
        safeSideBySide: false,
        implication: "A v2 insert for an already-scored GameStat would collide with the existing v1 row."
      },
      {
        table: "PlayerRating",
        desired: "Store v2 ratings beside v1 ratings.",
        currentConstraint: "@@unique([playerId, ageGroup]) and no formulaVersionId/formulaVersionTag.",
        safeSideBySide: false,
        implication: "A v2 upsert would overwrite the live production rating path."
      },
      {
        table: "RankingSnapshot",
        desired: "Do not generate snapshots in this step.",
        currentConstraint: "Versioned by formulaVersionId.",
        safeSideBySide: true,
        implication: "Snapshots can be versioned later, but should wait until score/rating storage is safe."
      }
    ],
    guardedWriteStrategy: [
      "Keep `npm.cmd run ratings:v2:preview` as the current read-only comparison path.",
      "Use `npm.cmd run ratings:v2:dry-run` to re-check write readiness and current table constraints before any implementation attempt.",
      "Do not add or run `ratings:v2:execute` under the current schema because side-by-side v2 storage is not safe.",
      "Before execution, approve a storage design: either version `GamePerformanceScore` uniqueness by `[gameStatId, formulaVersionId]` and add versioned PlayerRating storage, or create dedicated Formula v2 shadow tables.",
      "After storage is version-safe, implement a new execute script that validates preview counts, writes only v2 records, leaves formulaVersionTag = 1 rows untouched, and still does not generate snapshots.",
      "Only after v2 score/rating validation should a separate approved step generate v2 RankingSnapshots and switch public leaderboard output."
    ],
    blockers,
    packageScripts: {
      "ratings:v2:preview": "tsx scripts/preview-formula-v2.ts",
      "ratings:v2:dry-run": "tsx scripts/plan-formula-v2-write.ts",
      "ratings:v2:execute": null
    },
    guardrails: {
      databaseWrites: false,
      snapshotsGenerated: false,
      importsOrPublishes: false,
      v1RowsModified: false,
      publicLeaderboardChanged: false
    }
  };

  writeFileSync(writePlanJsonPath, JSON.stringify(report, null, 2));
  writeFileSync(writePlanMarkdownPath, buildMarkdown(report));

  console.log(JSON.stringify({
    reportPaths: {
      json: writePlanJsonPath,
      markdown: writePlanMarkdownPath
    },
    executeRequested,
    executeReady: false,
    currentCounts: report.currentCounts,
    blockers,
    packageScripts: report.packageScripts,
    guardrails: report.guardrails
  }, null, 2));

  if (executeRequested) {
    throw new Error("Formula v2 execute is intentionally blocked under the current schema. See scripts/reports/formula-v2-write-plan.md.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
