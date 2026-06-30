/**
 * Read-only Prisma query profiler for production route loaders.
 * Logs SQL, duration, and row counts per query.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/profile-production-routes.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/profile-production-routes.ts --compare
 *
 * Env:
 *   DATABASE_URL          — primary target (typically Supabase production)
 *   LOCAL_DATABASE_URL    — optional local Postgres for --compare mode
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  AgeGroup,
  PlayerGender,
  PrismaClient,
  RankingScope,
  VerificationStatus,
} from "@prisma/client";
import { getActivePlayerFormulaConfig } from "../src/lib/ratings/active-formula";
import { resolvePolicyVersionId } from "../src/lib/ratings/player-rating-query";
import { rankingBoardGameStatSelect } from "../src/lib/player-competition-context";

type QueryRecord = {
  seq: number;
  route: string;
  loader: string;
  sql: string;
  params: string;
  durationMs: number;
  rows: number | null;
  model: string | null;
};

type RouteReport = {
  route: string;
  totalMs: number;
  queryCount: number;
  queries: QueryRecord[];
};

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

function dbHostLabel(url: string | undefined) {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return "invalid-url";
  }
}

function inferModel(sql: string): string | null {
  const from = sql.match(/FROM\s+"public"\."([^"]+)"/i);
  if (from) return from[1];
  const into = sql.match(/INTO\s+"public"\."([^"]+)"/i);
  if (into) return into[1];
  return null;
}

function createProfilingClient() {
  const queries: QueryRecord[] = [];
  let route = "";
  let loader = "";
  let seq = 0;

  const base = new PrismaClient({
    log: [{ emit: "event", level: "query" }],
  });

  base.$on("query", (event) => {
    const entry: QueryRecord = {
      seq: ++seq,
      route,
      loader,
      sql: event.query,
      params: event.params,
      durationMs: event.duration,
      rows: null,
      model: inferModel(event.query),
    };
    queries.push(entry);
    pendingRowEntry = entry;
  });

  let pendingRowEntry: QueryRecord | null = null;

  const prisma = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          const result = await query(args);
          const entry = pendingRowEntry;
          pendingRowEntry = null;
          if (entry) {
            if (Array.isArray(result)) entry.rows = result.length;
            else if (typeof result === "number") entry.rows = result;
            else if (result) entry.rows = 1;
            else entry.rows = 0;
          }
          return result;
        },
      },
    },
  });

  const run = async <T>(routeName: string, loaderName: string, fn: () => Promise<T>) => {
    route = routeName;
    loader = loaderName;
    return fn();
  };

  return {
    prisma,
    queries,
    run,
    async disconnect() {
      await base.$disconnect();
    },
  };
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

async function resolveRatingFilter(prisma: ReturnType<typeof createProfilingClient>["prisma"]) {
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

async function profileHomeRoute(client: ReturnType<typeof createProfilingClient>) {
  const { prisma, run, queries } = client;
  const t0 = performance.now();
  const start = queries.length;

  const filter = await run("/", "resolveActivePlayerRatingFilter", () => resolveRatingFilter(prisma));
  if (!filter.formulaVersionId) throw new Error("Missing formulaVersionId");

  const { formulaVersionId, policyVersionId } = filter;
  const ageGroup = AgeGroup.U19;

  await run("/", "getHomeNationalBoardPreview.boys", async () => {
    const [totalRows, latestSnapshot, ratings] = await Promise.all([
      prisma.playerRating.count({
        where: boardWhere(PlayerGender.BOYS, ageGroup, formulaVersionId, policyVersionId),
      }),
      prisma.rankingSnapshot.findFirst({
        where: {
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender: PlayerGender.BOYS,
          formulaVersionId,
          city: null,
          region: null,
        },
        orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      }),
      prisma.playerRating.findMany({
        where: boardWhere(PlayerGender.BOYS, ageGroup, formulaVersionId, policyVersionId),
        include: { player: { select: homePreviewPlayerSelect } },
        orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
        take: 10,
      }),
    ]);
    return { totalRows, latestSnapshot, ratings };
  });

  await run("/", "getHomeNationalBoardPreview.girls", async () => {
    const [totalRows, latestSnapshot, ratings] = await Promise.all([
      prisma.playerRating.count({
        where: boardWhere(PlayerGender.GIRLS, ageGroup, formulaVersionId, policyVersionId),
      }),
      prisma.rankingSnapshot.findFirst({
        where: {
          scope: RankingScope.NATIONAL,
          ageGroup,
          gender: PlayerGender.GIRLS,
          formulaVersionId,
          city: null,
          region: null,
        },
        orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      }),
      prisma.playerRating.findMany({
        where: boardWhere(PlayerGender.GIRLS, ageGroup, formulaVersionId, policyVersionId),
        include: { player: { select: homePreviewPlayerSelect } },
        orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
        take: 10,
      }),
    ]);
    return { totalRows, latestSnapshot, ratings };
  });

  await run("/", "getOfficialTeamCompetitionCounts", () =>
    prisma.game.findMany({
      where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
      select: { homeTeamId: true, awayTeamId: true, season: { select: { leagueId: true } } },
    })
  );

  await run("/", "getBoardMovers", async () => {
    const snapshots = await prisma.rankingSnapshot.findMany({
      where: { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS, scope: RankingScope.NATIONAL },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 2,
      select: { id: true, weekOf: true },
    });
    if (snapshots.length < 2) return [];
    return prisma.rankingSnapshotRow.findMany({
      where: { snapshotId: { in: snapshots.map((s) => s.id) } },
      include: { player: { select: { id: true, displayName: true } } },
      orderBy: { rank: "asc" },
    });
  });

  await run("/", "getHomeRecentGames", () =>
    prisma.game.findMany({
      where: {
        deletedAt: null,
        verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
        season: { deletedAt: null, league: { deletedAt: null } },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: { include: { league: true } },
      },
      orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
      take: 9,
    })
  );

  await run("/", "getPublicTrustMeta", async () => {
    const [latestGame, latestSnapshot] = await Promise.all([
      prisma.game.findFirst({
        where: {
          deletedAt: null,
          verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
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

  const routeQueries = queries.slice(start);
  return {
    route: "/",
    totalMs: Math.round(performance.now() - t0),
    queryCount: routeQueries.length,
    queries: routeQueries,
  } satisfies RouteReport;
}

async function profileSnapshot(
  client: ReturnType<typeof createProfilingClient>,
  route: string,
  gender: PlayerGender,
  ageGroup: AgeGroup,
  formulaVersionId: string,
  policyVersionId: string
) {
  const { prisma, run } = client;
  const label = `getLatestSnapshot ${ageGroup}/${gender}`;

  await run(route, `${label}.rankingSnapshot`, () =>
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
    })
  );

  const ratings = await run(route, `${label}.playerRating`, () =>
    prisma.playerRating.findMany({
      where: boardWhere(gender, ageGroup, formulaVersionId, policyVersionId),
      include: { player: { select: playerSelect } },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
    })
  );

  if (ratings.length) {
    await run(route, `${label}.gameStat`, () =>
      prisma.gameStat.findMany({
        where: {
          playerId: { in: ratings.map((r) => r.playerId) },
          deletedAt: null,
          game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } },
        },
        select: rankingBoardGameStatSelect,
      })
    );
  }
}

async function profileRankingsRoute(client: ReturnType<typeof createProfilingClient>) {
  const { prisma, run, queries } = client;
  const t0 = performance.now();
  const start = queries.length;

  const filter = await run("/rankings", "resolveActivePlayerRatingFilter", () => resolveRatingFilter(prisma));
  if (!filter.formulaVersionId) throw new Error("Missing formulaVersionId");

  for (const ageGroup of [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      await profileSnapshot(
        client,
        "/rankings",
        gender,
        ageGroup,
        filter.formulaVersionId,
        filter.policyVersionId
      );
    }
  }

  await run("/rankings", "getPublicTrustMeta", async () => {
    const [latestGame, latestSnapshot] = await Promise.all([
      prisma.game.findFirst({
        where: {
          deletedAt: null,
          verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
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

  const routeQueries = queries.slice(start);
  return {
    route: "/rankings",
    totalMs: Math.round(performance.now() - t0),
    queryCount: routeQueries.length,
    queries: routeQueries,
  } satisfies RouteReport;
}

async function profileTeamsRoute(client: ReturnType<typeof createProfilingClient>) {
  const { prisma, run, queries } = client;
  const t0 = performance.now();
  const start = queries.length;

  await run("/teams", "getDynamicTeamStandings", () =>
    prisma.game.findMany({
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
    })
  );

  const routeQueries = queries.slice(start);
  return {
    route: "/teams",
    totalMs: Math.round(performance.now() - t0),
    queryCount: routeQueries.length,
    queries: routeQueries,
  } satisfies RouteReport;
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().slice(0, 240);
}

function fingerprintQuery(q: QueryRecord) {
  return `${q.model ?? "?"}|${normalizeSql(q.sql)}`;
}

function analyzeRoutes(reports: RouteReport[]) {
  const all = reports.flatMap((r) => r.queries);
  const slowest = [...all].sort((a, b) => b.durationMs - a.durationMs)[0] ?? null;

  const dupMap = new Map<string, QueryRecord[]>();
  for (const q of all) {
    const key = `${q.route}|${fingerprintQuery(q)}`;
    const bucket = dupMap.get(key) ?? [];
    bucket.push(q);
    dupMap.set(key, bucket);
  }
  const duplicates = [...dupMap.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      fingerprint: key,
      count: list.length,
      totalMs: Math.round(list.reduce((s, q) => s + q.durationMs, 0)),
      sample: list[0],
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const over2s = all
    .filter((q) => q.durationMs >= 2000)
    .sort((a, b) => b.durationMs - a.durationMs);

  return { slowest, duplicates, over2s, all };
}

function explainSlowQuery(q: QueryRecord) {
  const sql = q.sql.toLowerCase();
  const reasons: string[] = [];

  if (sql.includes("player_id in (")) {
    reasons.push("Large `IN (playerId…)` list — fetches all game stats for every rated player on the board.");
  }
  if (sql.includes('"player_ratings"') && sql.includes("order by")) {
    reasons.push("PlayerRating board query sorts by adjustedRating with nested player join.");
  }
  if (sql.includes('"games"') && sql.includes("join") && !sql.includes("limit")) {
    reasons.push("Full game graph load (teams + programs + seasons + leagues) with no LIMIT.");
  }
  if (sql.includes('"ranking_snapshots"')) {
    reasons.push("RankingSnapshot metadata lookup ordered by weekOf DESC.");
  }
  if (q.durationMs >= 2000 && reasons.length === 0) {
    reasons.push("High latency likely from network round-trip to Supabase and/or missing covering index for this filter.");
  }

  const indexHints: string[] = [];
  if (sql.includes('"game_stats"') && sql.includes("player_id")) {
    indexHints.push("Consider composite index on game_stats(player_id, deleted_at) including game_id.");
  }
  if (sql.includes('"player_ratings"') && sql.includes("gender")) {
    indexHints.push("PlayerRating filters by formulaVersionId + policyVersionId + ageGroup + player.gender — verify nested join uses player_ratings indexes first.");
  }
  if (sql.includes('"games"') && sql.includes("deleted_at is null")) {
    indexHints.push("Game table scan with 4-table join chain — index on games(deleted_at, season_id) may help filter.");
  }

  return { reasons, indexHints };
}

async function profileDatabase(label: string, databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  const client = createProfilingClient();

  const home = await profileHomeRoute(client);
  const rankings = await profileRankingsRoute(client);
  const teams = await profileTeamsRoute(client);
  await client.disconnect();

  const reports = [home, rankings, teams];
  const analysis = analyzeRoutes(reports);

  return {
    label,
    databaseHost: dbHostLabel(databaseUrl),
    reports,
    analysis,
    summary: {
      homeMs: home.totalMs,
      rankingsMs: rankings.totalMs,
      teamsMs: teams.totalMs,
      totalQueries: reports.reduce((s, r) => s + r.queryCount, 0),
      slowestQueryMs: analysis.slowest?.durationMs ?? 0,
      slowestQuery: analysis.slowest,
      duplicatePatterns: analysis.duplicates.length,
      queriesOver2s: analysis.over2s.length,
    },
  };
}

function compareTargets(a: Awaited<ReturnType<typeof profileDatabase>>, b: Awaited<ReturnType<typeof profileDatabase>>) {
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();

  for (const report of a.reports) {
    for (const q of report.queries) {
      const key = `${report.route}|${fingerprintQuery(q)}`;
      mapA.set(key, (mapA.get(key) ?? 0) + q.durationMs);
    }
  }
  for (const report of b.reports) {
    for (const q of report.queries) {
      const key = `${report.route}|${fingerprintQuery(q)}`;
      mapB.set(key, (mapB.get(key) ?? 0) + q.durationMs);
    }
  }

  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  return [...keys]
    .map((key) => {
      const localMs = mapA.get(key) ?? 0;
      const prodMs = mapB.get(key) ?? 0;
      const ratio = localMs > 0 ? prodMs / localMs : prodMs > 0 ? Infinity : 1;
      return { key, localMs: Math.round(localMs), prodMs: Math.round(prodMs), ratio: Number(ratio.toFixed(2)) };
    })
    .sort((x, y) => y.prodMs - x.prodMs);
}

function printReport(result: Awaited<ReturnType<typeof profileDatabase>>) {
  console.log(`\n=== ${result.label} (${result.databaseHost}) ===\n`);
  for (const report of result.reports) {
    console.log(`${report.route}: ${report.totalMs} ms, ${report.queryCount} queries`);
  }
  console.log(`\nSlowest query: ${result.analysis.slowest?.durationMs ?? 0} ms`);
  if (result.analysis.slowest) {
    const s = result.analysis.slowest;
    console.log(`  route=${s.route} loader=${s.loader} model=${s.model} rows=${s.rows}`);
    console.log(`  sql=${normalizeSql(s.sql)}`);
  }

  if (result.analysis.duplicates.length) {
    console.log("\nDuplicate query patterns:");
    for (const d of result.analysis.duplicates.slice(0, 10)) {
      console.log(
        `  ${d.count}x ${d.totalMs} ms total — ${d.sample.route} ${d.sample.loader} [${d.sample.model}]`
      );
    }
  }

  if (result.analysis.over2s.length) {
    console.log("\nQueries >= 2s:");
    for (const q of result.analysis.over2s) {
      const { reasons, indexHints } = explainSlowQuery(q);
      console.log(`  ${q.durationMs} ms | ${q.route} | ${q.loader} | rows=${q.rows} | ${q.model}`);
      console.log(`    why: ${reasons.join(" ")}`);
      if (indexHints.length) console.log(`    index: ${indexHints.join(" ")}`);
    }
  }

  console.log("\nTop 15 queries by duration:");
  for (const q of [...result.analysis.all].sort((a, b) => b.durationMs - a.durationMs).slice(0, 15)) {
    console.log(
      `  ${q.durationMs.toString().padStart(6)} ms | ${q.route.padEnd(10)} | ${q.loader.slice(0, 40).padEnd(40)} | rows=${String(q.rows).padStart(5)} | ${q.model}`
    );
  }
}

async function main() {
  loadDotEnv();
  const compare = process.argv.includes("--compare");
  const outDir = path.join(process.cwd(), ".cursor", "production-query-profile");
  mkdirSync(outDir, { recursive: true });

  const primaryUrl = process.env.DATABASE_URL;
  if (!primaryUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const primary = await profileDatabase("primary", primaryUrl);
  writeFileSync(path.join(outDir, "primary.json"), JSON.stringify(primary, null, 2));
  printReport(primary);

  if (compare && process.env.LOCAL_DATABASE_URL) {
    const local = await profileDatabase("local", process.env.LOCAL_DATABASE_URL);
    writeFileSync(path.join(outDir, "local.json"), JSON.stringify(local, null, 2));
    printReport(local);

    const comparison = compareTargets(local, primary);
    writeFileSync(path.join(outDir, "comparison.json"), JSON.stringify(comparison, null, 2));

    console.log("\n=== Local vs Primary (disproportionately slower on primary) ===\n");
    for (const row of comparison.filter((r) => r.prodMs > 500).slice(0, 20)) {
      console.log(
        `  prod ${row.prodMs} ms vs local ${row.localMs} ms (${row.ratio}x) — ${row.key.slice(0, 120)}`
      );
    }
  } else if (compare) {
    console.log("\nSet LOCAL_DATABASE_URL in .env to enable --compare mode.");
  }

  console.log(`\nJSON written to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
