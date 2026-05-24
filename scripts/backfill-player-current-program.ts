import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");

type Candidate = {
  playerId: string;
  displayName: string;
  programId: string;
  programName: string;
};

async function main() {
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    include: {
      currentProgram: { select: { id: true, fullName: true } },
      gameStats: {
        where: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } },
        include: { team: { select: { programId: true, program: { select: { id: true, fullName: true } } } } }
      }
    },
    orderBy: { displayName: "asc" }
  });

  const candidates: Candidate[] = [];
  const skippedMultiplePrograms: Array<{ playerId: string; displayName: string; programs: string[] }> = [];
  const skippedNoEvidence: Array<{ playerId: string; displayName: string }> = [];
  const alreadySet: Array<{ playerId: string; displayName: string; programName: string }> = [];

  for (const player of players) {
    if (player.currentProgram) {
      alreadySet.push({ playerId: player.id, displayName: player.displayName, programName: player.currentProgram.fullName });
      continue;
    }

    const programMap = new Map<string, string>();
    for (const stat of player.gameStats) {
      if (stat.team.program) programMap.set(stat.team.program.id, stat.team.program.fullName);
    }

    if (programMap.size === 1) {
      const [programId, programName] = Array.from(programMap.entries())[0];
      candidates.push({ playerId: player.id, displayName: player.displayName, programId, programName });
    } else if (programMap.size > 1) {
      skippedMultiplePrograms.push({ playerId: player.id, displayName: player.displayName, programs: Array.from(programMap.values()).sort() });
    } else {
      skippedNoEvidence.push({ playerId: player.id, displayName: player.displayName });
    }
  }

  let playersUpdated = 0;
  if (execute && candidates.length) {
    const results = await prisma.$transaction(candidates.map((candidate) => prisma.player.update({ where: { id: candidate.playerId }, data: { currentProgramId: candidate.programId }, select: { id: true } })));
    playersUpdated = results.length;
  }

  const validation = execute
    ? await prisma.player.count({ where: { id: { in: candidates.map((candidate) => candidate.playerId) }, currentProgramId: { not: null }, deletedAt: null } })
    : 0;

  console.log(JSON.stringify({
    dryRun: !execute,
    totalActivePlayers: players.length,
    playersAlreadySet: alreadySet.length,
    eligibleSingleProgram: candidates.length,
    playersUpdated,
    skippedMultiplePrograms: skippedMultiplePrograms.length,
    skippedNoEvidence: skippedNoEvidence.length,
    validationPassed: execute ? validation === candidates.length : true,
    sampleEligible: candidates.slice(0, 10),
    sampleSkippedMultiplePrograms: skippedMultiplePrograms.slice(0, 10),
    sampleSkippedNoEvidence: skippedNoEvidence.slice(0, 10)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
