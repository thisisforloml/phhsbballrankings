/**
 * Post-Prisma pipeline profiler (loader-only, no HTTP).
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/profile-post-prisma-pipeline.ts
 *
 * Env:
 *   POST_PRISMA_PROFILE=1 (set automatically by script)
 *   DATABASE_URL — production Supabase
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { brotliCompressSync, gzipSync } from "node:zlib";

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

function sumStageMs(stages: Array<{ name: string; deltaMs: number }>, prefix: string) {
  return stages
    .filter((stage) => stage.name.startsWith(prefix))
    .reduce((sum, stage) => sum + stage.deltaMs, 0);
}

function countPlayers(rankings: {
  snapshotsByAge: Record<string, { boys: { rows: unknown[] }; girls: { rows: unknown[] } }>;
}) {
  return Object.values(rankings.snapshotsByAge).reduce(
    (sum, board) => sum + board.boys.rows.length + board.girls.rows.length,
    0
  );
}

async function main() {
  loadDotEnv();
  process.env.POST_PRISMA_PROFILE = "1";

  const { enablePostPrismaProfile, buildPostPrismaReport, measureJsonPayload } = await import(
    "../src/lib/post-prisma-profile"
  );
  const { getLatestNationalRankings } = await import("../src/lib/rankings");
  const { getPublicTrustMeta } = await import("../src/lib/public-site-data");
  const { prisma } = await import("../src/lib/prisma");

  enablePostPrismaProfile("/rankings-script");

  const wallStart = performance.now();
  const rankings = await getLatestNationalRankings();
  const loaderDone = performance.now();
  const trustMeta = await getPublicTrustMeta();
  const trustDone = performance.now();

  const playerCount = countPlayers(rankings);
  measureJsonPayload("rankings", rankings);
  measureJsonPayload("trustMeta", trustMeta);
  measureJsonPayload("rankingsPageProps", { rankings, lastUpdated: trustMeta.lastUpdated });

  const report = buildPostPrismaReport({ rankings, route: "/rankings-script" });

  const prismaFinishedMs = sumStageMs(report.stages, "prisma.finished.");
  const participationMs = sumStageMs(report.stages, "transform.participationMap.");
  const mapRowMs = sumStageMs(report.stages, "transform.mapNationalRankingRow.");
  const jsonMs = report.jsonMeasures.reduce((sum, item) => sum + item.stringifyMs, 0);

  const rankingsJson = JSON.stringify(rankings);
  const structuredCloneMs = (() => {
    const t0 = performance.now();
    structuredClone(rankings);
    return performance.now() - t0;
  })();

  const outDir = path.join(process.cwd(), ".cursor", "post-prisma-profile");
  mkdirSync(outDir, { recursive: true });

  const summary = {
    generatedAt: new Date().toISOString(),
    route: "/rankings",
    wallClockMs: {
      getLatestNationalRankings: Math.round(loaderDone - wallStart),
      getPublicTrustMeta: Math.round(trustDone - loaderDone),
      totalLoaderWallMs: Math.round(trustDone - wallStart),
    },
    players: playerCount,
  boards: Object.fromEntries(
      Object.entries(rankings.snapshotsByAge).map(([age, board]) => [
        age,
        { boys: board.boys.rows.length, girls: board.girls.rows.length },
      ])
    ),
    payloadBytes: {
      rankingsUtf8: Buffer.byteLength(rankingsJson, "utf8"),
      rankingsGzip: gzipSync(rankingsJson).byteLength,
      rankingsBrotli: brotliCompressSync(rankingsJson).byteLength,
      pagePropsUtf8: report.jsonMeasures.find((item) => item.label === "rankingsPageProps")?.utf8Bytes ?? null,
      pagePropsGzip: report.jsonMeasures.find((item) => item.label === "rankingsPageProps")?.gzipBytes ?? null,
      pagePropsBrotli: report.jsonMeasures.find((item) => item.label === "rankingsPageProps")?.brotliBytes ?? null,
    },
    timingMs: {
      prismaFinishedAggregate: Math.round(prismaFinishedMs),
      transformParticipationMap: Math.round(participationMs),
      transformMapNationalRankingRow: Math.round(mapRowMs),
      jsonStringifyAggregate: Math.round(jsonMs),
      structuredCloneRankings: Math.round(structuredCloneMs),
      postPrismaOnlyEstimate: Math.round(participationMs + mapRowMs + jsonMs + structuredCloneMs),
    },
    counters: report.counters,
    objectGraph: report.objectGraph,
    waterfall: [
      { stage: "db+loaders", ms: Math.round(loaderDone - wallStart - (participationMs + mapRowMs)), note: "includes Prisma + any pre-transform work" },
      { stage: "transform.participationMap", ms: Math.round(participationMs) },
      { stage: "transform.mapNationalRankingRow", ms: Math.round(mapRowMs) },
      { stage: "json.stringify", ms: Math.round(jsonMs) },
      { stage: "structuredClone", ms: Math.round(structuredCloneMs) },
    ],
    stages: report.stages,
    jsonMeasures: report.jsonMeasures,
  };

  const summaryPath = path.join(outDir, "rankings-loader-summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(path.join(outDir, "rankings-loader-stages.json"), JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
