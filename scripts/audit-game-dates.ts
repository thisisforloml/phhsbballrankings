/**
 * Read-only audit of active game dates, especially StatsHub URL imports.
 * Usage: npx tsx scripts/audit-game-dates.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");

type SubmissionGame = {
  gameNumber?: string;
  gameDate?: string;
  homeTeamName?: string;
  awayTeamName?: string;
};

async function main() {
  const games = await prisma.game.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      gameNumber: true,
      gameDate: true,
      sourceName: true,
      sourceUrl: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      season: { select: { name: true, league: { select: { name: true, ageGroup: true } } } }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });

  const statshub = games.filter((game) => game.sourceName?.includes("StatsHub"));
  const dateCounts = new Map<string, number>();
  for (const game of statshub) {
    const date = game.gameDate.toISOString().slice(0, 10);
    dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }

  const suspiciousToday = statshub.filter((game) => game.gameDate.toISOString().slice(0, 10) === "2026-06-17");
  const suspiciousImportDay = statshub.filter((game) => game.gameDate.toISOString().slice(0, 10) === "2026-06-17" || game.gameDate.toISOString().slice(0, 10) >= "2026-06-01");

  const submissions = await prisma.submission.findMany({
    where: {
      deletedAt: null,
      OR: [
        { title: { contains: "Stallion", mode: "insensitive" } },
        { leagueName: { contains: "Stallion", mode: "insensitive" } },
        { rawText: { contains: "StatsHub URL import" } }
      ]
    },
    select: {
      id: true,
      title: true,
      leagueName: true,
      status: true,
      rawText: true,
      parsedPreview: true,
      createdAt: true,
      importedAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  const submissionGameDates: Array<Record<string, unknown>> = [];
  for (const submission of submissions) {
    const parsed = safeParseSubmissionJson(submission);
    if (!parsed.ok) continue;
    const root = parsed.data as { games?: SubmissionGame[] } | SubmissionGame[];
    const packages = Array.isArray(root) ? root : [root];
    for (const pkg of packages) {
      for (const game of pkg.games ?? []) {
        submissionGameDates.push({
          submissionId: submission.id,
          submissionTitle: submission.title,
          status: submission.status,
          gameNumber: game.gameNumber ?? null,
          gameDate: game.gameDate ?? null,
          homeTeamName: game.homeTeamName ?? null,
          awayTeamName: game.awayTeamName ?? null
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalActiveGames: games.length,
    statshubGames: statshub.length,
    statshubTopDates: [...dateCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 20),
    suspiciousImportDayCount: suspiciousImportDay.length,
    suspiciousTodayCount: suspiciousToday.length,
    sampleSuspiciousGames: suspiciousImportDay.slice(0, 25).map((game) => ({
      gameNumber: game.gameNumber,
      gameDate: game.gameDate.toISOString().slice(0, 10),
      league: game.season.league.name,
      season: game.season.name,
      matchup: `${game.homeTeam.name} vs ${game.awayTeam.name}`,
      sourceUrl: game.sourceUrl
    })),
    submissionCount: submissions.length,
    submissionGameDateRows: submissionGameDates.length,
    submissionGameDatesSample: submissionGameDates.slice(0, 40),
    submissionGameDateNullCount: submissionGameDates.filter((row) => !row.gameDate).length
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, "game-date-audit-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
