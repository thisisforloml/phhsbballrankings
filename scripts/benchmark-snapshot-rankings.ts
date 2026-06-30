/**
 * Benchmark live vs snapshot-first national rankings loaders.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-snapshot-rankings.ts
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-snapshot-rankings.ts --http http://localhost:3010/rankings
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { buildLatestNationalRankingsLive, getLatestNationalRankings, rankingAgeGroups } from "../src/lib/rankings";
import {
  buildLatestNationalRankingsFromSnapshots,
} from "../src/lib/rankings-snapshot-read";

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

function payloadStats(rankings: Awaited<ReturnType<typeof buildLatestNationalRankingsLive>>) {
  const json = JSON.stringify(rankings);
  const publicRowCount = Object.values(rankings.snapshotsByAge).reduce((sum, board) => {
    return sum + getPublicBoardRows(board.boys).length + getPublicBoardRows(board.girls).length;
  }, 0);
  return {
    jsonBytes: Buffer.byteLength(json, "utf8"),
    totalRowCount: Object.values(rankings.snapshotsByAge).reduce(
      (sum, board) => sum + board.boys.rows.length + board.girls.rows.length,
      0
    ),
    publicRowCount,
  };
}

async function maybeHttpTtfb(url: string | null, useSnapshotRead: boolean) {
  if (!url) return null;
  const previous = process.env.RANKINGS_READ_FROM_SNAPSHOTS;
  process.env.RANKINGS_READ_FROM_SNAPSHOTS = useSnapshotRead ? "1" : "0";
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { "Accept-Encoding": "identity", "Cache-Control": "no-cache, no-store" },
  });
  const ttfbMs = Math.round(performance.now() - t0);
  const body = Buffer.from(await res.arrayBuffer());
  if (previous === undefined) delete process.env.RANKINGS_READ_FROM_SNAPSHOTS;
  else process.env.RANKINGS_READ_FROM_SNAPSHOTS = previous;
  return { strategy: useSnapshotRead ? "snapshot" : "live", url, status: res.status, ttfbMs, bytes: body.length };
}

async function main() {
  loadDotEnv();

  const httpArgIndex = process.argv.indexOf("--http");
  const httpUrl = httpArgIndex >= 0 ? process.argv[httpArgIndex + 1] ?? null : null;

  const liveT0 = performance.now();
  const live = await buildLatestNationalRankingsLive(rankingAgeGroups);
  const liveLoaderMs = Math.round(performance.now() - liveT0);
  const livePayload = payloadStats(live);

  let snapshotLoaderMs: number | null = null;
  let snapshotPayload: ReturnType<typeof payloadStats> | null = null;
  let snapshotError: string | null = null;

  try {
    const snapshotT0 = performance.now();
    const snapshot = await buildLatestNationalRankingsFromSnapshots(rankingAgeGroups);
    snapshotLoaderMs = Math.round(performance.now() - snapshotT0);
    snapshotPayload = payloadStats(snapshot);
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : String(error);
  }

  const previousSnapshotFlag = process.env.RANKINGS_READ_FROM_SNAPSHOTS;
  process.env.RANKINGS_READ_FROM_SNAPSHOTS = "1";
  const wiredT0 = performance.now();
  const wired = await getLatestNationalRankings();
  const wiredLoaderMs = Math.round(performance.now() - wiredT0);
  if (previousSnapshotFlag === undefined) delete process.env.RANKINGS_READ_FROM_SNAPSHOTS;
  else process.env.RANKINGS_READ_FROM_SNAPSHOTS = previousSnapshotFlag;

  const report = {
    generatedAt: new Date().toISOString(),
    live: {
      strategy: "buildLatestNationalRankingsLive (PlayerRating + GameStat)",
      loaderMs: liveLoaderMs,
      ...livePayload,
    },
    snapshot: snapshotLoaderMs
      ? {
          strategy: "buildLatestNationalRankingsFromSnapshots (RankingSnapshotRow + player.findMany)",
          loaderMs: snapshotLoaderMs,
          ...snapshotPayload,
        }
      : { error: snapshotError },
    wiredSnapshotFlag: {
      strategy: "getLatestNationalRankings with RANKINGS_READ_FROM_SNAPSHOTS=1 (falls back to live if incomplete)",
      loaderMs: wiredLoaderMs,
      jsonBytes: Buffer.byteLength(JSON.stringify(wired), "utf8"),
    },
    delta:
      snapshotLoaderMs && snapshotPayload
        ? {
            loaderMsSaved: liveLoaderMs - snapshotLoaderMs,
            loaderPctFaster: Math.round(((liveLoaderMs - snapshotLoaderMs) / liveLoaderMs) * 100),
            jsonBytesDelta: snapshotPayload.jsonBytes - livePayload.jsonBytes,
          }
        : null,
    http: httpUrl
      ? {
          live: await maybeHttpTtfb(httpUrl, false),
          snapshot: await maybeHttpTtfb(httpUrl, true),
        }
      : null,
  };

  const outDir = path.join(process.cwd(), ".cursor", "snapshot-rankings-benchmark");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "summary.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();

  if (snapshotError) {
    console.error(
      `\nSnapshot benchmark skipped: ${snapshotError}${
        snapshotError.includes("Incomplete") ? " — run national snapshot regeneration first." : ""
      }`
    );
    if (snapshotError.includes("Incomplete")) process.exit(2);
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
