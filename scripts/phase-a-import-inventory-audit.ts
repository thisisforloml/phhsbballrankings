/**
 * Validation Phase A — read-only import inventory audit.
 * Usage: npx tsx scripts/phase-a-import-inventory-audit.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function countPlayerRowsInSubmission(input: { rawText: string | null; parsedPreview: unknown }) {
  if (!input.rawText?.trim() && !input.parsedPreview) {
    return { games: 0, playerRows: 0, gameNumbers: [] as string[] };
  }
  const parsed = safeParseSubmissionJson(input);
  if (!parsed.ok) return { games: 0, playerRows: 0, gameNumbers: [] as string[], parseError: parsed.errorMessage };

  const root = parsed.data;
  const packages = Array.isArray(root) ? root : [root];
  let games = 0;
  let playerRows = 0;
  const gameNumbers: string[] = [];

  for (const pkg of packages) {
    const record = asRecord(pkg);
    if (!record) continue;
    for (const game of asArray(record.games)) {
      const gameRecord = asRecord(game);
      if (!gameRecord) continue;
      games += 1;
      const gameNumber = stringValue(gameRecord.gameNumber);
      if (gameNumber) gameNumbers.push(gameNumber);
      playerRows += asArray(gameRecord.players).length;
    }
  }

  return { games, playerRows, gameNumbers };
}

function inferImportPath(input: {
  type: string;
  validationSummary: unknown;
  adminNotes: string | null;
  originalFilename: string | null;
}) {
  const summary = asRecord(input.validationSummary);
  const format = stringValue(summary?.format);
  const notes = input.adminNotes ?? "";

  if (format === "statshub-url-import" || notes.includes("StatsHub URL import")) {
    return "url_import_statshub";
  }
  if (input.type === "UPLOAD_XLSX") return "spreadsheet_xlsx";
  if (input.type === "UPLOAD_CSV") return "spreadsheet_csv";
  if (input.type === "UPLOAD_JSON") return "upload_json";
  if (input.type === "PASTE_JSON") return "paste_json";
  return input.type.toLowerCase();
}

function inferSeasonName(input: { rawText: string | null; parsedPreview: unknown }) {
  const parsed = safeParseSubmissionJson(input);
  if (parsed.ok) {
      const root = parsed.data;
      const packages = Array.isArray(root) ? root : [root];
      for (const pkg of packages) {
        const record = asRecord(pkg);
        const season = asRecord(record?.season);
        const name = stringValue(season?.name);
        if (name) return name;
      }
    }

  const preview = asRecord(input.parsedPreview);
  const sample = asRecord(preview?.sample);
  const season = asRecord(sample?.season);
  return stringValue(season?.name) || null;
}

async function main() {
  const [
    playerActive,
    playerTotal,
    gameActive,
    gameTotal,
    gameStatActive,
    gameStatTotal,
    gpsActive,
    gpsTotal,
    playerRatingCount,
    rankingSnapshotCount,
    rankingSnapshotRowCount,
    submissionActive,
    submissionImported,
    submissionByStatus
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.player.count(),
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.game.count(),
    prisma.gameStat.count({ where: { deletedAt: null } }),
    prisma.gameStat.count(),
    prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    prisma.gamePerformanceScore.count(),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.submission.count({ where: { deletedAt: null } }),
    prisma.submission.count({ where: { deletedAt: null, status: SubmissionStatus.IMPORTED } }),
    prisma.submission.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } })
  ]);

  const importedSubmissions = await prisma.submission.findMany({
    where: { deletedAt: null, status: SubmissionStatus.IMPORTED },
    select: {
      id: true,
      title: true,
      leagueName: true,
      status: true,
      type: true,
      rawText: true,
      parsedPreview: true,
      validationSummary: true,
      adminNotes: true,
      originalFilename: true,
      createdAt: true,
      importedAt: true
    },
    orderBy: { importedAt: "desc" }
  });

  const submissionInventory = importedSubmissions.map((submission) => {
    const counts = countPlayerRowsInSubmission({
      rawText: submission.rawText,
      parsedPreview: submission.parsedPreview
    });
    return {
      id: submission.id,
      title: submission.title,
      league: submission.leagueName,
      season: inferSeasonName({
        rawText: submission.rawText,
        parsedPreview: submission.parsedPreview
      }),
      status: submission.status,
      importPath: inferImportPath({
        type: submission.type,
        validationSummary: submission.validationSummary,
        adminNotes: submission.adminNotes,
        originalFilename: submission.originalFilename
      }),
      submissionType: submission.type,
      createdAt: submission.createdAt.toISOString(),
      importedAt: submission.importedAt?.toISOString() ?? null,
      submissionGames: counts.games,
      submissionPlayerRows: counts.playerRows,
      parseError: "parseError" in counts ? counts.parseError : undefined
    };
  });

  const submissionGamesTotal = submissionInventory.reduce((sum, row) => sum + row.submissionGames, 0);
  const submissionPlayerRowsTotal = submissionInventory.reduce((sum, row) => sum + row.submissionPlayerRows, 0);

  const importedGameIds = new Set<string>();
  const reconciliationDetails: Array<{
    submissionId: string;
    title: string;
    dbGames: number;
    dbGameStats: number;
    dbDistinctPlayers: number;
    missingGameNumbers: string[];
    error?: string;
  }> = [];

  for (const submission of importedSubmissions) {
    const counts = countPlayerRowsInSubmission({
      rawText: submission.rawText,
      parsedPreview: submission.parsedPreview
    });
    if (counts.games === 0) {
      reconciliationDetails.push({
        submissionId: submission.id,
        title: submission.title,
        dbGames: 0,
        dbGameStats: 0,
        dbDistinctPlayers: 0,
        missingGameNumbers: [],
        error: counts.games === 0 ? "No parseable games in submission JSON" : "Missing submission payload"
      });
      continue;
    }

    try {
      const parsed = safeParseSubmissionJson({
        rawText: submission.rawText,
        parsedPreview: submission.parsedPreview
      });
      if (!parsed.ok) throw new Error(parsed.error);
      const root = parsed.data;
      const packages = Array.isArray(root) ? root : [root];
      const primary = asRecord(packages[0]);
      const league = asRecord(primary?.league);
      const season = asRecord(primary?.season);
      const leagueName = stringValue(league?.name) || submission.leagueName || submission.title;
      const ageGroup = stringValue(league?.ageGroup);
      const seasonName = stringValue(season?.name);
      const gameNumbers = counts.gameNumbers;

      if (!ageGroup || !seasonName) {
        throw new Error(`Missing league ageGroup or season name (${leagueName} / ${seasonName || "?"})`);
      }

      const leagueRow = await prisma.league.findFirst({
        where: { name: leagueName, ageGroup: ageGroup as never, deletedAt: null },
        select: { id: true }
      });
      if (!leagueRow) throw new Error(`League not found: ${leagueName} ${ageGroup}`);

      const seasonRow = await prisma.season.findUnique({
        where: { leagueId_name: { leagueId: leagueRow.id, name: seasonName } },
        select: { id: true, deletedAt: true }
      });
      if (!seasonRow || seasonRow.deletedAt) throw new Error(`Season not found: ${seasonName}`);

      const games = await prisma.game.findMany({
        where: { seasonId: seasonRow.id, gameNumber: { in: gameNumbers }, deletedAt: null },
        select: { id: true, gameNumber: true }
      });

      const foundNumbers = new Set(games.map((game) => game.gameNumber).filter(Boolean));
      const missingGameNumbers = gameNumbers.filter((gameNumber) => !foundNumbers.has(gameNumber));
      const gameIds = games.map((game) => game.id);
      gameIds.forEach((id) => importedGameIds.add(id));

      const [dbGameStats, distinctPlayers] = await Promise.all([
        prisma.gameStat.count({ where: { deletedAt: null, gameId: { in: gameIds } } }),
        prisma.gameStat.findMany({
          where: { deletedAt: null, gameId: { in: gameIds } },
          distinct: ["playerId"],
          select: { playerId: true }
        })
      ]);

      reconciliationDetails.push({
        submissionId: submission.id,
        title: submission.title,
        dbGames: games.length,
        dbGameStats,
        dbDistinctPlayers: distinctPlayers.length,
        missingGameNumbers
      });
    } catch (error) {
      reconciliationDetails.push({
        submissionId: submission.id,
        title: submission.title,
        dbGames: 0,
        dbGameStats: 0,
        dbDistinctPlayers: 0,
        missingGameNumbers: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const importedScopeGameIds = Array.from(importedGameIds);
  const [importedScopeGames, importedScopeGameStats, importedScopeDistinctPlayers, importedScopeGps] = await Promise.all([
    importedScopeGameIds.length,
    prisma.gameStat.count({ where: { deletedAt: null, gameId: { in: importedScopeGameIds } } }),
    prisma.gameStat.findMany({
      where: { deletedAt: null, gameId: { in: importedScopeGameIds } },
      distinct: ["playerId"],
      select: { playerId: true }
    }),
    prisma.gamePerformanceScore.count({
      where: { deletedAt: null, gameId: { in: importedScopeGameIds } }
    })
  ]);

  const dbGamesInImportedScope = importedScopeGameIds.length;
  const dbDistinctPlayersInScope = importedScopeDistinctPlayers.length;

  const gpsWithoutStat = await prisma.gamePerformanceScore.count({
    where: {
      deletedAt: null,
      gameStat: { deletedAt: { not: null } }
    }
  });

  const statsWithoutGps = await prisma.gameStat.count({
    where: {
      deletedAt: null,
      gameId: { in: importedScopeGameIds },
      performanceScore: null
    }
  });

  const anomalies: string[] = [];
  const blockers: string[] = [];

  if (submissionPlayerRowsTotal === 0 && submissionImported > 0) {
    blockers.push("IMPORTED submissions exist but submission JSON player row total is 0 — rawText parse failure or empty payloads.");
  }

  for (const detail of reconciliationDetails) {
    if (detail.error) {
      anomalies.push(`Submission ${detail.title} (${detail.submissionId}): reconciliation error — ${detail.error}`);
    }
    if (detail.missingGameNumbers.length) {
      blockers.push(
        `Submission ${detail.title}: ${detail.missingGameNumbers.length} game number(s) in JSON not found in DB (${detail.missingGameNumbers.slice(0, 5).join(", ")}${detail.missingGameNumbers.length > 5 ? "…" : ""}).`
      );
    }
  }

  if (submissionGamesTotal > dbGamesInImportedScope) {
    anomalies.push(
      `Submission JSON game rows (${submissionGamesTotal}) exceed reconciled DB games in import scope (${dbGamesInImportedScope}) — check duplicate gameNumbers across submissions or league name mismatches.`
    );
  }

  if (submissionPlayerRowsTotal > importedScopeGameStats * 1.05) {
    anomalies.push(
      `Submission JSON player rows (${submissionPlayerRowsTotal}) materially exceed active GameStats in import scope (${importedScopeGameStats}) — forfeit games, parse duplicates, or unreconciled submissions may explain gap.`
    );
  }

  if (statsWithoutGps > 0) {
    blockers.push(`${statsWithoutGps} active GameStat rows in import scope lack GamePerformanceScore.`);
  }

  if (gpsWithoutStat > 0) {
    anomalies.push(`${gpsWithoutStat} active GamePerformanceScore rows reference soft-deleted GameStats.`);
  }

  if (gameStatActive !== gpsActive) {
    anomalies.push(`Global active GameStat count (${gameStatActive}) != active GPS count (${gpsActive}) — difference ${gameStatActive - gpsActive}.`);
  }

  const importPathCounts = submissionInventory.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.importPath] = (accumulator[row.importPath] ?? 0) + 1;
    return accumulator;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "A-inventory",
    mode: "read-only",
    liveCounts: {
      player: { active: playerActive, total: playerTotal },
      game: { active: gameActive, total: gameTotal },
      gameStat: { active: gameStatActive, total: gameStatTotal },
      gamePerformanceScore: { active: gpsActive, total: gpsTotal },
      playerRating: { total: playerRatingCount },
      rankingSnapshot: { total: rankingSnapshotCount, rows: rankingSnapshotRowCount },
      submission: { active: submissionActive, imported: submissionImported, byStatus: submissionByStatus }
    },
    importedSubmissionInventory: submissionInventory,
    importPathCounts,
    reconciliation: {
      operatorCampaign: {
        importedSubmissions: submissionImported,
        submissionJsonGames: submissionGamesTotal,
        submissionJsonPlayerRows: submissionPlayerRowsTotal,
        note: "Operator-reported ~3,000+ player rows — compare to submissionJsonPlayerRows and dbDistinctPlayersInImportScope"
      },
      databaseImportScope: {
        distinctGames: dbGamesInImportedScope,
        activeGameStats: importedScopeGameStats,
        distinctPlayersWithStats: dbDistinctPlayersInScope,
        activeGamePerformanceScores: importedScopeGps,
        gpsGapInScope: statsWithoutGps
      },
      perSubmission: reconciliationDetails,
      deltas: {
        submissionPlayerRowsVsDbStats: submissionPlayerRowsTotal - importedScopeGameStats,
        submissionPlayerRowsVsDistinctPlayers: submissionPlayerRowsTotal - dbDistinctPlayersInScope,
        submissionGamesVsDbGames: submissionGamesTotal - dbGamesInImportedScope
      }
    },
    anomalies,
    blockers,
    recommendation: blockers.length ? "STOP" : anomalies.length ? "PROCEED_WITH_CAUTION" : "PROCEED"
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "phase-a-inventory-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
