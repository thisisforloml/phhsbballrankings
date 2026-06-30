/**
 * Benchmark resolvePlayerIdBySlug: full-table scan vs indexed profileSlug lookup.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/benchmark-player-profile-slug-resolve.ts [slug]
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

async function pickSlug(cliSlug?: string) {
  if (cliSlug) return cliSlug;
  const { prisma } = await import("../src/lib/prisma");
  const player = await prisma.player.findFirst({
    where: { deletedAt: null, profileSlug: { not: null } },
    select: { profileSlug: true, displayName: true },
    orderBy: { gameStats: { _count: "desc" } },
  });
  await prisma.$disconnect();
  if (!player?.profileSlug) throw new Error("No indexed profile slug found — run migration backfill first.");
  return player.profileSlug;
}

async function countPlayers() {
  const { prisma } = await import("../src/lib/prisma");
  const [total, indexed] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.player.count({ where: { deletedAt: null, profileSlug: { not: null } } }),
  ]);
  return { total, indexed };
}

async function main() {
  loadDotEnv();
  const slug = await pickSlug(process.argv[2]);
  const counts = await countPlayers();

  const collector = { events: [] as Array<{ model: string; operation: string }>, reset() { this.events = []; } };
  const { prisma } = await import("../src/lib/prisma");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (event: { target: string }) => {
    const match = event.target.match(/^prisma\.(\w+)\.(\w+)/);
    collector.events.push({ model: match?.[1] ?? "unknown", operation: match?.[2] ?? "unknown" });
  });

  const { resolvePlayerIdBySlugUncachedScan, resolvePlayerIdBySlug } = await import("../src/lib/player-profile-slug");

  collector.reset();
  const beforeT0 = performance.now();
  const beforeId = await resolvePlayerIdBySlugUncachedScan(slug);
  const beforeMs = Math.round(performance.now() - beforeT0);
  const beforeQueries = collector.events.length;

  collector.reset();
  const afterT0 = performance.now();
  const afterId = await resolvePlayerIdBySlug(slug);
  const afterMs = Math.round(performance.now() - afterT0);
  const afterQueries = collector.events.length;

  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");

  collector.reset();
  const loaderT0 = performance.now();
  const profile = await loadPlayerProfileBySlugUncached(slug);
  const loaderMs = Math.round(performance.now() - loaderT0);
  const loaderQueries = collector.events.length;

  const report = {
    generatedAt: new Date().toISOString(),
    slug,
    playerCounts: counts,
    idsMatch: beforeId === afterId,
    beforeId,
    afterId,
    slugResolve: {
      before: {
        strategy: "Player.findMany all non-deleted players + JS slugify filter",
        ms: beforeMs,
        prismaQueryCount: beforeQueries,
      },
      after: {
        strategy: "Player.findFirst by profileSlug (+ legacy fallback for null profileSlug)",
        ms: afterMs,
        prismaQueryCount: afterQueries,
      },
      delta: {
        msSaved: beforeMs - afterMs,
        pctFaster: beforeMs ? Math.round(((beforeMs - afterMs) / beforeMs) * 100) : 0,
        prismaQueriesSaved: beforeQueries - afterQueries,
      },
    },
    fullProfileLoader: {
      ms: loaderMs,
      prismaQueryCount: loaderQueries,
      found: Boolean(profile),
    },
    priorInvestigation: {
      slugResolveMs: 619,
      source: "metadata loader trace jude-eriobu pre-Phase-2",
    },
  };

  const outDir = path.join(process.cwd(), ".cursor", "player-profile-slug-benchmark");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();

  if (!report.idsMatch) {
    console.error("Slug resolve ID mismatch between legacy and indexed paths.");
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
