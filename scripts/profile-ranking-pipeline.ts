/**
 * Read-only ranking pipeline profiler — timings, query counts, row volumes.
 * Usage: npx tsx scripts/profile-ranking-pipeline.ts
 */
import { performance } from "node:perf_hooks";
import { AgeGroup, PlayerGender, PrismaClient, RankingScope } from "@prisma/client";
import { getActivePlayerFormulaConfig } from "../src/lib/ratings/active-formula";
import { resolvePolicyVersionId } from "../src/lib/ratings/player-rating-query";

type QueryLog = { model: string; operation: string; durationMs: number; rows?: number };

const queryLog: QueryLog[] = [];
const base = new PrismaClient();

const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();
        const result = await query(args);
        let rows: number | undefined;
        if (Array.isArray(result)) rows = result.length;
        else if (typeof result === "number") rows = result;
        queryLog.push({ model, operation, durationMs: performance.now() - start, rows });
        return result;
      },
    },
  },
});

function summarize(slice: QueryLog[]) {
  const map = new Map<string, { count: number; ms: number; rows: number }>();
  for (const q of slice) {
    const key = `${q.model}.${q.operation}`;
    const prev = map.get(key) ?? { count: 0, ms: 0, rows: 0 };
    prev.count += 1;
    prev.ms += q.durationMs;
    prev.rows += q.rows ?? 0;
    map.set(key, prev);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, count: v.count, ms: Math.round(v.ms), rows: v.rows }))
    .sort((a, b) => b.ms - a.ms);
}

function resetLog() {
  queryLog.length = 0;
}

const playerSelect = {
  id: true,
  displayName: true,
  city: true,
  region: true,
  position: true,
  heightCm: true,
  birthDate: true,
  firstRankingEligibilityAt: true,
  classYearOverride: true,
  photoUrl: true,
  gender: true,
  schoolOverride: true,
  ageGroupOverride: true,
  currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
} as const;

const homePreviewPlayerSelect = {
  ...playerSelect,
  gameStats: {
    where: { deletedAt: null },
    select: {
      team: {
        select: {
          name: true,
          program: { select: { fullName: true, abbreviation: true, type: true } },
        },
      },
      game: { select: { gameDate: true } },
    },
    orderBy: { game: { gameDate: "desc" } },
    take: 40,
  },
} as const;

async function resolveActivePlayerRatingFilter() {
  const config = getActivePlayerFormulaConfig();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: config.formulaVersionNumber },
    select: { id: true },
  });
  return {
    formulaVersionId: formulaVersion?.id ?? null,
    policyVersionId: resolvePolicyVersionId(config.policyVersionId),
  };
}

function boardWhere(
  gender: PlayerGender,
  ageGroup: AgeGroup,
  formulaVersionId: string,
  policyVersionId: string
) {
  return {
    ageGroup,
    formulaVersionId,
    policyVersionId,
    player: { gender, deletedAt: null },
  };
}

async function getLatestSnapshotInstrumented(
  gender: PlayerGender,
  ageGroup: AgeGroup,
  formulaVersionId: string,
  policyVersionId: string
) {
  const sliceStart = queryLog.length;
  const t0 = performance.now();

  const latestSnapshot = await prisma.rankingSnapshot.findFirst({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup,
      gender,
      formulaVersionId,
      city: null,
      region: null,
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
  });

  const ratings = await prisma.playerRating.findMany({
    where: boardWhere(gender, ageGroup, formulaVersionId, policyVersionId),
    include: { player: { select: playerSelect } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
  });

  const playerIds = ratings.map((r) => r.playerId);
  const stats = playerIds.length
    ? await prisma.gameStat.findMany({
        where: {
          playerId: { in: playerIds },
          deletedAt: null,
          game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
        },
        select: {
          playerId: true,
          game: {
            select: {
              gameDate: true,
              season: { select: { name: true, league: { select: { id: true, name: true, tier: true } } } },
            },
          },
          team: {
            select: {
              name: true,
              program: { select: { fullName: true, abbreviation: true, type: true } },
            },
          },
        },
      })
    : [];

  return {
    label: `getLatestSnapshot ${ageGroup}/${gender}`,
    elapsedMs: Math.round(performance.now() - t0),
    ratingRows: ratings.length,
    embeddedGameStats: 0,
    participationGameStatRows: stats.length,
    snapshotFound: !!latestSnapshot,
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function getHomePreviewInstrumented(formulaVersionId: string, policyVersionId: string) {
  const sliceStart = queryLog.length;
  const t0 = performance.now();
  const ageGroup = AgeGroup.U19;

  const [boysCount, girlsCount, boysSnap, girlsSnap, boysRatings, girlsRatings] = await Promise.all([
    prisma.playerRating.count({ where: boardWhere(PlayerGender.BOYS, ageGroup, formulaVersionId, policyVersionId) }),
    prisma.playerRating.count({ where: boardWhere(PlayerGender.GIRLS, ageGroup, formulaVersionId, policyVersionId) }),
    prisma.rankingSnapshot.findFirst({
      where: { scope: RankingScope.NATIONAL, ageGroup, gender: PlayerGender.BOYS, formulaVersionId, city: null, region: null },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    }),
    prisma.rankingSnapshot.findFirst({
      where: { scope: RankingScope.NATIONAL, ageGroup, gender: PlayerGender.GIRLS, formulaVersionId, city: null, region: null },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    }),
    prisma.playerRating.findMany({
      where: boardWhere(PlayerGender.BOYS, ageGroup, formulaVersionId, policyVersionId),
      include: { player: { select: homePreviewPlayerSelect } },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
      take: 10,
    }),
    prisma.playerRating.findMany({
      where: boardWhere(PlayerGender.GIRLS, ageGroup, formulaVersionId, policyVersionId),
      include: { player: { select: homePreviewPlayerSelect } },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
      take: 10,
    }),
  ]);

  const embeddedGameStats =
    boysRatings.reduce((s, r) => s + r.player.gameStats.length, 0) +
    girlsRatings.reduce((s, r) => s + r.player.gameStats.length, 0);

  return {
    label: "getHomeNationalBoardPreview",
    elapsedMs: Math.round(performance.now() - t0),
    boysCount,
    girlsCount,
    previewRows: boysRatings.length + girlsRatings.length,
    embeddedGameStats,
    snapshotsFound: Number(!!boysSnap) + Number(!!girlsSnap),
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function buildLatestNationalRankingsInstrumented(formulaVersionId: string, policyVersionId: string) {
  const sliceStart = queryLog.length;
  const t0 = performance.now();
  const results = [];

  for (const ageGroup of [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      results.push(await getLatestSnapshotInstrumented(gender, ageGroup, formulaVersionId, policyVersionId));
    }
  }

  return {
    label: "getLatestNationalRankings",
    elapsedMs: Math.round(performance.now() - t0),
    snapshots: results,
    totalRatingRows: results.reduce((s, r) => s + r.ratingRows, 0),
    totalEmbeddedGameStats: results.reduce((s, r) => s + r.embeddedGameStats, 0),
    totalParticipationRows: results.reduce((s, r) => s + r.participationGameStatRows, 0),
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function getHomeDataExtras() {
  const sliceStart = queryLog.length;
  const t0 = performance.now();

  const [officialCounts, boardMovers, recentGames] = await Promise.all([
    prisma.game.findMany({
      where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
      select: { homeTeamId: true, awayTeamId: true, season: { select: { leagueId: true } } },
    }),
    prisma.rankingSnapshot.findMany({
      where: { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS, scope: RankingScope.NATIONAL },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 2,
      select: { id: true },
    }),
    prisma.game.findMany({
      where: {
        deletedAt: null,
        verificationStatus: { in: ["SUBMITTED", "VERIFIED"] },
        season: { deletedAt: null, league: { deletedAt: null } },
      },
      select: { id: true },
      orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
      take: 9,
    }),
  ]);

  let moverRows = 0;
  if (boardMovers.length >= 2) {
    const rows = await prisma.rankingSnapshotRow.findMany({
      where: { snapshotId: { in: boardMovers.map((s) => s.id) } },
      select: { playerId: true },
    });
    moverRows = rows.length;
  }

  return {
    label: "getHomeData (non-ranking extras)",
    elapsedMs: Math.round(performance.now() - t0),
    gamesForCounts: officialCounts.length,
    moverSnapshotRows: moverRows,
    recentGameRows: recentGames.length,
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function getDynamicTeamStandingsInstrumented() {
  const sliceStart = queryLog.length;
  const t0 = performance.now();
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null },
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } },
    },
    orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
  });
  return {
    label: "getDynamicTeamStandings (/teams)",
    elapsedMs: Math.round(performance.now() - t0),
    gameRows: games.length,
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function getPublicGamesIndexInstrumented() {
  const sliceStart = queryLog.length;
  const t0 = performance.now();
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      verificationStatus: { in: ["SUBMITTED", "VERIFIED"] },
      season: { deletedAt: null, league: { deletedAt: null } },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: {
        where: { deletedAt: null },
        include: {
          team: true,
          player: {
            include: {
              currentRatings: { take: 1 },
            },
          },
        },
      },
    },
  });
  const statRows = games.reduce((s, g) => s + g.stats.length, 0);
  return {
    label: "getValidatedDbGames (/games)",
    elapsedMs: Math.round(performance.now() - t0),
    gameRows: games.length,
    gameStatRows: statRows,
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function getPublicLeaguesInstrumented() {
  const sliceStart = queryLog.length;
  const t0 = performance.now();
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null, seasons: { some: { deletedAt: null, games: { some: { deletedAt: null } } } } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            include: { homeTeam: true, awayTeam: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const gameRows = leagues.reduce((s, l) => s + l.seasons.reduce((ss, se) => ss + se.games.length, 0), 0);
  return {
    label: "getPublicLeagues (/leagues)",
    elapsedMs: Math.round(performance.now() - t0),
    leagueRows: leagues.length,
    gameRows,
    queries: queryLog.length - sliceStart,
    queryBreakdown: summarize(queryLog.slice(sliceStart)),
  };
}

async function main() {
  console.log("=== Ranking Pipeline Profiler ===\n");

  resetLog();
  const filterT0 = performance.now();
  const ratingFilter = await resolveActivePlayerRatingFilter();
  console.log(
    JSON.stringify({
      label: "resolveActivePlayerRatingFilter",
      elapsedMs: Math.round(performance.now() - filterT0),
      queries: queryLog.length,
      queryBreakdown: summarize(queryLog),
      result: ratingFilter,
    })
  );

  if (!ratingFilter.formulaVersionId) {
    console.error("No formulaVersionId — aborting");
    process.exit(1);
  }

  const { formulaVersionId, policyVersionId } = ratingFilter;

  resetLog();
  const homePreview = await getHomePreviewInstrumented(formulaVersionId, policyVersionId);
  console.log(JSON.stringify(homePreview, null, 2));

  resetLog();
  const fullRankings = await buildLatestNationalRankingsInstrumented(formulaVersionId, policyVersionId);
  console.log("\n" + JSON.stringify({
    ...fullRankings,
    snapshots: fullRankings.snapshots.map((s) => ({
      label: s.label,
      elapsedMs: s.elapsedMs,
      ratingRows: s.ratingRows,
      embeddedGameStats: s.embeddedGameStats,
      participationGameStatRows: s.participationGameStatRows,
    })),
  }, null, 2));

  resetLog();
  console.log("\n" + JSON.stringify(await getHomeDataExtras(), null, 2));

  resetLog();
  console.log("\n" + JSON.stringify(await getDynamicTeamStandingsInstrumented(), null, 2));

  resetLog();
  console.log("\n" + JSON.stringify(await getPublicGamesIndexInstrumented(), null, 2));

  resetLog();
  console.log("\n" + JSON.stringify(await getPublicLeaguesInstrumented(), null, 2));

  // Flame graph data as cumulative timings
  console.log("\n=== Flame graph (cumulative ms, getLatestNationalRankings) ===\n");
  const flame = fullRankings.snapshots.map((s) => ({
    name: s.label.replace("getLatestSnapshot ", ""),
    ms: s.elapsedMs,
    children: s.queryBreakdown.map((q) => ({
      name: q.key,
      ms: q.ms,
      rows: q.rows,
    })),
  }));
  console.log(JSON.stringify(flame, null, 2));

  await base.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
