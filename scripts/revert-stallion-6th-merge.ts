/**
 * Revert 6th Stallion Cup merge — restore as separate 18U league.
 * Dry-run by default. Pass --apply to execute.
 */
import { prisma } from "../src/lib/prisma";

const SIXTH_LEAGUE_ID = "8a446be5-fab1-4f60-9bb1-28f05f766f94";
const SIXTH_LEAGUE_NAME = "6th Stallion Cup Teens – Jumbo Plastic Conference 18u";
const ORIGINAL_SEASON_ID = "5a9fbea3-ca68-4d65-9e84-dd03cdfa572a";
const MERGED_SEASON_ID = "64eae82c-b05c-472f-b31d-f8b9af1ab74a";
const CANONICAL_LEAGUE_ID = "97522351-bfe3-47fb-9bb5-0ec66e32fb42";

const apply = process.argv.includes("--apply");

async function main() {
  const [sixthLeague, originalSeason, mergedSeason] = await Promise.all([
    prisma.league.findUnique({ where: { id: SIXTH_LEAGUE_ID } }),
    prisma.season.findUnique({ where: { id: ORIGINAL_SEASON_ID } }),
    prisma.season.findUnique({
      where: { id: MERGED_SEASON_ID },
      include: { _count: { select: { games: { where: { deletedAt: null } } } } }
    })
  ]);

  console.log("=== Revert 6th Stallion Cup merge ===\n");
  console.log(`6th league: ${sixthLeague?.name ?? "missing"} (deleted: ${sixthLeague?.deletedAt ? "yes" : "no"})`);
  console.log(`Original season: ${originalSeason?.name ?? "missing"} (deleted: ${originalSeason?.deletedAt ? "yes" : "no"})`);
  console.log(
    `Merged season: ${mergedSeason?.name ?? "missing"} — ${mergedSeason?._count.games ?? 0} games (deleted: ${mergedSeason?.deletedAt ? "yes" : "no"})`
  );

  const gamesOnMerged = await prisma.game.count({
    where: { seasonId: MERGED_SEASON_ID, deletedAt: null }
  });
  const rostersOnMerged = await prisma.playerTeamSeason.count({
    where: { seasonId: MERGED_SEASON_ID, deletedAt: null }
  });
  const ratingsOnMerged = await prisma.teamRating.count({
    where: { seasonId: MERGED_SEASON_ID }
  });

  console.log(`\nTo reparent: ${gamesOnMerged} games, ${rostersOnMerged} rosters, ${ratingsOnMerged} team ratings`);
  console.log(`Target: restore ${SIXTH_LEAGUE_NAME} / Season 2026`);

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to execute revert.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.league.update({
      where: { id: SIXTH_LEAGUE_ID },
      data: {
        deletedAt: null,
        adminNotes: `Restored as separate 18U league on ${new Date().toISOString().slice(0, 10)} (reverted erroneous merge into Teens 17u)`
      }
    });

    await tx.season.update({
      where: { id: ORIGINAL_SEASON_ID },
      data: { deletedAt: null }
    });

    const games = await tx.game.updateMany({
      where: { seasonId: MERGED_SEASON_ID, deletedAt: null },
      data: { seasonId: ORIGINAL_SEASON_ID }
    });

    const rosters = await tx.playerTeamSeason.updateMany({
      where: { seasonId: MERGED_SEASON_ID, deletedAt: null },
      data: { seasonId: ORIGINAL_SEASON_ID }
    });

    const ratings = await tx.teamRating.updateMany({
      where: { seasonId: MERGED_SEASON_ID },
      data: { seasonId: ORIGINAL_SEASON_ID }
    });

    await tx.season.update({
      where: { id: MERGED_SEASON_ID },
      data: { deletedAt: new Date() }
    });

    const canonical = await tx.league.findUnique({ where: { id: CANONICAL_LEAGUE_ID } });
    if (canonical) {
      await tx.league.update({
        where: { id: CANONICAL_LEAGUE_ID },
        data: {
          adminNotes: [canonical.adminNotes, `6th edition reverted to separate 18U league on ${new Date().toISOString().slice(0, 10)}`]
            .filter(Boolean)
            .join("\n")
        }
      });
    }

    console.log(`\nReverted: ${games.count} games, ${rosters.count} rosters, ${ratings.count} team ratings`);
  });

  const verify = await prisma.league.findMany({
    where: { deletedAt: null, name: { contains: "Stallion", mode: "insensitive" } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: { _count: { select: { games: { where: { deletedAt: null } } } } },
        orderBy: { name: "asc" }
      }
    },
    orderBy: { name: "asc" }
  });

  console.log("\n=== Post-revert verification ===");
  for (const league of verify) {
    const games = league.seasons.reduce((sum, s) => sum + s._count.games, 0);
    console.log(`\n${league.name} (${games} games)`);
    for (const season of league.seasons) {
      console.log(`  ${season.name}: ${season._count.games} games`);
    }
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
