/**
 * Read-only investigation: /players/[slug] loader waterfall.
 * Usage: npx tsx --tsconfig tsconfig.scripts.json .cursor/profile-route-investigation.ts [slug]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { AgeGroup, PlayerGender, PrismaClient, RankingScope } from "@prisma/client";
import { slugify } from "../src/lib/format";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";
import { getMonthStart } from "../src/lib/ranking-eligibility";
import { getActivePolicyVersionId } from "../src/lib/ratings/active-formula";
import { selectPublicPlayerRating } from "../src/lib/ratings/resolve-public-player-rating";
import { buildEligibilityInput, evaluateEligibility } from "../src/lib/eligibility";
import { buildCompetitionParticipationFromStats } from "../src/lib/player-competition-context";
import {
  buildBestGame,
  buildGameHighs,
  buildLeagueHistoryFromStats,
  buildProfileAverages,
  buildProfileShooting,
  buildRankingTrend,
  buildRecentForm,
  mapFullGameStat,
} from "../src/lib/player-profile-build";
import { buildProfileIntelligence } from "../src/lib/player-profile-intelligence";

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

type PrismaQueryEvent = {
  model: string;
  operation: string;
  durationMs: number;
  startedAtMs: number;
  target: string;
  rowEstimate: number | null;
};

type PhaseMark = {
  phase: string;
  startedAtMs: number;
  durationMs: number;
  meta?: Record<string, unknown>;
};

const formulaVersionNumber = 1;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tierLabel(tier: number) {
  if (tier >= 4) return "Elite" as const;
  if (tier === 3) return "Competitive" as const;
  if (tier === 2) return "Developmental" as const;
  return "Entry" as const;
}

function attachQueryLogger(prisma: PrismaClient, origin: number, bucket: PrismaQueryEvent[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (event: { duration: number; target: string }) => {
    const target = event.target;
    const match = target.match(/^prisma\.(\w+)\.(\w+)/);
    bucket.push({
      model: match?.[1] ?? "unknown",
      operation: match?.[2] ?? "unknown",
      durationMs: Math.round(event.duration * 100) / 100,
      startedAtMs: Math.round(performance.now() - origin - event.duration),
      target,
      rowEstimate: null,
    });
  });
}

async function pickInvestigationSlug(cliSlug?: string) {
  if (cliSlug) return { slug: cliSlug, note: "cli" };
  const probe = new PrismaClient();
  const heaviest = await probe.player.findFirst({
    where: { deletedAt: null },
    select: { displayName: true, _count: { select: { gameStats: true } } },
    orderBy: { gameStats: { _count: "desc" } },
  });
  await probe.$disconnect();
  if (!heaviest) throw new Error("No players");
  return {
    slug: slugify(heaviest.displayName),
    note: `heaviest sample (${heaviest._count.gameStats} gameStats): ${heaviest.displayName}`,
  };
}

async function traceSingleProfileLoad(prisma: PrismaClient, slug: string, label: string) {
  const origin = performance.now();
  const queries: PrismaQueryEvent[] = [];
  const phases: PhaseMark[] = [];

  attachQueryLogger(prisma, origin, queries);

  function mark(phase: string, start: number, meta?: Record<string, unknown>) {
    phases.push({ phase, startedAtMs: Math.round(start - origin), durationMs: Math.round(performance.now() - start), meta });
  }

  const totalStart = performance.now();

  // --- resolvePlayerIdBySlug ---
  let step = performance.now();
  let playerId: string | null = null;
  if (uuidPattern.test(slug)) {
    const exact = await prisma.player.findFirst({ where: { id: slug, deletedAt: null }, select: { id: true } });
    if (exact) playerId = exact.id;
  }
  if (!playerId) {
    const candidates = await prisma.player.findMany({
      where: { deletedAt: null },
      select: { id: true, displayName: true },
    });
    const matches = candidates.filter((p) => slugify(p.displayName) === slug);
    playerId = matches.length === 1 ? matches[0].id : null;
  }
  mark("resolvePlayerIdBySlug", step, { playerId, slugScanCandidates: playerId ? undefined : "all players" });

  if (!playerId) {
    return { label, found: false, totalMs: Math.round(performance.now() - totalStart), phases, queries };
  }

  // --- loadPlayerById ---
  step = performance.now();
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    include: {
      currentProgram: true,
      currentRatings: { where: { policyVersionId: getActivePolicyVersionId() } },
      rankingRows: {
        where: {
          snapshot: {
            scope: RankingScope.NATIONAL,
            formulaVersion: { versionNumber: formulaVersionNumber },
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
            some: { formulaVersion: { versionNumber: formulaVersionNumber }, deletedAt: null },
          },
        },
        include: {
          team: { include: { program: true } },
          performanceScores: {
            where: { formulaVersion: { versionNumber: formulaVersionNumber }, deletedAt: null },
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
  mark("loadPlayerById (deep include)", step, {
    gameStats: player?.gameStats.length ?? 0,
    rankingRows: player?.rankingRows.length ?? 0,
    currentRatings: player?.currentRatings.length ?? 0,
  });

  if (!player) {
    return { label, found: false, totalMs: Math.round(performance.now() - totalStart), phases, queries };
  }

  // --- select rating / snapshot row ---
  step = performance.now();
  const rating = selectPublicPlayerRating(player);
  const profileAgeGroup = rating?.ageGroup ?? player.gameStats[0]?.game.season.league.ageGroup ?? AgeGroup.U19;
  const displayAgeGroup = (player.ageGroupOverride || profileAgeGroup) as AgeGroup;
  const matchingRows = player.rankingRows.filter(
    (row) =>
      row.snapshot.gender === player.gender &&
      row.snapshot.ageGroup === profileAgeGroup &&
      row.snapshot.weekOf.getTime() === getMonthStart(row.snapshot.weekOf).getTime()
  );
  matchingRows.sort((a, b) => b.snapshot.weekOf.getTime() - a.snapshot.weekOf.getTime());
  const snapshotRow = matchingRows[0] ?? null;
  mark("selectRatingAndSnapshotRow (CPU)", step);

  // --- deriveSnapshotRanks ---
  step = performance.now();
  let regionRank: number | null = null;
  let positionRank: number | null = null;
  let snapshotRowsLoaded = 0;
  if (snapshotRow?.snapshot.weekOf) {
    const snapshot = await prisma.rankingSnapshot.findFirst({
      where: {
        scope: RankingScope.NATIONAL,
        ageGroup: profileAgeGroup,
        gender: player.gender,
        formulaVersion: { versionNumber: formulaVersionNumber },
        city: null,
        region: null,
        weekOf: snapshotRow.snapshot.weekOf,
      },
      include: {
        rows: {
          include: { player: { select: { id: true, region: true, position: true, deletedAt: true } } },
          orderBy: { rank: "asc" },
        },
      },
    });
    snapshotRowsLoaded = snapshot?.rows.length ?? 0;
    if (snapshot) {
      const region = player.region?.trim().toLowerCase();
      const position = player.position?.trim().toUpperCase().replace(/[^A-Z0-9/ -]/g, "").replace(/\s+/g, " ") || null;
      const regionRows = region
        ? snapshot.rows.filter((r) => r.player.deletedAt === null && r.player.region?.trim().toLowerCase() === region)
        : [];
      const positionRows = position
        ? snapshot.rows.filter((r) => r.player.deletedAt === null && (r.player.position?.trim().toUpperCase().replace(/[^A-Z0-9/ -]/g, "").replace(/\s+/g, " ") || null) === position)
        : [];
      regionRank = regionRows.findIndex((r) => r.playerId === player.id);
      positionRank = positionRows.findIndex((r) => r.playerId === player.id);
      regionRank = regionRank >= 0 ? regionRank + 1 : null;
      positionRank = positionRank >= 0 ? positionRank + 1 : null;
    }
  }
  mark("deriveSnapshotRanks", step, { snapshotRowsLoaded, regionRank, positionRank });

  // --- map games + aggregations ---
  step = performance.now();
  const games = player.gameStats.map((stat) => {
    const isHome = stat.teamId === stat.game.homeTeamId;
    const teamScore = isHome ? stat.game.homeScore : stat.game.awayScore;
    const opponentScore = isHome ? stat.game.awayScore : stat.game.homeScore;
    const opponentName = getUaapSchoolDisplayName(isHome ? stat.game.awayTeam.name : stat.game.homeTeam.name);
    const teamName = getUaapSchoolDisplayName(stat.team.name);
    return mapFullGameStat(stat, opponentName, teamScore, opponentScore, teamName);
  });
  const averages = buildProfileAverages(games);
  const recentFiveAverages = games.length ? buildProfileAverages(games.slice(0, 5)) : null;
  const shooting = buildProfileShooting(games);
  const leagues = buildLeagueHistoryFromStats(player.gameStats, tierLabel);
  const gameHighs = buildGameHighs(games);
  const bestGame = buildBestGame(games);
  const recentForm = buildRecentForm(games, averages);
  const rankingTrend = buildRankingTrend(player.rankingRows, profileAgeGroup, player.gender);
  const competitionParticipation = buildCompetitionParticipationFromStats(player.gameStats);
  mark("mapGamesAndAggregations (CPU)", step, {
    games: games.length,
    leagues: leagues.length,
    rankingTrendPoints: rankingTrend.length,
  });

  // --- eligibility ---
  step = performance.now();
  const verifiedGameCount = rating?.verifiedGameCount ?? games.length;
  const eligibilityVerdict = evaluateEligibility(
    buildEligibilityInput({
      playerId: player.id,
      gender: player.gender,
      birthDate: player.birthDate,
      firstRankingEligibilityAt: player.firstRankingEligibilityAt,
      classYearOverride: player.classYearOverride,
      ageGroupOverride: player.ageGroupOverride,
      ratingAgeGroup: profileAgeGroup,
      verifiedGameCount,
      evaluatedBoard: displayAgeGroup,
      formulaVersionId: getActivePolicyVersionId(),
    })
  );
  mark("eligibilityVerdict (CPU)", step);

  // --- buildProfileIntelligence (includes loadPeerProduction) ---
  step = performance.now();
  const intelligence = await buildProfileIntelligence({
    ageGroup: displayAgeGroup,
    gender: player.gender,
    games,
    leagues,
    averages,
    shooting,
    gameStats: player.gameStats,
  });
  mark("buildProfileIntelligence", step, {
    comparisonCount: intelligence.comparisonCount,
    percentiles: intelligence.percentiles.length,
  });

  // --- assemble profile object ---
  step = performance.now();
  const profile = {
    id: player.id,
    slug: slugify(player.displayName),
    displayName: player.displayName,
    allGames: games,
    latestFiveGames: games.slice(0, 5),
    leagues,
    competitionParticipation,
    averages,
    recentFiveAverages,
    shooting,
    advancedMetrics: [],
    gameHighs,
    bestGame,
    roleIndicators: [],
    intelligence,
    recentForm,
    rankingTrend,
    eligibilityVerdict,
    nationalRank: snapshotRow?.rank ?? null,
    regionRank,
    positionRank,
    gamesPlayed: games.length,
    ageGroup: displayAgeGroup,
    gender: player.gender,
  };
  mark("assembleProfileObject (CPU)", step);

  // --- JSON serialize (RSC prop pass proxy) ---
  step = performance.now();
  const json = JSON.stringify(profile);
  const jsonBytes = Buffer.byteLength(json, "utf8");
  mark("JSON.stringify profile (RSC payload proxy)", step, { jsonBytes });

  const totalMs = Math.round(performance.now() - totalStart);
  const prismaMs = Math.round(queries.reduce((s, q) => s + q.durationMs, 0));

  return {
    label,
    found: true,
    totalMs,
    prismaMs,
    postPrismaMs: Math.max(0, totalMs - prismaMs),
    phases,
    queries,
    jsonBytes,
    stats: {
      gameStats: player.gameStats.length,
      rankingRows: player.rankingRows.length,
      snapshotRowsLoaded,
      intelligencePeers: intelligence.comparisonCount,
      ageGroup: displayAgeGroup,
      gender: player.gender,
    },
  };
}

function duplicateQueryAnalysis(runs: Array<{ queries: PrismaQueryEvent[] }>) {
  const all = runs.flatMap((r) => r.queries);
  const sigs = all.map((q) => `${q.model}.${q.operation}`);
  const counts = new Map<string, number>();
  for (const s of sigs) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([signature, count]) => ({ signature, count }))
    .sort((a, b) => b.count - a.count);
}

function buildWaterfall(phases: PhaseMark[], totalMs: number) {
  const prismaPhases = new Set([
    "resolvePlayerIdBySlug",
    "loadPlayerById (deep include)",
    "deriveSnapshotRanks",
    "buildProfileIntelligence",
  ]);
  let prismaBucket = 0;
  let cpuBucket = 0;
  for (const p of phases) {
    if (prismaPhases.has(p.phase)) prismaBucket += p.durationMs;
    else cpuBucket += p.durationMs;
  }
  return {
    totalMs,
    buckets: [
      { label: "Inside Prisma (query phases)", ms: prismaBucket, pct: totalMs ? Math.round((prismaBucket / totalMs) * 100) : 0 },
      { label: "After Prisma (CPU transforms + JSON)", ms: cpuBucket, pct: totalMs ? Math.round((cpuBucket / totalMs) * 100) : 0 },
    ],
    phases: phases.map((p) => ({
      ...p,
      pctOfTotal: totalMs ? Math.round((p.durationMs / totalMs) * 100) : 0,
    })),
  };
}

async function maybeHttpTtfb(baseUrl: string, slug: string) {
  const url = `${baseUrl.replace(/\/$/, "")}/players/${encodeURIComponent(slug)}`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { "Cache-Control": "no-cache", "Accept-Encoding": "identity" } });
    const ttfbMs = Math.round(performance.now() - t0);
    const body = Buffer.from(await res.arrayBuffer());
    return { url, status: res.status, ttfbMs, bytes: body.length, timedOut: false };
  } catch (error) {
    return {
      url,
      status: null,
      ttfbMs: Math.round(performance.now() - t0),
      bytes: 0,
      timedOut: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  loadDotEnv();
  const { slug, note: slugNote } = await pickInvestigationSlug(process.argv[2]);
  const httpBase = process.argv.includes("--http") ? process.argv[process.argv.indexOf("--http") + 1] : null;

  const prisma = new PrismaClient();
  const metadataRun = await traceSingleProfileLoad(prisma, slug, "generateMetadata");
  const pageRun = await traceSingleProfileLoad(prisma, slug, "PlayerProfilePage");

  const pageTotalMs = metadataRun.totalMs + pageRun.totalMs;
  const allQueries = [...metadataRun.queries, ...pageRun.queries];

  const report = {
    generatedAt: new Date().toISOString(),
    route: "/players/[slug]",
    slug,
    slugNote,
    timeoutAnalysis: {
      verdict:
        pageTotalMs > 55000
          ? "Likely exceeds typical 60s platform timeout — dominated by Prisma if prismaMs > 80% of total"
          : pageTotalMs > 10000
            ? "Slow but may not timeout locally; production timeout risk if Prisma peer/snapshot queries scale"
            : "Within local tolerance; production slowness may be DB latency or duplicate full loads",
      whereTimeIsSpent:
        metadataRun.prismaMs! + pageRun.prismaMs! > pageTotalMs * 0.7
          ? "inside Prisma"
          : "split Prisma + post-Prisma CPU",
      rscRenderingNote:
        "This script measures server loader + JSON serialization only. Client chart components (PlayerTrendsChart etc.) fetch /api/players/[slug]/profile separately after hydration — not included in initial RSC TTFB unless measured via --http.",
    },
    pageSimulation: {
      duplicateCalls: "generateMetadata + PlayerProfilePage each call getPlayerProfileBySlug independently (no cache)",
      metadataLoaderMs: metadataRun.totalMs,
      pageLoaderMs: pageRun.totalMs,
      combinedLoaderMs: pageTotalMs,
      combinedPrismaMs: (metadataRun.prismaMs ?? 0) + (pageRun.prismaMs ?? 0),
      combinedPostPrismaMs: (metadataRun.postPrismaMs ?? 0) + (pageRun.postPrismaMs ?? 0),
      combinedJsonBytes: (metadataRun.jsonBytes ?? 0) + (pageRun.jsonBytes ?? 0),
      prismaQueryCount: allQueries.length,
    },
    metadataWaterfall: buildWaterfall(metadataRun.phases, metadataRun.totalMs),
    pageWaterfall: buildWaterfall(pageRun.phases, pageRun.totalMs),
    childLoaders: {
      metadata: metadataRun.phases,
      page: pageRun.phases,
    },
    prismaQueries: {
      metadata: metadataRun.queries,
      page: pageRun.queries,
      combinedCount: allQueries.length,
      byModel: summarizeByModel(allQueries),
    },
    duplicateQueries: duplicateQueryAnalysis([metadataRun, pageRun]),
    nPlusOneSignals: [
      {
        pattern: "resolvePlayerIdBySlug loads ALL players when slug is not a UUID",
        evidence: "Player.findMany { deletedAt: null } with displayName-only select, slugify filter in JS",
        severity: "high",
      },
      {
        pattern: "deriveSnapshotRanks loads full national snapshot row set",
        evidence: "RankingSnapshot.findFirst include all rows + nested player region/position",
        severity: "high",
      },
      {
        pattern: "loadPeerProduction loads entire age-group rating pool with nested gameStats per player",
        evidence: "PlayerRating.findMany for ageGroup with player.gameStats nested select",
        severity: "critical",
      },
      {
        pattern: "Full page calls getPlayerProfileBySlug twice (metadata + RSC page)",
        evidence: "page.tsx generateMetadata + default export",
        severity: "high",
      },
    ],
    profileStats: pageRun.stats,
    http: httpBase ? await maybeHttpTtfb(httpBase, slug) : null,
  };

  const outDir = path.join(process.cwd(), ".cursor", "player-profile-investigation");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();
}

function summarizeByModel(queries: PrismaQueryEvent[]) {
  const map = new Map<string, { count: number; totalMs: number }>();
  for (const q of queries) {
    const key = `${q.model}.${q.operation}`;
    const prev = map.get(key) ?? { count: 0, totalMs: 0 };
    prev.count += 1;
    prev.totalMs += q.durationMs;
    map.set(key, prev);
  }
  return [...map.entries()]
    .map(([signature, v]) => ({ signature, ...v, totalMs: Math.round(v.totalMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
