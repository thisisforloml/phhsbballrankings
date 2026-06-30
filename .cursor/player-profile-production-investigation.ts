/**
 * Read-only production vs local investigation for /players/[slug].
 * Does not modify application code.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json .cursor/player-profile-production-investigation.ts [slug]
 *   npx tsx --tsconfig tsconfig.scripts.json .cursor/player-profile-production-investigation.ts jude-eriobu --http https://oncourtrankings.ph
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

function loadDotEnv() {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* no .env */
  }
}

type QueryEvent = {
  phase: string;
  seq: number;
  model: string;
  operation: string;
  durationMs: number;
  sql: string;
  isPoolerOverhead: boolean;
};

function parseDatabaseHost(url: string | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      pgbouncer: parsed.searchParams.get("pgbouncer") === "true",
      mode: parsed.port === "6543" ? "transaction-pooler" : parsed.port === "5432" ? "session/direct" : "other",
    };
  } catch {
    return null;
  }
}

function classifySql(sql: string) {
  const normalized = sql.trim().toUpperCase();
  if (normalized === "BEGIN" || normalized === "COMMIT" || normalized === "DEALLOCATE ALL") return "pooler-transaction";
  if (normalized.startsWith("SELECT")) return "select";
  if (normalized.startsWith("INSERT") || normalized.startsWith("UPDATE") || normalized.startsWith("DELETE")) return "write";
  return "other";
}

function attachPhaseQueryLogger(prisma: PrismaClient, phaseRef: { current: string }, bucket: QueryEvent[], seqRef: { n: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (event: { duration: number; target: string; query: string }) => {
    const target = event.target;
    const match = target.match(/^prisma\.(\w+)\.(\w+)/);
    const sql = event.query;
    const kind = classifySql(sql);
    bucket.push({
      phase: phaseRef.current,
      seq: (seqRef.n += 1),
      model: match?.[1] ?? (kind === "pooler-transaction" ? "pgbouncer" : "raw"),
      operation: match?.[2] ?? kind,
      durationMs: Math.round(event.duration * 100) / 100,
      sql: sql.length > 500 ? `${sql.slice(0, 500)}…` : sql,
      isPoolerOverhead: kind === "pooler-transaction",
    });
  });
}

function summarizeQueries(queries: QueryEvent[]) {
  const byPhase = new Map<string, { count: number; totalMs: number; overheadMs: number; dataMs: number }>();
  const bySignature = new Map<string, { count: number; totalMs: number; maxMs: number; sampleSql: string }>();

  for (const q of queries) {
    const phase = byPhase.get(q.phase) ?? { count: 0, totalMs: 0, overheadMs: 0, dataMs: 0 };
    phase.count += 1;
    phase.totalMs += q.durationMs;
    if (q.isPoolerOverhead) phase.overheadMs += q.durationMs;
    else phase.dataMs += q.durationMs;
    byPhase.set(q.phase, phase);

    const sig = `${q.model}.${q.operation}`;
    const prev = bySignature.get(sig) ?? { count: 0, totalMs: 0, maxMs: 0, sampleSql: q.sql };
    prev.count += 1;
    prev.totalMs += q.durationMs;
    prev.maxMs = Math.max(prev.maxMs, q.durationMs);
    bySignature.set(sig, prev);
  }

  const phases = [...byPhase.entries()]
    .map(([phase, v]) => ({ phase, ...v, totalMs: Math.round(v.totalMs), overheadMs: Math.round(v.overheadMs), dataMs: Math.round(v.dataMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const signatures = [...bySignature.entries()]
    .map(([signature, v]) => ({ signature, ...v, totalMs: Math.round(v.totalMs), maxMs: Math.round(v.maxMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const overheadMs = Math.round(queries.filter((q) => q.isPoolerOverhead).reduce((s, q) => s + q.durationMs, 0));
  const dataMs = Math.round(queries.filter((q) => !q.isPoolerOverhead).reduce((s, q) => s + q.durationMs, 0));

  return {
    queryCount: queries.length,
    overheadMs,
    dataMs,
    overheadPct: queries.length ? Math.round((overheadMs / (overheadMs + dataMs)) * 100) : 0,
    phases,
    signatures,
    slowest: [...queries].sort((a, b) => b.durationMs - a.durationMs).slice(0, 15),
  };
}

async function measureHttp(label: string, url: string, runs: number) {
  const samples: Array<{ run: number; ttfbMs: number; totalMs: number; status: number | null; bytes: number; error?: string }> = [];
  for (let run = 1; run <= runs; run += 1) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, {
        headers: {
          "Cache-Control": "no-cache, no-store",
          Pragma: "no-cache",
          "Accept-Encoding": "identity",
        },
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const totalMs = Math.round(performance.now() - t0);
      samples.push({
        run,
        ttfbMs: totalMs,
        totalMs,
        status: res.status,
        bytes: buf.length,
      });
    } catch (error) {
      samples.push({
        run,
        ttfbMs: Math.round(performance.now() - t0),
        totalMs: Math.round(performance.now() - t0),
        status: null,
        bytes: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const ok = samples.filter((s) => s.status && s.status < 500);
  const med = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };
  return {
    label,
    url,
    runs,
    samples,
    medianTotalMs: med(ok.map((s) => s.totalMs)),
    medianBytes: med(ok.map((s) => s.bytes)),
    coldFirstMs: samples[0]?.totalMs ?? null,
    warmMedianMs: med(ok.slice(1).map((s) => s.totalMs)),
  };
}

async function countDataset(prisma: PrismaClient) {
  const [players, gameStats, playerRatings, snapshotRows] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.gameStat.count({ where: { deletedAt: null } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshotRow.count(),
  ]);
  return { players, gameStats, playerRatings, snapshotRows };
}

async function traceInstrumentedLoader(slug: string) {
  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");
  const { resolvePlayerIdBySlug } = await import("../src/lib/player-profile-slug");
  const { loadPeerProduction } = await import("../src/lib/player-profile-peer-production");

  const phases: Array<{ phase: string; durationMs: number; meta?: Record<string, unknown> }> = [];
  const queries: QueryEvent[] = [];
  const phaseRef = { current: "bootstrap" };
  const seqRef = { n: 0 };

  const prisma = new PrismaClient({
    log: [{ emit: "event", level: "query" }],
  });
  attachPhaseQueryLogger(prisma, phaseRef, queries, seqRef);

  const origin = performance.now();
  function mark(phase: string, start: number, meta?: Record<string, unknown>) {
    phases.push({ phase, durationMs: Math.round(performance.now() - start), meta });
  }

  // Phase-level microbench using same DB (singleton) for apples-to-apples with production code
  await prisma.$disconnect();

  const appStart = performance.now();
  const profile = await loadPlayerProfileBySlugUncached(slug);
  const appLoaderMs = Math.round(performance.now() - appStart);

  // Re-open instrumented client for isolated query replay
  const probe = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  const probeQueries: QueryEvent[] = [];
  attachPhaseQueryLogger(probe, phaseRef, probeQueries, { n: 0 });

  const isolated: Array<{ phase: string; durationMs: number; querySummary: ReturnType<typeof summarizeQueries> }> = [];

  async function runPhase(phase: string, fn: () => Promise<void>) {
    phaseRef.current = phase;
    const t0 = performance.now();
    const before = probeQueries.length;
    await fn();
    isolated.push({
      phase,
      durationMs: Math.round(performance.now() - t0),
      querySummary: summarizeQueries(probeQueries.slice(before)),
    });
  }

  let playerId: string | null = null;
  await runPhase("resolvePlayerIdBySlug", async () => {
    playerId = await resolvePlayerIdBySlug(slug);
  });

  if (playerId) {
    const { getActivePolicyVersionId } = await import("../src/lib/ratings/active-formula");
    const { RankingScope } = await import("@prisma/client");

    await runPhase("loadPlayerById", async () => {
      await probe.player.findFirst({
        where: { id: playerId!, deletedAt: null },
        include: {
          currentProgram: true,
          currentRatings: { where: { policyVersionId: getActivePolicyVersionId() } },
          rankingRows: {
            where: {
              snapshot: {
                scope: RankingScope.NATIONAL,
                formulaVersion: { versionNumber: 1 },
                city: null,
                region: null,
              },
            },
            include: { snapshot: true },
          },
          gameStats: {
            where: {
              deletedAt: null,
              performanceScores: {
                some: { formulaVersion: { versionNumber: 1 }, deletedAt: null },
              },
            },
            include: {
              team: { include: { program: true } },
              performanceScores: {
                where: { formulaVersion: { versionNumber: 1 }, deletedAt: null },
                take: 1,
              },
              game: {
                include: {
                  homeTeam: true,
                  awayTeam: true,
                  season: { include: { league: true } },
                },
              },
            },
            orderBy: { game: { gameDate: "desc" } },
          },
        },
      });
    });

    const player = await probe.player.findFirst({
      where: { id: playerId, deletedAt: null },
      select: {
        gender: true,
        ageGroupOverride: true,
        rankingRows: {
          where: {
            snapshot: {
              scope: RankingScope.NATIONAL,
              formulaVersion: { versionNumber: 1 },
              city: null,
              region: null,
            },
          },
          include: { snapshot: true },
          take: 1,
        },
        currentRatings: { where: { policyVersionId: getActivePolicyVersionId() }, take: 1 },
        gameStats: { take: 1, select: { game: { select: { season: { select: { league: { select: { ageGroup: true } } } } } } } },
      },
    });

    const profileAgeGroup =
      player?.currentRatings[0]?.ageGroup ??
      player?.gameStats[0]?.game.season.league.ageGroup ??
      "U19";
    const weekOf = player?.rankingRows[0]?.snapshot.weekOf;

    if (weekOf) {
      await runPhase("deriveSnapshotRanks", async () => {
        await probe.rankingSnapshot.findFirst({
          where: {
            scope: RankingScope.NATIONAL,
            ageGroup: profileAgeGroup,
            gender: player!.gender,
            formulaVersion: { versionNumber: 1 },
            city: null,
            region: null,
            weekOf,
          },
          include: {
            rows: {
              include: { player: { select: { id: true, region: true, position: true, deletedAt: true } } },
              orderBy: { rank: "asc" },
            },
          },
        });
      });
    }

    await runPhase("loadPeerProduction", async () => {
      await loadPeerProduction(profileAgeGroup, player!.gender);
    });

    await runPhase("loadLeaguePerGameAverages", async () => {
      const seasonId = player?.gameStats[0]?.game.season.league ? null : null;
      void seasonId;
      const stat = await probe.gameStat.findFirst({
        where: { playerId: playerId!, deletedAt: null },
        select: { game: { select: { seasonId: true } } },
        orderBy: { game: { gameDate: "desc" } },
      });
      if (stat?.game.seasonId) {
        await Promise.all([
          probe.leagueSeasonAverage.findUnique({ where: { seasonId: stat.game.seasonId } }),
          probe.gameStat.count({
            where: { deletedAt: null, game: { seasonId: stat.game.seasonId, deletedAt: null } },
          }),
        ]);
      }
    });
  }

  await probe.$disconnect();

  const combinedProbe = summarizeQueries(probeQueries);

  return {
    slug,
    found: Boolean(profile),
    appLoaderMs,
    phases,
    isolatedPhases: isolated,
    probeQuerySummary: combinedProbe,
    profileMeta: profile
      ? {
          gamesPlayed: profile.gamesPlayed,
          comparisonCount: profile.intelligence.comparisonCount,
          ageGroup: profile.ageGroup,
          gender: profile.gender,
          jsonBytes: Buffer.byteLength(JSON.stringify(profile), "utf8"),
        }
      : null,
    elapsedMs: Math.round(performance.now() - origin),
  };
}

async function main() {
  loadDotEnv();
  const slug = process.argv[2] ?? "jude-eriobu";
  const httpArgIdx = process.argv.indexOf("--http");
  const httpBase = httpArgIdx >= 0 ? process.argv[httpArgIdx + 1] : null;

  const databaseUrl = process.env.DATABASE_URL;
  const dbHost = parseDatabaseHost(databaseUrl);

  const probe = new PrismaClient();
  const dataset = await countDataset(probe);
  await probe.$disconnect();

  const localTrace = await traceInstrumentedLoader(slug);

  const productionUrls = [
    httpBase,
    "https://oncourtrankings.ph",
    "https://peachbasket.ph",
    "https://www.peachbasket.ph",
  ].filter(Boolean) as string[];

  const httpResults = [];
  for (const base of [...new Set(productionUrls)]) {
    const pageUrl = `${base.replace(/\/$/, "")}/players/${encodeURIComponent(slug)}`;
    const apiUrl = `${base.replace(/\/$/, "")}/api/players/${encodeURIComponent(slug)}/profile`;
    httpResults.push(await measureHttp(`page ${base}`, pageUrl, 3));
    httpResults.push(await measureHttp(`api ${base}`, apiUrl, 2));
  }

  const prior = {
    preOptimizationCombinedMs: 6044,
    postPhase3CachedLoaderMs: 2218,
    postPhase3PeerProductionMs: { before: 911, after: 257 },
    sources: [
      ".cursor/player-profile-investigation/summary.json",
      ".cursor/player-profile-cache-benchmark/summary.json",
      ".cursor/player-profile-peer-production-benchmark/summary.json",
    ],
  };

  const slowestPhase = localTrace.isolatedPhases.sort((a, b) => b.durationMs - a.durationMs)[0];
  const slowestQuerySig = localTrace.probeQuerySummary.signatures[0];

  const report = {
    generatedAt: new Date().toISOString(),
    route: "/players/[slug]",
    slug,
    investigationScope: "read-only measurement; no application code changes",
    database: {
      host: dbHost,
      dataset,
      note: "Local script uses DATABASE_URL from .env — compare host/mode to Vercel production env.",
    },
    local: {
      appLoaderMs: localTrace.appLoaderMs,
      profileMeta: localTrace.profileMeta,
      phaseWallClock: localTrace.isolatedPhases,
      querySummary: localTrace.probeQuerySummary,
      slowestPhase: slowestPhase
        ? { phase: slowestPhase.phase, wallClockMs: slowestPhase.durationMs, queries: slowestPhase.querySummary }
        : null,
      slowestQuerySignature: slowestQuerySig ?? null,
    },
    productionHttp: httpResults,
    comparison: {
      localAppLoaderMs: localTrace.appLoaderMs,
      productionMedianPageMs: httpResults.find((r) => r.label.startsWith("page"))?.medianTotalMs ?? null,
      productionColdFirstMs: httpResults.find((r) => r.label.startsWith("page"))?.coldFirstMs ?? null,
      ratioProductionToLocal:
        httpResults[0]?.medianTotalMs && localTrace.appLoaderMs
          ? Math.round((httpResults[0].medianTotalMs / localTrace.appLoaderMs) * 10) / 10
          : null,
      priorBenchmarks: prior,
    },
    rootCauseAnalysis: {
      dominantLocalPhase: slowestPhase?.phase ?? "unknown",
      dominantLocalQuery: slowestQuerySig?.signature ?? "unknown",
      pgbouncerOverheadMs: localTrace.probeQuerySummary.overheadMs,
      pgbouncerOverheadPct: localTrace.probeQuerySummary.overheadPct,
      sequentialQueryCount: localTrace.probeQuerySummary.queryCount,
      rscCpuMsEstimate: Math.max(0, localTrace.appLoaderMs - localTrace.isolatedPhases.reduce((s, p) => s + p.durationMs, 0)),
      clientSecondLoaderNote:
        "PlayerTrendsChart and PlayerPercentileRadar fetch /api/players/[slug]/profile after hydration — adds a second serverless invocation not included in RSC HTML TTFB.",
    },
    waterfall: buildWaterfall(localTrace),
    recommendations: buildRecommendations(localTrace, dbHost, httpResults),
  };

  const outDir = path.join(process.cwd(), ".cursor", "player-profile-production-investigation");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

function buildWaterfall(trace: Awaited<ReturnType<typeof traceInstrumentedLoader>>) {
  const phases = trace.isolatedPhases;
  let cursor = 0;
  const steps = phases.map((p) => {
    const step = {
      phase: p.phase,
      startMs: cursor,
      durationMs: p.durationMs,
      endMs: cursor + p.durationMs,
      prismaQueries: p.querySummary.queryCount,
      prismaMs: p.querySummary.dataMs + p.querySummary.overheadMs,
      poolerOverheadMs: p.querySummary.overheadMs,
      slowestQuery: p.querySummary.slowest[0] ?? null,
    };
    cursor += p.durationMs;
    return step;
  });

  return {
    totalWallClockMs: cursor,
    appLoaderMs: trace.appLoaderMs,
    unaccountedMs: Math.max(0, trace.appLoaderMs - cursor),
    steps,
  };
}

function buildRecommendations(
  trace: Awaited<ReturnType<typeof traceInstrumentedLoader>>,
  dbHost: ReturnType<typeof parseDatabaseHost>,
  httpResults: Awaited<ReturnType<typeof measureHttp>>[]
) {
  const recs: string[] = [];
  const prodMs = httpResults.find((r) => r.label.startsWith("page") && r.medianTotalMs)?.medianTotalMs;
  const localMs = trace.appLoaderMs;

  if (prodMs && localMs && prodMs > localMs * 3) {
    recs.push(
      `Production is ~${Math.round(prodMs / localMs)}× slower than local loader — gap is unlikely to be CPU/RSC-only; investigate network + pooler + cold start + larger production dataset.`
    );
  }

  if (dbHost?.mode === "transaction-pooler") {
    recs.push(
      `DATABASE_URL uses Supabase transaction pooler (:6543). Each Prisma statement pays BEGIN/DEALLOCATE/COMMIT overhead (~${trace.probeQuerySummary.overheadMs}ms measured locally across ${trace.probeQuerySummary.queryCount} statements). Fewer round-trips help more than micro-optimizing SQL inside a phase.`
    );
  }

  const top = trace.isolatedPhases.sort((a, b) => b.durationMs - a.durationMs)[0];
  if (top?.phase === "loadPlayerById") {
    recs.push(
      "Slowest phase is loadPlayerById deep include — Prisma expands this into many SQL round-trips (player, ratings, ranking rows, game stats, games, teams, leagues). Indexing alone may not fix; reducing join breadth or denormalizing hot fields would."
    );
  }
  if (top?.phase === "deriveSnapshotRanks") {
    recs.push(
      "deriveSnapshotRanks loads entire national snapshot row set (~200+ rows with nested player). Consider indexed lookup by playerId+snapshotId instead of loading all rows for client-side filter."
    );
  }
  if (top?.phase === "loadPeerProduction") {
    recs.push(
      "loadPeerProduction aggregate query still scans age-group game_stats joined to ratings — ensure indexes on game_stats(playerId), game_performance_scores(gameStatId), player_ratings(ageGroup, policyVersionId)."
    );
  }

  recs.push(
    "If Vercel functions cold-start, first request adds 1–3s+ before any DB work — compare coldFirstMs vs warmMedianMs in productionHttp."
  );
  recs.push(
    "Charts issue a second GET /api/players/[slug]/profile after hydration — users measuring 'page ready' in DevTools may see ~2× loader cost."
  );

  return recs;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
