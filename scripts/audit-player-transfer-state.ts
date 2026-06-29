import { prisma } from "../src/lib/prisma";

async function audit(namePart: string) {
  const players = await prisma.player.findMany({
    where: { deletedAt: null, displayName: { contains: namePart, mode: "insensitive" } },
    select: {
      id: true,
      displayName: true,
      currentProgram: { select: { fullName: true } },
      rosterSeasons: {
        where: { deletedAt: null, OR: [{ endsOn: null }, { endsOn: { gte: new Date() } }] },
        select: {
          team: { select: { name: true, program: { select: { fullName: true } } } },
          season: { select: { name: true } },
          adminOverride: true
        }
      },
      programHistory: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          effectiveDate: true,
          changeType: true,
          fromProgram: { select: { fullName: true } },
          toProgram: { select: { fullName: true } }
        }
      },
      gameStats: {
        where: { deletedAt: null },
        orderBy: { game: { gameDate: "desc" } },
        take: 5,
        select: {
          team: { select: { name: true, program: { select: { fullName: true } } } },
          game: { select: { gameDate: true, season: { select: { name: true, league: { select: { name: true } } } } } }
        }
      }
    }
  });

  console.log(`\n=== ${namePart} (${players.length} match) ===`);
  for (const player of players) {
    console.log(`\n${player.displayName}`);
    console.log(`  currentProgram: ${player.currentProgram?.fullName ?? "none"}`);
    console.log(`  active roster: ${player.rosterSeasons.map((r) => `${r.team.name} (${r.team.program.fullName}) / ${r.season.name}`).join("; ") || "none"}`);
    console.log(`  transfers: ${player.programHistory.map((h) => `${h.changeType} ${h.fromProgram?.fullName ?? "?"} -> ${h.toProgram?.fullName ?? "?"} @ ${h.effectiveDate?.toISOString().slice(0, 10) ?? "?"}`).join("; ") || "none"}`);
    console.log(`  recent stats teams: ${player.gameStats.map((s) => `${s.team.name} @ ${s.game.gameDate.toISOString().slice(0, 10)} (${s.game.season.league.name})`).join("; ")}`);
  }
}

async function main() {
  await audit("Bench Copada");
  await audit("Eoin Braga");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
