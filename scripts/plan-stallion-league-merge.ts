/**
 * Dry-run Stallion Cup league consolidation plan (3rd / 4th / 5th → one league).
 * Pass --apply to execute (requires explicit approval — not implemented in dry-run mode).
 */
import { prisma } from "../src/lib/prisma";
import { resolveCanonicalLeagueImport } from "../src/lib/league-canonical-naming";

const STALLION_LEAGUE_PATTERN = /stallion cup.*teens.*17u/i;
const apply = process.argv.includes("--apply");

async function main() {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null, name: { contains: "Stallion", mode: "insensitive" } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          _count: { select: { games: { where: { deletedAt: null } } } }
        },
        orderBy: { seasonYear: "asc" }
      }
    },
    orderBy: { name: "asc" }
  });

  const mergeTargets = leagues.filter((league) => STALLION_LEAGUE_PATTERN.test(league.name) && league.name.match(/^\d+/));

  console.log("=== Stallion Cup consolidation dry-run ===\n");
  console.log(`Leagues matching edition pattern: ${mergeTargets.length}`);

  const canonicalName = "Stallion Cup – Teens 17u";
  let totalGames = 0;

  for (const league of mergeTargets) {
    const canonical = resolveCanonicalLeagueImport({ leagueName: league.name, seasonName: "Season 2026" });
    console.log(`\nSource league: ${league.name} (${league.id})`);
    console.log(`  → Canonical league: ${canonical.leagueName}`);
    console.log(`  → Edition season: ${canonical.seasonName}`);
    for (const season of league.seasons) {
      console.log(`    Season "${season.name}" (${season.id}): ${season._count.games} games`);
      totalGames += season._count.games;
    }
  }

  console.log(`\nTotal games to reparent: ${totalGames}`);
  console.log(`Target league name: ${canonicalName}`);

  const existingCanonical = await prisma.league.findFirst({
    where: { name: canonicalName, deletedAt: null }
  });
  console.log(`Existing canonical league: ${existingCanonical ? existingCanonical.id : "none — will create"}`);

  if (apply) {
    console.log("\n--apply not yet implemented. Review this plan and approve a follow-up migration script.");
    process.exitCode = 1;
    return;
  }

  console.log("\nDry run complete. No data was changed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
