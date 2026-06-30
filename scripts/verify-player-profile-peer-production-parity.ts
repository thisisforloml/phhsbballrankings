/**
 * Verify aggregated loadPeerProduction matches legacy output and full intelligence parity.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/verify-player-profile-peer-production-parity.ts [slug]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { AgeGroup } from "@prisma/client";
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

type PeerProduction = Awaited<
  ReturnType<typeof import("../src/lib/player-profile-peer-production").loadPeerProduction>
>[number];

function peerKey(peer: PeerProduction) {
  return JSON.stringify([
    peer.games,
    peer.ppg,
    peer.rpg,
    peer.apg,
    peer.spg,
    peer.bpg,
    peer.tov,
    peer.mpg,
    peer.boxEfficiency,
    peer.trueShootingPct,
  ]);
}

function sortPeers(peers: PeerProduction[]) {
  return [...peers].sort((left, right) => peerKey(left).localeCompare(peerKey(right)));
}

function peersMatch(legacy: PeerProduction[], aggregated: PeerProduction[]) {
  if (legacy.length !== aggregated.length) {
    return { ok: false, reason: `peer count ${legacy.length} vs ${aggregated.length}` };
  }

  const legacySorted = sortPeers(legacy);
  const aggregatedSorted = sortPeers(aggregated);
  const tolerance = 1e-9;

  for (let index = 0; index < legacySorted.length; index += 1) {
    const left = legacySorted[index];
    const right = aggregatedSorted[index];
    const fields: Array<keyof PeerProduction> = [
      "games",
      "ppg",
      "rpg",
      "apg",
      "spg",
      "bpg",
      "tov",
      "mpg",
      "boxEfficiency",
      "trueShootingPct",
    ];

    for (const field of fields) {
      const leftValue = left[field];
      const rightValue = right[field];
      if (leftValue === null || rightValue === null) {
        if (leftValue !== rightValue) {
          return { ok: false, reason: `peer[${index}].${field}: ${leftValue} vs ${rightValue}` };
        }
        continue;
      }
      if (Math.abs(leftValue - rightValue) > tolerance) {
        return { ok: false, reason: `peer[${index}].${field}: ${leftValue} vs ${rightValue}` };
      }
    }
  }

  return { ok: true, reason: "peer aggregates match" };
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

async function main() {
  loadDotEnv();
  const slug = await pickSlug(process.argv[2]);
  const { prisma } = await import("../src/lib/prisma");
  const { loadPeerProduction, loadPeerProductionLegacy } = await import("../src/lib/player-profile-peer-production");
  const { loadPlayerProfileBySlugUncached } = await import("../src/lib/player-profile");

  const profile = await loadPlayerProfileBySlugUncached(slug);
  if (!profile) throw new Error(`Player not found: ${slug}`);

  const ageGroup = profile.ageGroup as AgeGroup;
  const gender = profile.gender;

  const [legacyPeers, aggregatedPeers] = await Promise.all([
    loadPeerProductionLegacy(ageGroup, gender),
    loadPeerProduction(ageGroup, gender),
  ]);

  const peerParity = peersMatch(legacyPeers, aggregatedPeers);

  const report = {
    slug,
    ageGroup,
    gender,
    peerParity,
    legacyPeerCount: legacyPeers.length,
    aggregatedPeerCount: aggregatedPeers.length,
    intelligenceComparisonCount: profile.intelligence.comparisonCount,
    intelligencePercentiles: profile.intelligence.percentiles.map((item) => ({
      key: item.key,
      percentile: item.percentile,
      value: item.value,
    })),
    roleArchetype: profile.intelligence.roleArchetype,
    strengthBadges: profile.intelligence.strengthBadges,
    benchmarks: profile.intelligence.benchmarks,
    trendAverages: profile.intelligence.trendAverages,
    note: "Peer parity compares legacy vs aggregated loaders. Intelligence fields come from production profile loader using aggregated peers.",
  };

  console.log(JSON.stringify(report, null, 2));

  if (!peerParity.ok) {
    console.error(`PEER PARITY FAILED: ${peerParity.reason}`);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
