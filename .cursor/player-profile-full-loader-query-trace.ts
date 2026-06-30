/**
 * Full loader Prisma waterfall — injects instrumented client before dynamic import.
 * Read-only; does not modify application source files.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

type Q = { seq: number; durationMs: number; sql: string; overhead: boolean };

async function main() {
  loadDotEnv();
  const slug = process.argv[2] ?? "jude-eriobu";
  const queries: Q[] = [];
  let seq = 0;

  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$on("query", (event: { duration: number; query: string }) => {
    const sql = event.query.trim();
    const overhead = /^(BEGIN|COMMIT|DEALLOCATE ALL)$/i.test(sql);
    queries.push({
      seq: (seq += 1),
      durationMs: Math.round(event.duration * 100) / 100,
      sql: sql.length > 400 ? `${sql.slice(0, 400)}…` : sql,
      overhead,
    });
  });

  const globalStore = globalThis as unknown as { prisma?: PrismaClient; prismaSchemaFingerprint?: string };
  globalStore.prisma = client;

  const t0 = performance.now();
  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");
  const profile = await loadPlayerProfileBySlugUncached(slug);
  const loaderMs = Math.round(performance.now() - t0);

  const dataQueries = queries.filter((q) => !q.overhead);
  const overheadMs = Math.round(queries.filter((q) => q.overhead).reduce((s, q) => s + q.durationMs, 0));
  const dataMs = Math.round(dataQueries.reduce((s, q) => s + q.durationMs, 0));

  const slowest = [...dataQueries].sort((a, b) => b.durationMs - a.durationMs).slice(0, 12);

  function classify(sql: string) {
    if (sql.includes("FROM game_stats") && sql.includes("GROUP BY")) return "loadPeerProduction";
    if (sql.includes("ranking_snapshot_rows") && sql.includes("WHERE")) return "deriveSnapshotRanks";
    if (sql.includes("FROM \"public\".\"players\"") && sql.includes("profile_slug")) return "resolvePlayerIdBySlug";
    if (sql.includes("league_season_averages")) return "loadLeaguePerGameAverages";
    if (sql.includes("FROM \"public\".\"players\"") && sql.includes("firstName")) return "loadPlayerById";
    if (sql.includes("game_stats")) return "loadPlayerById";
    if (sql.includes("ranking_snapshot")) return "loadPlayerById|deriveSnapshotRanks";
    return "other";
  }

  const byPhase = new Map<string, number>();
  for (const q of dataQueries) {
    const phase = classify(q.sql);
    byPhase.set(phase, (byPhase.get(phase) ?? 0) + q.durationMs);
  }

  const report = {
    slug,
    loaderMs,
    found: Boolean(profile),
    queryCount: queries.length,
    dataQueryCount: dataQueries.length,
    overheadMs,
    dataMs,
    overheadPct: overheadMs + dataMs ? Math.round((overheadMs / (overheadMs + dataMs)) * 100) : 0,
    byPhaseMs: [...byPhase.entries()].map(([phase, ms]) => ({ phase, ms: Math.round(ms) })).sort((a, b) => b.ms - a.ms),
    slowestQueries: slowest,
  };

  const outDir = path.join(process.cwd(), ".cursor", "player-profile-production-investigation");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "full-loader-queries.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await client.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
