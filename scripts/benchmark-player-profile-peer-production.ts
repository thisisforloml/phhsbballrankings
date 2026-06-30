/**
 * Benchmark loadPeerProduction legacy (nested Prisma) vs aggregated SQL.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-player-profile-peer-production.ts [ageGroup] [gender]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { AgeGroup } from "@prisma/client";

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
  model: string;
  operation: string;
  durationMs: number;
};

function createQueryCollector() {
  const events: QueryEvent[] = [];
  return {
    events,
    reset: () => {
      events.length = 0;
    },
    onQuery: (event: { duration: number; target: string }) => {
      const match = event.target.match(/^prisma\.(\w+)\.(\w+)/);
      events.push({
        model: match?.[1] ?? "unknown",
        operation: match?.[2] ?? "unknown",
        durationMs: Math.round(event.duration * 100) / 100,
      });
    },
    count: () => events.length,
    totalMs: () => Math.round(events.reduce((sum, event) => sum + event.durationMs, 0)),
  };
}

function parseAgeGroup(value?: string): AgeGroup {
  const normalized = (value ?? "U19").toUpperCase();
  if (normalized in AgeGroup) return AgeGroup[normalized as keyof typeof AgeGroup];
  throw new Error(`Unknown age group: ${value}`);
}

function parseGender(value?: string): "BOYS" | "GIRLS" {
  const normalized = (value ?? "BOYS").toUpperCase();
  if (normalized === "BOYS" || normalized === "GIRLS") return normalized;
  throw new Error(`Unknown gender: ${value}`);
}

async function benchmarkLegacy(
  ageGroup: AgeGroup,
  gender: "BOYS" | "GIRLS",
  collector: ReturnType<typeof createQueryCollector>
) {
  const { loadPeerProductionLegacy } = await import("../src/lib/player-profile-peer-production");
  const { prisma } = await import("../src/lib/prisma");
  const { getActivePolicyVersionId } = await import("../src/lib/ratings/active-formula");

  collector.reset();
  const t0 = performance.now();
  const peers = await loadPeerProductionLegacy(ageGroup, gender);
  const loaderMs = Math.round(performance.now() - t0);

  const policyVersionId = getActivePolicyVersionId();
  const ratingRows = await prisma.playerRating.count({
    where: { policyVersionId, ageGroup, player: { deletedAt: null, gender } },
  });

  const nestedGameStatRows = peers.reduce((sum, peer) => sum + peer.games, 0);

  return {
    strategy: "legacy (playerRating.findMany + nested gameStats)",
    loaderMs,
    prismaQueryCount: collector.count(),
    prismaQueryMs: collector.totalMs(),
    ratingRows,
    nestedGameStatRows,
    peerCount: peers.length,
  };
}

async function benchmarkAggregated(
  ageGroup: AgeGroup,
  gender: "BOYS" | "GIRLS",
  collector: ReturnType<typeof createQueryCollector>
) {
  const { loadPeerProduction } = await import("../src/lib/player-profile-peer-production");

  collector.reset();
  const t0 = performance.now();
  const peers = await loadPeerProduction(ageGroup, gender);
  const loaderMs = Math.round(performance.now() - t0);

  return {
    strategy: "aggregated (single $queryRaw GROUP BY)",
    loaderMs,
    prismaQueryCount: collector.count(),
    prismaQueryMs: collector.totalMs(),
    rowsLoaded: peers.length,
    peerCount: peers.length,
  };
}

async function benchmarkFullProfileLoader(slug: string, collector: ReturnType<typeof createQueryCollector>) {
  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");

  collector.reset();
  const t0 = performance.now();
  const profile = await loadPlayerProfileBySlugUncached(slug);
  const loaderMs = Math.round(performance.now() - t0);

  return {
    slug,
    loaderMs,
    prismaQueryCount: collector.count(),
    prismaQueryMs: collector.totalMs(),
    comparisonCount: profile?.intelligence.comparisonCount ?? null,
    gamesPlayed: profile?.gamesPlayed ?? null,
  };
}

async function main() {
  loadDotEnv();
  const ageGroup = parseAgeGroup(process.argv[2]);
  const gender = parseGender(process.argv[3]);
  const slug = process.argv[4] ?? "jude-eriobu";
  const collector = createQueryCollector();

  const { prisma } = await import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (event: { duration: number; target: string }) => collector.onQuery(event));

  const before = await benchmarkLegacy(ageGroup, gender, collector);
  const after = await benchmarkAggregated(ageGroup, gender, collector);
  const fullProfile = await benchmarkFullProfileLoader(slug, collector);

  const report = {
    generatedAt: new Date().toISOString(),
    ageGroup,
    gender,
    before,
    after,
    delta: {
      loaderMsSaved: before.loaderMs - after.loaderMs,
      loaderPctFaster: before.loaderMs
        ? Math.round(((before.loaderMs - after.loaderMs) / before.loaderMs) * 100)
        : 0,
      nestedGameStatRowsEliminated: before.nestedGameStatRows - after.rowsLoaded,
      prismaQueriesSaved: before.prismaQueryCount - after.prismaQueryCount,
    },
    fullProfileLoader: fullProfile,
  };

  const outDir = path.join(process.cwd(), ".cursor", "player-profile-peer-production-benchmark");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
