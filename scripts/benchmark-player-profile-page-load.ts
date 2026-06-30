/**
 * Benchmark player profile page load: uncached duplicate vs React cache() dedupe.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-player-profile-page-load.ts [slug]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { slugify } from "../src/lib/format";

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

function profileSignature(profile: Awaited<ReturnType<typeof import("../src/lib/player-profile").getPlayerProfileBySlug>>) {
  if (!profile) return null;
  return JSON.stringify({
    id: profile.id,
    slug: profile.slug,
    displayName: profile.displayName,
    nationalRank: profile.nationalRank,
    regionRank: profile.regionRank,
    positionRank: profile.positionRank,
    rating: profile.rating,
    gamesPlayed: profile.gamesPlayed,
    gameCount: profile.allGames.length,
    comparisonCount: profile.intelligence.comparisonCount,
    percentileKeys: profile.intelligence.percentiles.map((p) => [p.key, p.percentile, p.value]),
  });
}

async function pickSlug(cliSlug?: string) {
  if (cliSlug) return cliSlug;
  const { prisma } = await import("../src/lib/prisma");
  const player = await prisma.player.findFirst({
    where: { deletedAt: null },
    select: { displayName: true },
    orderBy: { gameStats: { _count: "desc" } },
  });
  if (!player) throw new Error("No players found");
  return slugify(player.displayName);
}

async function simulateUncachedPageLoad(
  slug: string,
  load: (slug: string) => Promise<import("../src/lib/player-profile-types").PlayerProfile | null>,
  collector: ReturnType<typeof createQueryCollector>
) {
  collector.reset();
  const t0 = performance.now();
  const metadataProfile = await load(slug);
  const metadataMs = Math.round(performance.now() - t0);
  const metadataQueries = collector.count();

  collector.reset();
  const pageT0 = performance.now();
  const pageProfile = await load(slug);
  const pageMs = Math.round(performance.now() - pageT0);
  const pageQueries = collector.count();

  return {
    strategy: "uncached (generateMetadata + page, sequential)",
    metadataLoaderMs: metadataMs,
    pageLoaderMs: pageMs,
    totalLoaderMs: metadataMs + pageMs,
    prismaQueryCount: metadataQueries + pageQueries,
    metadataQueries,
    pageQueries,
    metadataSignature: profileSignature(metadataProfile),
    pageSignature: profileSignature(pageProfile),
  };
}

async function simulateCachedPageLoad(
  slug: string,
  collector: ReturnType<typeof createQueryCollector>
) {
  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");
  const requestCache = new Map<string, Promise<import("../src/lib/player-profile-types").PlayerProfile | null>>();
  const load = (key: string) => {
    if (!requestCache.has(key)) {
      requestCache.set(key, loadPlayerProfileBySlugUncached(key));
    }
    return requestCache.get(key)!;
  };

  collector.reset();
  const t0 = performance.now();
  const metadataProfile = await load(slug);
  const metadataMs = Math.round(performance.now() - t0);
  const metadataQueries = collector.count();

  collector.reset();
  const pageT0 = performance.now();
  const pageProfile = await load(slug);
  const pageMs = Math.round(performance.now() - pageT0);
  const pageQueries = collector.count();

  return {
    strategy: "cached (request-scoped dedupe — matches React cache() in Next.js)",
    metadataLoaderMs: metadataMs,
    pageLoaderMs: pageMs,
    totalLoaderMs: metadataMs + pageMs,
    prismaQueryCount: metadataQueries + pageQueries,
    metadataQueries,
    pageQueries,
    metadataSignature: profileSignature(metadataProfile),
    pageSignature: profileSignature(pageProfile),
  };
}

async function main() {
  loadDotEnv();
  const slug = await pickSlug(process.argv[2]);
  const collector = createQueryCollector();

  const { prisma } = await import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (event: { duration: number; target: string }) => collector.onQuery(event));

  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");

  const before = await simulateUncachedPageLoad(slug, loadPlayerProfileBySlugUncached, collector);
  const after = await simulateCachedPageLoad(slug, collector);

  const outputMatches =
    before.metadataSignature === after.metadataSignature &&
    before.pageSignature === after.pageSignature &&
    before.metadataSignature === before.pageSignature;

  const report = {
    generatedAt: new Date().toISOString(),
    slug,
    note: "Simulates page.tsx: generateMetadata() then page component both call getPlayerProfileBySlug.",
    outputMatches,
    before,
    after,
    delta: {
      loaderMsSaved: before.totalLoaderMs - after.totalLoaderMs,
      loaderPctFaster: before.totalLoaderMs
        ? Math.round(((before.totalLoaderMs - after.totalLoaderMs) / before.totalLoaderMs) * 100)
        : 0,
      prismaQueriesSaved: before.prismaQueryCount - after.prismaQueryCount,
    },
    expectedInNextJs: {
      prismaQueriesPerPageVisitBefore: 10,
      prismaQueriesPerPageVisitAfter: 5,
      note: "5–6 Prisma calls per loader × 2 duplicate loads → ~10–12 before; cache() reduces to one execution.",
    },
    priorInvestigation: {
      combinedLoaderMs: 6044,
      source: ".cursor/player-profile-investigation/summary.json (jude-eriobu, pre-cache)",
    },
  };

  const outDir = path.join(process.cwd(), ".cursor", "player-profile-cache-benchmark");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
