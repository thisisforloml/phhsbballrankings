import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";

export type PostPrismaStage = {
  name: string;
  deltaMs: number;
  cumulativeMs: number;
  meta?: Record<string, unknown>;
};

export type PostPrismaCounters = {
  mapNationalRankingRowCalls: number;
  ratingSpreadCopies: number;
  affiliationTransforms: number;
  affiliationSortOps: number;
  participationMapPlayers: number;
};

export type PostPrismaJsonMeasure = {
  label: string;
  stringifyMs: number;
  utf8Bytes: number;
  gzipBytes: number;
  brotliBytes: number;
};

export type PostPrismaReport = {
  route: string;
  generatedAt: string;
  totalMs: number;
  stages: PostPrismaStage[];
  counters: PostPrismaCounters;
  jsonMeasures: PostPrismaJsonMeasure[];
  objectGraph?: {
    nodeCount: number;
    maxDepth: number;
    uniquePlayerIds: number;
    duplicateSlugCount: number;
  };
};

let enabled = process.env.POST_PRISMA_PROFILE === "1";
let route = "unknown";
let startMs = 0;
let lastMs = 0;
const stages: PostPrismaStage[] = [];
const counters: PostPrismaCounters = {
  mapNationalRankingRowCalls: 0,
  ratingSpreadCopies: 0,
  affiliationTransforms: 0,
  affiliationSortOps: 0,
  participationMapPlayers: 0,
};
const jsonMeasures: PostPrismaJsonMeasure[] = [];

export function isPostPrismaProfileEnabled() {
  return enabled;
}

export function enablePostPrismaProfile(nextRoute: string) {
  enabled = true;
  route = nextRoute;
  startMs = performance.now();
  lastMs = startMs;
  stages.length = 0;
  jsonMeasures.length = 0;
  counters.mapNationalRankingRowCalls = 0;
  counters.ratingSpreadCopies = 0;
  counters.affiliationTransforms = 0;
  counters.affiliationSortOps = 0;
  counters.participationMapPlayers = 0;
}

export function postPrismaMark(name: string, meta?: Record<string, unknown>) {
  if (!enabled) return;
  const now = performance.now();
  stages.push({
    name,
    deltaMs: now - lastMs,
    cumulativeMs: now - startMs,
    meta,
  });
  lastMs = now;
}

export function postPrismaCount<K extends keyof PostPrismaCounters>(key: K, by = 1) {
  if (!enabled) return;
  counters[key] += by;
}

export function measureJsonPayload(label: string, value: unknown): PostPrismaJsonMeasure | null {
  if (!enabled) return null;
  const stringifyStart = performance.now();
  const json = JSON.stringify(value);
  const stringifyMs = performance.now() - stringifyStart;
  const utf8Bytes = Buffer.byteLength(json, "utf8");

  const gzipStart = performance.now();
  const gzipBytes = gzipSync(json).byteLength;
  const gzipMs = performance.now() - gzipStart;

  const brotliStart = performance.now();
  const brotliBytes = brotliCompressSync(json).byteLength;
  const brotliMs = performance.now() - brotliStart;

  const measure: PostPrismaJsonMeasure = {
    label,
    stringifyMs,
    utf8Bytes,
    gzipBytes,
    brotliBytes,
  };
  jsonMeasures.push(measure);
  postPrismaMark(`json.stringify.${label}`, {
    stringifyMs,
    gzipMs,
    brotliMs,
    utf8Bytes: measure.utf8Bytes,
    gzipBytes: measure.gzipBytes,
    brotliBytes: measure.brotliBytes,
  });
  return measure;
}

type GraphStats = {
  nodeCount: number;
  maxDepth: number;
};

function walkObjectGraph(value: unknown, seen: WeakSet<object>, depth: number, stats: GraphStats) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value as object)) return;
  seen.add(value as object);
  stats.nodeCount += 1;
  stats.maxDepth = Math.max(stats.maxDepth, depth);

  if (Array.isArray(value)) {
    for (const item of value) walkObjectGraph(item, seen, depth + 1, stats);
    return;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    walkObjectGraph(child, seen, depth + 1, stats);
  }
}

function analyzeRankingObjectGraph(rankings: unknown) {
  const stats: GraphStats = { nodeCount: 0, maxDepth: 0 };
  walkObjectGraph(rankings, new WeakSet(), 0, stats);

  const playerIds = new Set<string>();
  const slugs: string[] = [];
  const snapshotsByAge = (rankings as { snapshotsByAge?: Record<string, { boys: { rows: Array<{ playerId: string; slug: string }> }; girls: { rows: Array<{ playerId: string; slug: string }> } }> })
    .snapshotsByAge;

  if (snapshotsByAge) {
    for (const board of Object.values(snapshotsByAge)) {
      for (const row of [...board.boys.rows, ...board.girls.rows]) {
        playerIds.add(row.playerId);
        slugs.push(row.slug);
      }
    }
  }

  const slugCounts = slugs.reduce<Record<string, number>>((acc, slug) => {
    acc[slug] = (acc[slug] ?? 0) + 1;
    return acc;
  }, {});
  const duplicateSlugCount = Object.values(slugCounts).filter((count) => count > 1).length;

  return {
    nodeCount: stats.nodeCount,
    maxDepth: stats.maxDepth,
    uniquePlayerIds: playerIds.size,
    duplicateSlugCount,
  };
}

export function buildPostPrismaReport(extra?: {
  rankings?: unknown;
  route?: string;
}): PostPrismaReport {
  const now = performance.now();
  const report: PostPrismaReport = {
    route: extra?.route ?? route,
    generatedAt: new Date().toISOString(),
    totalMs: now - startMs,
    stages: [...stages],
    counters: { ...counters },
    jsonMeasures: [...jsonMeasures],
  };

  if (extra?.rankings) {
    report.objectGraph = analyzeRankingObjectGraph(extra.rankings);
    postPrismaMark("analyze.objectGraph", report.objectGraph);
  }

  return report;
}

export function writePostPrismaReport(report: PostPrismaReport, fileName: string) {
  const dir = path.join(process.cwd(), ".cursor", "post-prisma-profile");
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");
  return filePath;
}
