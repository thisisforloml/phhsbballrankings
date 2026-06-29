/**
 * Merge Stallion Cup Teens 17u edition leagues (3rd–5th) into one canonical league.
 * Excludes 18U / Jumbo Plastic — separate bracket.
 * Dry-run by default. Pass --apply to execute.
 */
import { AgeGroup } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { resolveCanonicalLeagueImport } from "../src/lib/league-canonical-naming";
import {
  buildTargetSeasonSpecs,
  executeLeagueMerge,
  loadLeagueSeasons,
  reportMergePlan,
  verifyCanonicalLeague,
  type SourceSeason
} from "./lib/league-merge-core";

const CANONICAL_LEAGUE_NAME = "Stallion Cup – Teens 17u";
const EDITION_STALLION_17U_PATTERN = /^(\d+(?:st|nd|rd|th))\s+stallion\s+cup\s*[–-]\s*teens\s*17u$/i;
const EXCLUDED_STALLION_PATTERN = /jumbo\s+plastic|18u/i;
const apply = process.argv.includes("--apply");

function fifthEditionSeasonName(sourceSeasonName: string) {
  if (/2025/i.test(sourceSeasonName)) {
    return "5th Edition — Season 2026";
  }
  return resolveCanonicalLeagueImport({ leagueName: "5th Stallion Cup – Teens 17u", seasonName: sourceSeasonName }).seasonName;
}

function targetSeasonNameForSource(leagueName: string, seasonName: string) {
  if (/^5th stallion cup/i.test(leagueName)) {
    return fifthEditionSeasonName(seasonName);
  }
  return resolveCanonicalLeagueImport({ leagueName, seasonName }).seasonName;
}

async function loadSourceSeasons(): Promise<SourceSeason[]> {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null, name: { contains: "Stallion", mode: "insensitive" } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: { _count: { select: { games: { where: { deletedAt: null } } } } }
      }
    },
    orderBy: { name: "asc" }
  });

  const editionLeagues = leagues.filter(
    (league) =>
      EDITION_STALLION_17U_PATTERN.test(league.name.trim()) &&
      !EXCLUDED_STALLION_PATTERN.test(league.name) &&
      league.name !== CANONICAL_LEAGUE_NAME
  );

  const rows: SourceSeason[] = [];
  for (const league of editionLeagues) {
    for (const season of league.seasons) {
      rows.push({
        id: season.id,
        name: season.name,
        seasonYear: season.seasonYear,
        status: season.status,
        startsOn: season.startsOn,
        endsOn: season.endsOn,
        leagueId: league.id,
        leagueName: league.name,
        gameCount: season._count.games
      });
    }
  }
  return rows;
}

async function main() {
  const sources = await loadSourceSeasons();
  if (!sources.length) {
    console.log("No Stallion edition leagues found to merge.");
    return;
  }

  const targets = buildTargetSeasonSpecs(sources, targetSeasonNameForSource);
  const plan = {
    canonicalLeagueName: CANONICAL_LEAGUE_NAME,
    ageGroup: AgeGroup.U19,
    sources,
    targets
  };

  reportMergePlan(plan, "Stallion Cup league merge");
  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to execute merge.");
    return;
  }

  await executeLeagueMerge(plan);
  await verifyCanonicalLeague(CANONICAL_LEAGUE_NAME);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
