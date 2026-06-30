/**
 * Benchmark sequential vs concurrent national board loading.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-board-concurrency.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-board-concurrency.ts --http http://localhost:3010/rankings
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { AgeGroup, PlayerGender, PrismaClient, RankingScope } from "@prisma/client";
import { getActivePlayerFormulaConfig } from "../src/lib/ratings/active-formula";
import { resolvePolicyVersionId } from "../src/lib/ratings/player-rating-query";
import { rankingBoardGameStatSelect } from "../src/lib/player-competition-context";
import { runWithConcurrency } from "../src/lib/run-with-concurrency";

function loadDotEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* no .env */
  }
}

type BoardJob = { ageGroup: AgeGroup; gender: PlayerGender };

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

function createInstrumentedPrisma() {
  let inFlight = 0;
  let peakInFlight = 0;
  let totalQueries = 0;

  const base = new PrismaClient();
  const prisma = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          inFlight += 1;
          peakInFlight = Math.max(peakInFlight, inFlight);
          totalQueries += 1;
          try {
            return await query(args);
          } finally {
            inFlight -= 1;
          }
        },
      },
    },
  });

  return {
    prisma,
    metrics: () => ({ peakInFlight, totalQueries }),
    resetMetrics: () => {
      peakInFlight = 0;
      totalQueries = 0;
    },
    disconnect: () => base.$disconnect(),
  };
}

async function resolveActivePlayerRatingFilter(prisma: ReturnType<typeof createInstrumentedPrisma>["prisma"]) {
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

async function loadBoardSequential(
  prisma: ReturnType<typeof createInstrumentedPrisma>["prisma"],
  gender: PlayerGender,
  ageGroup: AgeGroup,
  formulaVersionId: string,
  policyVersionId: string
) {
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

  const playerIds = ratings.map((rating) => rating.playerId);
  const stats = playerIds.length
    ? await prisma.gameStat.findMany({
        where: {
          playerId: { in: playerIds },
          deletedAt: null,
          game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
        },
        select: rankingBoardGameStatSelect,
      })
    : [];

  return {
    ageGroup,
    gender,
    rowCount: ratings.length,
    statCount: stats.length,
    snapshotId: latestSnapshot?.id ?? null,
    topPlayerId: ratings[0]?.playerId ?? null,
    topRating: ratings[0] ? Number(ratings[0].adjustedRating) : null,
  };
}

async function loadBoardConcurrentSnapshotRatings(
  prisma: ReturnType<typeof createInstrumentedPrisma>["prisma"],
  gender: PlayerGender,
  ageGroup: AgeGroup,
  formulaVersionId: string,
  policyVersionId: string
) {
  const [latestSnapshot, ratings] = await Promise.all([
    prisma.rankingSnapshot.findFirst({
      where: {
        scope: RankingScope.NATIONAL,
        ageGroup,
        gender,
        formulaVersionId,
        city: null,
        region: null,
      },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    }),
    prisma.playerRating.findMany({
      where: boardWhere(gender, ageGroup, formulaVersionId, policyVersionId),
      include: { player: { select: playerSelect } },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
    }),
  ]);

  const playerIds = ratings.map((rating) => rating.playerId);
  const stats = playerIds.length
    ? await prisma.gameStat.findMany({
        where: {
          playerId: { in: playerIds },
          deletedAt: null,
          game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
        },
        select: rankingBoardGameStatSelect,
      })
    : [];

  return {
    ageGroup,
    gender,
    rowCount: ratings.length,
    statCount: stats.length,
    snapshotId: latestSnapshot?.id ?? null,
    topPlayerId: ratings[0]?.playerId ?? null,
    topRating: ratings[0] ? Number(ratings[0].adjustedRating) : null,
  };
}

function boardJobs(): BoardJob[] {
  return [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19].flatMap((ageGroup) => [
    { ageGroup, gender: PlayerGender.BOYS },
    { ageGroup, gender: PlayerGender.GIRLS },
  ]);
}

function signatures(results: Awaited<ReturnType<typeof loadBoardSequential>>[]) {
  return results
    .map((board) =>
      JSON.stringify({
        ageGroup: board.ageGroup,
        gender: board.gender,
        rowCount: board.rowCount,
        statCount: board.statCount,
        snapshotId: board.snapshotId,
        topPlayerId: board.topPlayerId,
        topRating: board.topRating,
      })
    )
    .sort();
}

async function runSequentialBenchmark(
  prisma: ReturnType<typeof createInstrumentedPrisma>["prisma"],
  formulaVersionId: string,
  policyVersionId: string
) {
  const results = [];
  const t0 = performance.now();
  for (const job of boardJobs()) {
    results.push(await loadBoardSequential(prisma, job.gender, job.ageGroup, formulaVersionId, policyVersionId));
  }
  return { elapsedMs: Math.round(performance.now() - t0), boards: results };
}

async function runConcurrentBenchmark(
  prisma: ReturnType<typeof createInstrumentedPrisma>["prisma"],
  formulaVersionId: string,
  policyVersionId: string,
  concurrency: number
) {
  const t0 = performance.now();
  const results = await runWithConcurrency(boardJobs(), concurrency, (job) =>
    loadBoardConcurrentSnapshotRatings(prisma, job.gender, job.ageGroup, formulaVersionId, policyVersionId)
  );
  return { elapsedMs: Math.round(performance.now() - t0), boards: results, concurrency };
}

async function maybeHttpTtfb(url: string | null) {
  if (!url) return null;
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { "Accept-Encoding": "identity", "Cache-Control": "no-cache, no-store" },
  });
  const ttfbMs = Math.round(performance.now() - t0);
  const body = Buffer.from(await res.arrayBuffer());
  return { url, status: res.status, ttfbMs, bytes: body.length };
}

async function main() {
  loadDotEnv();

  const httpArgIndex = process.argv.indexOf("--http");
  const httpUrl = httpArgIndex >= 0 ? process.argv[httpArgIndex + 1] ?? null : null;
  const concurrency = Math.max(1, Number.parseInt(process.env.RANKINGS_BOARD_CONCURRENCY ?? "3", 10) || 3);

  const sequentialClient = createInstrumentedPrisma();
  const concurrentClient = createInstrumentedPrisma();
  const appClient = createInstrumentedPrisma();

  const ratingFilter = await resolveActivePlayerRatingFilter(sequentialClient.prisma);
  if (!ratingFilter.formulaVersionId) {
    throw new Error("Missing formulaVersionId");
  }
  const { formulaVersionId, policyVersionId } = ratingFilter;

  sequentialClient.resetMetrics();
  const before = await runSequentialBenchmark(sequentialClient.prisma, formulaVersionId, policyVersionId);
  const beforeMetrics = sequentialClient.metrics();

  concurrentClient.resetMetrics();
  const after = await runConcurrentBenchmark(
    concurrentClient.prisma,
    formulaVersionId,
    policyVersionId,
    concurrency
  );
  const afterMetrics = concurrentClient.metrics();

  const outputMatches = JSON.stringify(signatures(before.boards)) === JSON.stringify(signatures(after.boards));

  process.env.RANKINGS_BOARD_CONCURRENCY = String(concurrency);
  const { getLatestNationalRankings } = await import("../src/lib/rankings");
  appClient.resetMetrics();
  const appT0 = performance.now();
  const rankings = await getLatestNationalRankings();
  const appElapsedMs = Math.round(performance.now() - appT0);
  const appMetrics = appClient.metrics();

  const playerCount = Object.values(rankings.snapshotsByAge).reduce(
    (sum, board) => sum + board.boys.rows.length + board.girls.rows.length,
    0
  );

  const report = {
    generatedAt: new Date().toISOString(),
    boardConcurrency: concurrency,
    outputMatches,
    before: {
      strategy: "sequential (6 boards, snapshot then ratings)",
      getLatestNationalRankingsMs: before.elapsedMs,
      peakConcurrentPrismaQueries: beforeMetrics.peakInFlight,
      totalPrismaQueries: beforeMetrics.totalQueries,
      totalRows: before.boards.reduce((sum, board) => sum + board.rowCount, 0),
      estimatedTtfbMsPrior: "20000-22000 (measured before this change)",
    },
    after: {
      strategy: `concurrent (${concurrency} boards at a time, snapshot+ratings parallel per board)`,
      getLatestNationalRankingsMs: after.elapsedMs,
      peakConcurrentPrismaQueries: afterMetrics.peakInFlight,
      totalPrismaQueries: afterMetrics.totalQueries,
      totalRows: after.boards.reduce((sum, board) => sum + board.rowCount, 0),
    },
    appImport: {
      note: "Uses production rankings.ts via dynamic import; shares prisma singleton so peak concurrency is not instrumented here",
      getLatestNationalRankingsMs: appElapsedMs,
      playerCount,
    },
    delta: {
      loaderMsSaved: before.elapsedMs - after.elapsedMs,
      loaderPctFaster: Math.round(((before.elapsedMs - after.elapsedMs) / before.elapsedMs) * 100),
    },
    http: await maybeHttpTtfb(httpUrl),
  };

  const outDir = path.join(process.cwd(), ".cursor", "board-concurrency-benchmark");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "summary.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));

  await sequentialClient.disconnect();
  await concurrentClient.disconnect();
  await appClient.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
