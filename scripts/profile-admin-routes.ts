/**
 * TEMP: profile admin route server work — run with:
 *   npx tsx scripts/profile-admin-routes.ts
 */
import { ProgramType } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import {
  activeCompetitionGameWhere,
  loadManagedTeams,
  loadManagedTeamsActivityBundle,
  loadManagedTeamsBaseRows,
} from "../src/lib/admin/load-managed-teams";
import { loadProgramListRows } from "../src/lib/admin/load-program-list";
import { activeSubmissionWhere } from "../src/lib/submission-lifecycle";
import { loadAdminSubmissionQueue } from "../src/lib/admin/load-admin-submission-queue";
import { buildSubmissionListReview, buildSubmissionReview } from "../src/lib/submission-review";
import { resolveAdminPlayerStats } from "../src/lib/admin/resolve-admin-player-stats";
import { resolvePrimaryRankingAffiliation } from "../src/lib/player-display-affiliation";
import { getAgeBracketAsOfMarch31, getClassYear } from "../src/lib/ranking-eligibility";

const QUEUE_LIMIT = 100;

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { label, ms, result };
}

function syncTime<T>(label: string, fn: () => T): { label: string; ms: number; result: T } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { label, ms, result };
}

async function profileRequireAdminUser() {
  const user = await prisma.user.findFirst({
    where: { deletedAt: null, role: "ADMIN" },
    select: { id: true, name: true, username: true, email: true, role: true },
  });
  if (!user) return [{ label: "requireAdminUser (prisma user lookup)", ms: 0, note: "no admin user" }];
  const timed = await time("requireAdminUser (prisma user lookup)", async () => user);
  return [{ ...timed, note: "cookie decode ~0.1ms (not measured here)" }];
}

async function profilePlayers() {
  const results: Array<{ label: string; ms: number; rows?: number; note?: string }> = [];

  const { loadManagedPlayerListPage, ADMIN_PLAYER_PAGE_SIZE } = await import("@/lib/admin/load-managed-player-list");

  const pageTimed = await time("loadManagedPlayerListPage (page 1, size 50)", async () =>
    loadManagedPlayerListPage({ search: "", program: "All", gender: "All", ageBracket: "All" }, 1),
  );
  results.push({
    label: pageTimed.label,
    ms: pageTimed.ms,
    rows: pageTimed.result.players.length,
    note: `filtered=${pageTimed.result.filteredCount}, total=${pageTimed.result.totalPlayers}`,
  });

  const listTimed = await time("LEGACY players.findMany (full list select)", async () =>
    prisma.player.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        gender: true,
        schoolOverride: true,
        birthDate: true,
        ageGroupOverride: true,
        city: true,
        hometown: true,
        region: true,
        currentProgramId: true,
        position: true,
        heightCm: true,
        classYearOverride: true,
        photoUrl: true,
        commitmentStatus: true,
        committedUniversity: true,
        currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
        currentRatings: {
          orderBy: { ageGroup: "desc" },
          select: { ageGroup: true, adjustedRating: true, verifiedGameCount: true },
        },
      },
      orderBy: { displayName: "asc" },
    }),
  );
  results.push({ label: listTimed.label, ms: listTimed.ms, rows: listTimed.result.length });

  const legacyTimed = await time("LEGACY players.findMany (+ gameStats×40)", async () =>
    prisma.player.findMany({
      where: { deletedAt: null },
      include: {
        currentProgram: true,
        currentRatings: { orderBy: { ageGroup: "desc" } },
        gameStats: {
          where: { deletedAt: null },
          include: {
            team: { select: { name: true, program: { select: { fullName: true, abbreviation: true, type: true } } } },
            game: { select: { id: true, gameDate: true } },
          },
          orderBy: { game: { gameDate: "desc" } },
          take: 40,
        },
      },
      orderBy: { displayName: "asc" },
    }),
  );
  results.push({ label: legacyTimed.label, ms: legacyTimed.ms, rows: legacyTimed.result.length });

  const detailTimed = await time("players.findFirst (single detail + gameStats×40)", async () => {
    const firstId = listTimed.result[0]?.id;
    if (!firstId) return null;
    return prisma.player.findFirst({
      where: { id: firstId, deletedAt: null },
      include: {
        currentProgram: true,
        currentRatings: { orderBy: { ageGroup: "desc" } },
        gameStats: {
          where: { deletedAt: null },
          include: {
            team: { select: { name: true, program: { select: { fullName: true, abbreviation: true, type: true } } } },
            game: { select: { id: true, gameDate: true } },
          },
          orderBy: { game: { gameDate: "desc" } },
          take: 40,
        },
      },
    });
  });
  results.push({ label: detailTimed.label, ms: detailTimed.ms, rows: detailTimed.result ? 1 : 0 });

  const programsTimed = await time("programs.findMany (school list)", async () =>
    prisma.program.findMany({
      where: { deletedAt: null, type: ProgramType.SCHOOL },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  );
  results.push({ label: programsTimed.label, ms: programsTimed.ms, rows: programsTimed.result.length });

  const gameStatRows = legacyTimed.result.reduce((sum, p) => sum + p.gameStats.length, 0);
  results.push({ label: "legacy nested gameStat rows loaded", ms: 0, rows: gameStatRows });

  return results;
}

async function profileTeams() {
  const results: Array<{ label: string; ms: number; rows?: number; note?: string }> = [];

  const legacyGamesTimed = await time("LEGACY games.findMany (+ stats/players)", async () =>
    prisma.game.findMany({
      where: activeCompetitionGameWhere,
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        season: { include: { league: true } },
        stats: {
          where: { deletedAt: null },
          select: { teamId: true, player: { select: { id: true, displayName: true } } },
        },
      },
    }),
  );
  const legacyStatRows = legacyGamesTimed.result.reduce((sum, game) => sum + game.stats.length, 0);
  results.push({
    label: legacyGamesTimed.label,
    ms: legacyGamesTimed.ms,
    rows: legacyGamesTimed.result.length,
    note: `${legacyStatRows} GameStat rows hydrated`,
  });

  const optimizedTimed = await time("OPTIMIZED loadManagedTeams (2-query CTE merge)", async () => loadManagedTeams());
  results.push({
    label: optimizedTimed.label,
    ms: optimizedTimed.ms,
    rows: optimizedTimed.result.length,
    note: "full page payload",
  });

  const mergedTimed = await time("OPTIMIZED M1 teams+historical SQL", async () => loadManagedTeamsBaseRows());
  results.push({ label: mergedTimed.label, ms: mergedTimed.ms, rows: mergedTimed.result.length });

  const bundleTimed = await time("OPTIMIZED M2 single CTE JSON bundle", async () => loadManagedTeamsActivityBundle());
  const rosterRows = bundleTimed.result.roster.length;
  const contextGames = bundleTimed.result.contextGames.length;
  results.push({
    label: bundleTimed.label,
    ms: bundleTimed.ms,
    rows: rosterRows,
    note: `${contextGames} context games, ${rosterRows} roster pairs (1 active_games scan)`,
  });

  return results;
}

async function profilePrograms() {
  const results: Array<{ label: string; ms: number; rows?: number; note?: string }> = [];

  const legacyTimed = await time("LEGACY programs.findMany (deep nested active teams)", async () =>
    prisma.program.findMany({
      where: { deletedAt: null },
      include: {
        teams: {
          where: {
            deletedAt: null,
            OR: [
              { homeGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
              { awayGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
              {
                gameStats: {
                  some: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            homeGames: {
              where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
              select: { id: true, season: { include: { league: true } } },
            },
            awayGames: {
              where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
              select: { id: true, season: { include: { league: true } } },
            },
            gameStats: {
              where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
              select: { playerId: true },
            },
          },
        },
      },
      orderBy: [{ type: "asc" }, { fullName: "asc" }],
    }),
  );
  const legacyTeamRows = legacyTimed.result.reduce((sum, program) => sum + program.teams.length, 0);
  const legacyStatRows = legacyTimed.result.reduce(
    (sum, program) => sum + program.teams.reduce((teamSum, team) => teamSum + team.gameStats.length, 0),
    0,
  );
  results.push({
    label: legacyTimed.label,
    ms: legacyTimed.ms,
    rows: legacyTimed.result.length,
    note: `${legacyTeamRows} active team rows, ${legacyStatRows} nested gameStat rows`,
  });

  const optimizedTimed = await time("OPTIMIZED loadProgramListRows (flat + SQL)", async () => loadProgramListRows());
  results.push({
    label: optimizedTimed.label,
    ms: optimizedTimed.ms,
    rows: optimizedTimed.result.length,
    note: "full page payload",
  });

  return results;
}

async function profileSubmissions() {
  const results: Array<{ label: string; ms: number; rows?: number; note?: string }> = [];

  const legacyFindTimed = await time("LEGACY submissions.findMany (+ submittedBy)", async () =>
    prisma.submission.findMany({
      where: activeSubmissionWhere,
      include: { submittedBy: { select: { id: true, name: true, username: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: QUEUE_LIMIT,
    }),
  );
  results.push({ label: legacyFindTimed.label, ms: legacyFindTimed.ms, rows: legacyFindTimed.result.length });

  const legacyCountTimed = await time("LEGACY submissions.count", async () => prisma.submission.count({ where: activeSubmissionWhere }));
  results.push({ label: legacyCountTimed.label, ms: legacyCountTimed.ms, rows: legacyCountTimed.result });

  const legacyReviewTimed = syncTime("LEGACY buildSubmissionReview × N (full)", () =>
    legacyFindTimed.result.map((submission) => buildSubmissionReview(submission)),
  );
  results.push({ label: legacyReviewTimed.label, ms: legacyReviewTimed.ms, rows: legacyReviewTimed.result.length });

  const optimizedQueueTimed = await time("OPTIMIZED loadAdminSubmissionQueue (SQL window count)", async () => loadAdminSubmissionQueue(QUEUE_LIMIT));
  results.push({
    label: optimizedQueueTimed.label,
    ms: optimizedQueueTimed.ms,
    rows: optimizedQueueTimed.result.submissions.length,
    note: `totalCount=${optimizedQueueTimed.result.totalCount}`,
  });

  const optimizedReviewTimed = syncTime("OPTIMIZED buildSubmissionListReview × N", () =>
    optimizedQueueTimed.result.submissions.map((submission) => buildSubmissionListReview(submission)),
  );
  results.push({ label: optimizedReviewTimed.label, ms: optimizedReviewTimed.ms, rows: optimizedReviewTimed.result.length });

  const filterTimed = syncTime("OPTIMIZED filter/sort (CPU)", () => {
    const enriched = optimizedQueueTimed.result.submissions.map((submission) => ({
      submission,
      review: buildSubmissionListReview(submission),
    }));
    return enriched
      .filter(({ submission }) => submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW")
      .sort((a, b) => b.submission.updatedAt.getTime() - a.submission.updatedAt.getTime());
  });
  results.push({ label: filterTimed.label, ms: filterTimed.ms, rows: filterTimed.result.length, note: "duplicate review build in profile only" });

  return results;
}

async function profileSiteLayoutTrustMeta() {
  const timed = await time("getPublicTrustMeta (site layout only — not admin)", async () => {
    const [latestGame, latestSnapshot] = await Promise.all([
      prisma.game.findFirst({
        where: {
          deletedAt: null,
          verificationStatus: { in: ["SUBMITTED", "VERIFIED"] },
          season: { deletedAt: null, league: { deletedAt: null } },
        },
        orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
        select: { gameDate: true },
      }),
      prisma.rankingSnapshot.findFirst({
        orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
        select: { weekOf: true, createdAt: true },
      }),
    ]);
    return { latestGame, latestSnapshot };
  });
  return [{ label: timed.label, ms: timed.ms, note: "skipped on /admin/* after layout split" }];
}

async function main() {
  console.log("Admin route profile\n" + "=".repeat(60));

  const sections = [
    { route: "requireAdminUser", fn: profileRequireAdminUser },
    { route: "/admin/players", fn: profilePlayers },
    { route: "/admin/teams", fn: profileTeams },
    { route: "/admin/programs", fn: profilePrograms },
    { route: "/admin/submissions", fn: profileSubmissions },
    { route: "site layout trust meta (not on admin)", fn: profileSiteLayoutTrustMeta },
  ] as const;

  const summary: Array<{ route: string; label: string; ms: number; rows?: number }> = [];

  for (const section of sections) {
    console.log(`\n${section.route}`);
    console.log("-".repeat(40));
    const rows = await section.fn();
    for (const row of rows) {
      const extra = row.rows !== undefined ? ` (${row.rows} rows)` : "";
      const note = "note" in row && row.note ? ` — ${row.note}` : "";
      console.log(`  ${row.ms.toFixed(1)}ms  ${row.label}${extra}${note}`);
      summary.push({ route: section.route, label: row.label, ms: row.ms, rows: row.rows });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Ranked bottlenecks (by measured ms):\n");
  const ranked = [...summary].filter((r) => r.ms > 0).sort((a, b) => b.ms - a.ms);
  for (const [index, row] of ranked.entries()) {
    console.log(`  ${index + 1}. ${row.ms.toFixed(1)}ms  [${row.route}] ${row.label}`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect().finally(() => process.exit(1));
});
