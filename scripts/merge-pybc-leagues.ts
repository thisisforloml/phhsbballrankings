/**
 * Consolidate fragmented PYBC leagues into one league per age bracket.
 * - 15U (U16): PYBC 15U + Philippine Youth Basketball Championship - 15U + PYBC U16 Boys Basketball
 * - 13U (U13): standardize naming on Philippine Youth Basketball Championship – 13U
 *
 * Dry-run by default. Pass --apply to execute.
 */
import { AgeGroup } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  buildTargetSeasonSpecs,
  executeLeagueMerge,
  loadLeagueSeasons,
  reportMergePlan,
  verifyCanonicalLeague
} from "./lib/league-merge-core";

const apply = process.argv.includes("--apply");

const PYBC_15U_CANONICAL = "Philippine Youth Basketball Championship – 15U";
const PYBC_13U_CANONICAL = "Philippine Youth Basketball Championship – 13U";

const PYBC_15U_SOURCE_IDS = [
  "02726bac-c93c-4060-b23a-527d10da6184", // PYBC 15U
  "912ffef7-6e22-48a7-9551-51f0f46a8ac8", // Philippine Youth Basketball Championship - 15U
  "8e5d3eeb-405e-4084-bc62-61637560db19" // PYBC U16 Boys Basketball
];

const PYBC_13U_SOURCE_IDS = ["87e9d0c6-d5d4-41f5-9d1c-e495cd16baad"];

function canonicalSeasonName(_leagueName: string, _seasonName: string) {
  return "Season 2025";
}

function canonical13uSeasonName(_leagueName: string, seasonName: string) {
  return seasonName.trim() || "Season 2025";
}

async function renameCanonical13uLeague() {
  const league = await prisma.league.findFirst({
    where: { id: PYBC_13U_SOURCE_IDS[0], deletedAt: null }
  });
  if (!league || league.name === PYBC_13U_CANONICAL) return;

  await prisma.league.update({
    where: { id: league.id },
    data: {
      name: PYBC_13U_CANONICAL,
      adminNotes: [league.adminNotes, `Renamed from "${league.name}" on ${new Date().toISOString().slice(0, 10)}`]
        .filter(Boolean)
        .join("\n")
    }
  });
  console.log(`Renamed 13U league to ${PYBC_13U_CANONICAL}`);
}

async function main() {
  const sources15u = await loadLeagueSeasons(PYBC_15U_SOURCE_IDS);
  const sources13u = await loadLeagueSeasons(PYBC_13U_SOURCE_IDS);

  if (!sources15u.length && !sources13u.length) {
    console.log("No PYBC leagues found to merge.");
    return;
  }

  if (sources15u.length) {
    const targets15u = buildTargetSeasonSpecs(sources15u, canonicalSeasonName);
    const plan15u = {
      canonicalLeagueName: PYBC_15U_CANONICAL,
      ageGroup: AgeGroup.U16,
      sources: sources15u,
      targets: targets15u
    };
    reportMergePlan(plan15u, "PYBC 15U league consolidation");

    if (apply) {
      await executeLeagueMerge(plan15u);
      await verifyCanonicalLeague(PYBC_15U_CANONICAL);
    }
  }

  if (sources13u.length) {
    console.log("\n=== PYBC 13U league ===\n");
    console.log(`Canonical league: ${PYBC_13U_CANONICAL} (U13)`);
    console.log(`Source: ${sources13u[0].leagueName} — ${sources13u[0].gameCount} games`);
    console.log("No fragment merge needed; standardizing league name only.");

    if (apply) {
      await renameCanonical13uLeague();
      await verifyCanonicalLeague(PYBC_13U_CANONICAL);
    }
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to execute.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
