/**
 * One-time repair of StatsHub-imported Game.gameDate values from Genius schedule data.
 *
 * Usage:
 *   npx tsx scripts/repair-game-dates-from-schedule.ts           # dry-run report
 *   npx tsx scripts/repair-game-dates-from-schedule.ts --execute   # backup + update Game.gameDate only
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  fetchCompetitionScheduleDates,
  parseStatsHubGameNumber
} from "../src/lib/stats-import/adapters/statshub-v1/schedule-dates";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");
const IMPORT_DAY = "2026-06-17";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

type RepairCandidate = {
  gameId: string;
  gameNumber: string;
  competitionId: string;
  matchId: string;
  currentDate: string;
  proposedDate: string;
  league: string;
  season: string;
  matchup: string;
};

async function main() {
  const execute = process.argv.includes("--execute");
  mkdirSync(REPORT_DIR, { recursive: true });

  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      sourceName: { contains: "StatsHub" }
    },
    select: {
      id: true,
      gameNumber: true,
      gameDate: true,
      sourceName: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { select: { name: true, league: { select: { name: true } } } }
    },
    orderBy: [{ gameNumber: "asc" }]
  });

  const competitionIds = new Set<string>();
  const parsedByGameId = new Map<string, { competitionId: string; matchId: string }>();

  for (const game of games) {
    const parsed = parseStatsHubGameNumber(game.gameNumber);
    if (!parsed) continue;
    competitionIds.add(parsed.competitionId);
    parsedByGameId.set(game.id, parsed);
  }

  const scheduleDatesByCompetition = new Map<string, Map<string, string>>();
  const scheduleLoadReport: Array<Record<string, unknown>> = [];

  for (const competitionId of [...competitionIds].sort()) {
    const loaded = await fetchCompetitionScheduleDates(competitionId);
    scheduleDatesByCompetition.set(competitionId, loaded.datesByMatchId);
    scheduleLoadReport.push({
      competitionId,
      pathsLoaded: loaded.pathsLoaded,
      matchCount: loaded.datesByMatchId.size
    });
  }

  const candidates: RepairCandidate[] = [];
  const alreadyCorrect: RepairCandidate[] = [];
  const unresolved: Array<Record<string, unknown>> = [];

  for (const game of games) {
    const parsed = parsedByGameId.get(game.id);
    if (!parsed) {
      unresolved.push({
        gameId: game.id,
        gameNumber: game.gameNumber,
        reason: "unparseable_game_number"
      });
      continue;
    }

    const scheduleDates = scheduleDatesByCompetition.get(parsed.competitionId);
    const proposedDate = scheduleDates?.get(parsed.matchId);
    const currentDate = isoDate(game.gameDate);
    const row: RepairCandidate = {
      gameId: game.id,
      gameNumber: game.gameNumber ?? "",
      competitionId: parsed.competitionId,
      matchId: parsed.matchId,
      currentDate,
      proposedDate: proposedDate ?? "",
      league: game.season.league.name,
      season: game.season.name,
      matchup: `${game.homeTeam.name} vs ${game.awayTeam.name}`
    };

    if (!proposedDate) {
      unresolved.push({
        ...row,
        reason: "schedule_date_not_found"
      });
      continue;
    }

    if (currentDate === proposedDate) {
      alreadyCorrect.push(row);
      continue;
    }

    candidates.push(row);
  }

  const importDayCandidates = candidates.filter((row) => row.currentDate === IMPORT_DAY);
  const backupPath = join(REPORT_DIR, `game-date-repair-backup-${timestampForFilename()}.json`);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: execute ? "execute" : "dry-run",
    importDayFilter: IMPORT_DAY,
    statshubGamesScanned: games.length,
    competitionIds: [...competitionIds].sort(),
    scheduleLoadReport,
    toUpdateCount: candidates.length,
    importDayWrongCount: importDayCandidates.length,
    alreadyCorrectCount: alreadyCorrect.length,
    unresolvedCount: unresolved.length,
    sampleUpdates: candidates.slice(0, 25),
    unresolvedSample: unresolved.slice(0, 25)
  };

  const reportPath = join(REPORT_DIR, "game-date-repair-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          reportPath,
          mode: "dry-run",
          toUpdateCount: candidates.length,
          importDayWrongCount: importDayCandidates.length,
          alreadyCorrectCount: alreadyCorrect.length,
          unresolvedCount: unresolved.length,
          hint: "Re-run with --execute to apply Game.gameDate updates after reviewing the report."
        },
        null,
        2
      )
    );
    return;
  }

  if (!candidates.length) {
    console.log(JSON.stringify({ reportPath, message: "No game dates to update." }, null, 2));
    return;
  }

  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        games: candidates.map((row) => ({
          id: row.gameId,
          gameNumber: row.gameNumber,
          gameDate: row.currentDate
        }))
      },
      null,
      2
    ),
    "utf8"
  );

  let updated = 0;
  for (const row of candidates) {
    await prisma.game.update({
      where: { id: row.gameId },
      data: { gameDate: new Date(`${row.proposedDate}T00:00:00.000Z`) }
    });
    updated += 1;
  }

  const validation = {
    generatedAt: new Date().toISOString(),
    updated,
    backupPath,
    remainingImportDayStatshubGames: await prisma.game.count({
      where: {
        deletedAt: null,
        sourceName: { contains: "StatsHub" },
        gameDate: new Date(`${IMPORT_DAY}T00:00:00.000Z`)
      }
    })
  };

  const validationPath = join(REPORT_DIR, "game-date-repair-validation-report.json");
  writeFileSync(validationPath, JSON.stringify(validation, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        reportPath,
        backupPath,
        validationPath,
        updated,
        remainingImportDayStatshubGames: validation.remainingImportDayStatshubGames
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
