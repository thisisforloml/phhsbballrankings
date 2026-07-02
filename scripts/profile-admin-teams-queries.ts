/**
 * Per-query breakdown for Admin Teams loader — run with:
 *   npx tsx scripts/profile-admin-teams-queries.ts
 */
import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { activeCompetitionGameWhere, loadManagedTeams, loadManagedTeamsActivityBundle, loadManagedTeamsBaseRows } from "../src/lib/admin/load-managed-teams";

async function time<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  const rows = Array.isArray(result) ? result.length : 1;
  console.log(`  ${ms.toFixed(1)}ms  ${label} (${rows} rows)`);
  return { ms, result };
}

async function profileLegacySplit() {
  console.log("\nLEGACY split (5 parallel queries)\n" + "-".repeat(40));

  const { activeCompetitionGameJoins, activeCompetitionGameSql } = await import("../src/lib/admin/active-competition-sql");

  const teams = await time("Q1 teams.findMany + _count", () =>
    prisma.team.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { homeGames: true, awayGames: true, gameStats: true } } },
      orderBy: { name: "asc" },
    }),
  );

  await time("Q2 participation SQL (CTE scan #1)", () =>
    prisma.$queryRaw`
      WITH active_games AS (
        SELECT g."homeTeamId", g."awayTeamId"
        ${activeCompetitionGameJoins}
        WHERE ${activeCompetitionGameSql}
      )
      SELECT "homeTeamId" AS "teamId", CAST('home' AS text) AS side, COUNT(*)::int AS count
      FROM active_games GROUP BY "homeTeamId"
      UNION ALL
      SELECT "awayTeamId", CAST('away' AS text), COUNT(*)::int
      FROM active_games GROUP BY "awayTeamId"
    `,
  );

  await time("Q3 stat counts SQL (full join scan #2)", () =>
    prisma.$queryRaw`
      SELECT gs."teamId" AS "teamId", COUNT(*)::int AS "statCount"
      FROM game_stats gs
      INNER JOIN games g ON g.id = gs."gameId"
      INNER JOIN seasons s ON s.id = g."seasonId"
      INNER JOIN leagues l ON l.id = s."leagueId"
      INNER JOIN teams ht ON ht.id = g."homeTeamId"
      INNER JOIN teams at ON at.id = g."awayTeamId"
      WHERE gs."deletedAt" IS NULL AND ${activeCompetitionGameSql}
      GROUP BY gs."teamId"
    `,
  );

  await time("Q4 roster SQL DISTINCT (full join scan #3)", () =>
    prisma.$queryRaw`
      SELECT DISTINCT gs."teamId", p.id AS "playerId", p."displayName"
      FROM game_stats gs
      INNER JOIN games g ON g.id = gs."gameId"
      INNER JOIN seasons s ON s.id = g."seasonId"
      INNER JOIN leagues l ON l.id = s."leagueId"
      INNER JOIN teams ht ON ht.id = g."homeTeamId"
      INNER JOIN teams at ON at.id = g."awayTeamId"
      INNER JOIN players p ON p.id = gs."playerId"
      WHERE gs."deletedAt" IS NULL AND ${activeCompetitionGameSql}
    `,
  );

  await time("Q5 context games findMany (scan #4)", () =>
    prisma.game.findMany({
      where: activeCompetitionGameWhere,
      select: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        season: {
          select: {
            id: true,
            name: true,
            leagueId: true,
            league: { select: { name: true, ageGroup: true } },
          },
        },
      },
    }),
  );

  return teams.ms;
}

async function profileMerged() {
  console.log("\nMERGED (2 parallel queries)\n" + "-".repeat(40));

  const [base, bundle] = await Promise.all([
    time("M1 teams + historical counts SQL", () => loadManagedTeamsBaseRows()),
    time("M2 single CTE activity JSON bundle", () => loadManagedTeamsActivityBundle()),
  ]);

  return Math.max(base.ms, bundle.ms);
}

async function main() {
  console.log("Admin Teams query profiler\n" + "=".repeat(60));

  const legacyWall = await profileLegacySplit();
  const mergedWall = await profileMerged();

  const full = await time("\nFULL loadManagedTeams()", () => loadManagedTeams());

  console.log("\n" + "=".repeat(60));
  console.log(`Legacy parallel wall (max of 5):  ~${legacyWall.toFixed(0)}ms+ (pool contention adds overhead)`);
  console.log(`Merged parallel wall (max of 2):   ~${mergedWall.toFixed(0)}ms`);
  console.log(`Full loader end-to-end:            ${full.ms.toFixed(0)}ms`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect().finally(() => process.exit(1));
});
