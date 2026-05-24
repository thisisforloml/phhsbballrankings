import { ProgramType, PrismaClient } from "@prisma/client";
import { resolveProgramIdentity, type ProgramIdentity } from "../src/lib/uaap-school-display";

const prisma = new PrismaClient();

type CountSnapshot = {
  games: number;
  gameStats: number;
  gamePerformanceScores: number;
  playerRatings: number;
  rankingSnapshots: number;
  rankingSnapshotRows: number;
};

function toProgramType(identity: ProgramIdentity): ProgramType {
  if (identity.programType === "School") return ProgramType.SCHOOL;
  if (identity.programType === "Club / Team") return ProgramType.CLUB;
  return ProgramType.UNKNOWN;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

async function countProtectedTables(): Promise<CountSnapshot> {
  const [games, gameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows] = await Promise.all([
    prisma.game.count(),
    prisma.gameStat.count(),
    prisma.gamePerformanceScore.count(),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count()
  ]);

  return { games, gameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows };
}

async function main() {
  const beforeCounts = await countProtectedTables();
  const teams = await prisma.team.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, programId: true },
    orderBy: { name: "asc" }
  });

  const programsCreated: Array<{ id: string; fullName: string; abbreviation: string | null; type: ProgramType }> = [];
  const programsReused: Array<{ id: string; fullName: string; abbreviation: string | null; type: ProgramType }> = [];
  const teamsLinked: Array<{ teamId: string; teamName: string; programId: string; programFullName: string }> = [];
  const teamsUnresolved: Array<{ teamId: string; teamName: string; reason: string }> = [];
  const programByFullName = new Map<string, { id: string; fullName: string; abbreviation: string | null; type: ProgramType }>();

  await prisma.$transaction(async (tx) => {
    for (const team of teams) {
      const identity = resolveProgramIdentity(team.name);
      if (!identity.programFullName.trim()) {
        teamsUnresolved.push({ teamId: team.id, teamName: team.name, reason: "Program full name resolved blank." });
        continue;
      }

      const fullNameKey = identity.programFullName.trim().toUpperCase();
      let program = programByFullName.get(fullNameKey) ?? null;
      if (!program) {
        const existing = await tx.program.findFirst({
          where: { fullName: identity.programFullName, deletedAt: null },
          select: { id: true, fullName: true, abbreviation: true, type: true }
        });

        if (existing) {
          program = existing;
          programsReused.push(existing);
        } else {
          const created = await tx.program.create({
            data: {
              fullName: identity.programFullName,
              abbreviation: identity.programAbbreviation || null,
              type: toProgramType(identity),
              aliases: unique([identity.normalizedAlias, identity.teamDisplayName, team.name])
            },
            select: { id: true, fullName: true, abbreviation: true, type: true }
          });
          program = created;
          programsCreated.push(created);
        }

        programByFullName.set(fullNameKey, program);
      }

      if (team.programId !== program.id) {
        await tx.team.update({ where: { id: team.id }, data: { programId: program.id } });
        teamsLinked.push({ teamId: team.id, teamName: team.name, programId: program.id, programFullName: program.fullName });
      }
    }
  });

  const afterCounts = await countProtectedTables();
  const activeTeamsWithoutProgram = await prisma.team.findMany({
    where: { deletedAt: null, programId: null },
    select: { id: true, name: true }
  });

  const ateneoPrograms = await prisma.program.findMany({
    where: { fullName: "Ateneo de Manila University", deletedAt: null },
    include: { teams: { where: { deletedAt: null }, select: { id: true, name: true } } }
  });
  const feuPrograms = await prisma.program.findMany({
    where: { fullName: { in: ["Far Eastern University", "Far Eastern University Diliman"] }, deletedAt: null },
    include: { teams: { where: { deletedAt: null }, select: { id: true, name: true } } },
    orderBy: { fullName: "asc" }
  });
  const ncaaPrograms = await prisma.program.findMany({
    where: { abbreviation: { in: ["EAC", "CSB", "LPU", "UPHSD", "SBU", "CSJL", "SSCR", "AU", "JRU", "MU"] }, deletedAt: null },
    select: { id: true, fullName: true, abbreviation: true, type: true }
  });
  const pybcPrograms = await prisma.program.findMany({
    where: { fullName: { in: ["SMILE 360 BULLIES", "SPARTANS", "San Beda Alabang Spartans"] }, deletedAt: null },
    select: { id: true, fullName: true, abbreviation: true, type: true }
  });

  const protectedCountsUnchanged = JSON.stringify(beforeCounts) === JSON.stringify(afterCounts);
  const validationPassed = protectedCountsUnchanged && activeTeamsWithoutProgram.length === 0 && ateneoPrograms.length === 1;

  console.log(JSON.stringify({
    programsCreated,
    programsReused,
    teamsLinked,
    teamsUnresolved,
    playerCurrentProgramBackfillSkipped: true,
    playerCurrentProgramBackfillReason: "Stage 1 links teams to programs only. Player.currentProgramId requires a separate policy for current team/source precedence across seasons and transfers.",
    validation: {
      validationPassed,
      protectedCountsUnchanged,
      beforeCounts,
      afterCounts,
      activeTeamsWithoutProgram,
      ateneo: ateneoPrograms.map((program) => ({ id: program.id, fullName: program.fullName, abbreviation: program.abbreviation, linkedTeams: program.teams.map((team) => team.name).sort() })),
      feuAndFeuD: feuPrograms.map((program) => ({ id: program.id, fullName: program.fullName, abbreviation: program.abbreviation, linkedTeams: program.teams.map((team) => team.name).sort() })),
      ncaaPrograms,
      pybcPrograms
    }
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ validationPassed: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
