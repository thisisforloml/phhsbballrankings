import { prisma } from "../src/lib/prisma";

async function main() {
  const program = await prisma.program.findFirst({
    where: { fullName: { contains: "Adamson", mode: "insensitive" }, deletedAt: null },
    select: { id: true, fullName: true, teams: { where: { deletedAt: null }, select: { id: true, name: true } } }
  });

  if (!program) {
    console.log("No Adamson program found.");
    return;
  }

  const players = await prisma.player.findMany({
    where: { currentProgramId: program.id, deletedAt: null },
    select: {
      displayName: true,
      rosterSeasons: {
        where: { deletedAt: null, OR: [{ endsOn: null }, { endsOn: { gte: new Date() } }] },
        select: { team: { select: { name: true } } }
      },
      gameStats: {
        where: { deletedAt: null },
        take: 1,
        select: { team: { select: { name: true } } }
      }
    },
    orderBy: { displayName: "asc" }
  });

  const unassigned = players.filter((player) => player.rosterSeasons.length === 0);

  console.log(`Program: ${program.fullName}`);
  console.log(`Teams: ${program.teams.map((t) => t.name).join(", ")}`);
  console.log(`Current players: ${players.length}`);
  console.log(`Missing active PlayerTeamSeason: ${unassigned.length}`);
  console.log("---");
  for (const player of unassigned) {
    const statTeam = player.gameStats[0]?.team.name ?? "no stats";
    console.log(`${player.displayName} | stat evidence team: ${statTeam}`);
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
