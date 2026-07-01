/**
 * Staging rollout harness for snapshot-first rankings.
 *
 * Runs regeneration + parity against DATABASE_URL, then compares loader/HTTP
 * metrics for live vs snapshot-flag paths.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/staging-snapshot-rankings-rollout.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/staging-snapshot-rankings-rollout.ts --skip-regen
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/staging-snapshot-rankings-rollout.ts --http-live http://localhost:3000 --http-snapshot http://localhost:3010
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { execSync } from "node:child_process";
import { prisma } from "../src/lib/prisma";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import {
  buildLatestNationalRankingsLive,
  getLatestNationalRankings,
  rankingAgeGroups,
} from "../src/lib/rankings";
import { buildLatestNationalRankingsFromSnapshots } from "../src/lib/rankings-snapshot-read";
import { regenerateNationalRankingSnapshots } from "../src/lib/rankings/national-snapshot-regeneration";

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

function parseDatabaseHost(url: string | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    return `${parsed.hostname}:${parsed.port || "5432"}`;
  } catch {
    return null;
  }
}

async function measureHttp(label: string, baseUrl: string, routes: string[]) {
  const samples: Array<{ route: string; status: number | null; ttfbMs: number; bytes: number; error?: string }> = [];
  for (const route of routes) {
    const url = `${baseUrl.replace(/\/$/, "")}${route}`;
    const t0 = performance.now();
    try {
      const res = await fetch(url, {
        headers: { "Cache-Control": "no-cache, no-store", "Accept-Encoding": "identity" },
      });
      const buf = Buffer.from(await res.arrayBuffer());
      samples.push({
        route,
        status: res.status,
        ttfbMs: Math.round(performance.now() - t0),
        bytes: buf.length,
      });
    } catch (error) {
      samples.push({
        route,
        status: null,
        ttfbMs: Math.round(performance.now() - t0),
        bytes: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { label, baseUrl, samples };
}

function runParityInline() {
  return execSync("npx tsx --tsconfig tsconfig.scripts.json scripts/verify-snapshot-rankings-parity.ts", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

async function loaderBenchmark() {
  const liveT0 = performance.now();
  const live = await buildLatestNationalRankingsLive(rankingAgeGroups);
  const liveMs = Math.round(performance.now() - liveT0);

  const snapshotT0 = performance.now();
  const snapshot = await buildLatestNationalRankingsFromSnapshots(rankingAgeGroups);
  const snapshotMs = Math.round(performance.now() - snapshotT0);

  const previous = process.env.RANKINGS_READ_FROM_SNAPSHOTS;
  process.env.RANKINGS_READ_FROM_SNAPSHOTS = "1";
  const wiredT0 = performance.now();
  await getLatestNationalRankings();
  const wiredMs = Math.round(performance.now() - wiredT0);
  if (previous === undefined) delete process.env.RANKINGS_READ_FROM_SNAPSHOTS;
  else process.env.RANKINGS_READ_FROM_SNAPSHOTS = previous;

  const publicRows = (data: typeof live) =>
    Object.values(data.snapshotsByAge).reduce(
      (sum, board) => sum + getPublicBoardRows(board.boys).length + getPublicBoardRows(board.girls).length,
      0
    );

  return {
    liveLoaderMs: liveMs,
    snapshotLoaderMs: snapshotMs,
    wiredFlagLoaderMs: wiredMs,
    publicRowCount: publicRows(live),
    publicRowCountSnapshot: publicRows(snapshot),
    loaderMsSaved: liveMs - snapshotMs,
    loaderPctFaster: liveMs ? Math.round(((liveMs - snapshotMs) / liveMs) * 100) : 0,
  };
}

async function main() {
  loadDotEnv();
  const skipRegen = process.argv.includes("--skip-regen");
  const httpLiveIdx = process.argv.indexOf("--http-live");
  const httpSnapshotIdx = process.argv.indexOf("--http-snapshot");
  const httpLive = httpLiveIdx >= 0 ? process.argv[httpLiveIdx + 1] : null;
  const httpSnapshot = httpSnapshotIdx >= 0 ? process.argv[httpSnapshotIdx + 1] : null;

  const routes = ["/", "/rankings", "/players/jude-eriobu", "/api/search?q=jude"];

  let regeneration: Awaited<ReturnType<typeof regenerateNationalRankingSnapshots>> | null = null;
  if (!skipRegen) {
    regeneration = await regenerateNationalRankingSnapshots();
  }

  let parityStdout = "";
  let parityOk = false;
  try {
    parityStdout = runParityInline();
    parityOk = parityStdout.includes('"allPublicBoardsIdentical": true');
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    parityStdout = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  }

  const loader = await loaderBenchmark();

  const http = {
    live: httpLive ? await measureHttp("live (flag off)", httpLive, routes) : null,
    snapshot: httpSnapshot ? await measureHttp("staging (flag on)", httpSnapshot, routes) : null,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      databaseHost: parseDatabaseHost(process.env.DATABASE_URL),
      productionFlagStatus: "RANKINGS_READ_FROM_SNAPSHOTS must remain unset on Production",
      stagingFlagStatus: "RANKINGS_READ_FROM_SNAPSHOTS=1 on Preview/Staging only",
    },
    regeneration,
    parity: {
      ok: parityOk,
      excerpt: parityStdout.split("\n").slice(0, 30).join("\n"),
    },
    loader,
    http,
    rollback: {
      staging: "Unset RANKINGS_READ_FROM_SNAPSHOTS on Preview/Staging — immediate live path resume",
      production: "Flag never enabled — no rollback required",
      data: "Snapshot rows remain; live path ignores them when flag is off",
    },
    qaRoutes: routes,
    nextSteps: parityOk
      ? [
          "Set RANKINGS_READ_FROM_SNAPSHOTS=1 on Vercel Preview/Staging environment only",
          "Re-run this script with --http-live and --http-snapshot against deployed URLs",
          "Complete manual browser QA on staging",
          "Do NOT enable on Production until staging QA signed off",
        ]
      : ["Fix parity failures before enabling staging flag"],
  };

  const outDir = path.join(process.cwd(), ".cursor", "snapshot-rankings-staging-rollout");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
  writeFileSync(path.join(outDir, "parity-output.txt"), parityStdout, "utf8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
  if (!parityOk) process.exit(3);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
