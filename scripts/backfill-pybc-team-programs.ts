import { PrismaClient, ProgramType } from "@prisma/client";
import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { getTeamDisplayName, normalizeProgramAlias, type ProgramIdentity } from "../src/lib/uaap-school-display";

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");
const repairIncorrectPybcProgramLinks = process.argv.includes("--repair-incorrect-pybc-program-links");

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right));
}

function isPybcLeagueName(value: string | null | undefined) {
  return isPybcCompetitionName(normalizeCompetitionDisplayName(value));
}

function programTypeFromIdentity(identity: ProgramIdentity): ProgramType {
  if (identity.programType === "School") return ProgramType.SCHOOL;
  if (identity.programType === "Club / Team") return ProgramType.CLUB;
  return ProgramType.UNKNOWN;
}

function programKeyFromName(value: string) {
  return normalizeProgramAlias(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-program";
}

function pybcTeamProgramIdentity(teamName: string): ProgramIdentity {
  const displayName = getTeamDisplayName(teamName);
  return {
    programKey: programKeyFromName(displayName),
    programFullName: displayName,
    programAbbreviation: displayName,
    programType: "Club / Team",
    teamDisplayName: displayName,
    normalizedAlias: normalizeProgramAlias(displayName)
  };
}

async function protectedCounts() {
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

async function loadCandidates() {
  const teams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      OR: [
        { homeGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
        { awayGames: { some: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } },
        { gameStats: { some: { deletedAt: null, game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } } } } }
      ]
    },
    include: {
      program: { select: { id: true, fullName: true, abbreviation: true, type: true } },
      homeGames: { where: { deletedAt: null }, include: { season: { include: { league: true } }, awayTeam: { select: { id: true, name: true } } } },
      awayGames: { where: { deletedAt: null }, include: { season: { include: { league: true } }, homeTeam: { select: { id: true, name: true } } } },
      gameStats: {
        where: { deletedAt: null, game: { deletedAt: null } },
        select: { id: true, game: { select: { gameNumber: true, season: { include: { league: true } } } } }
      }
    },
    orderBy: { name: "asc" }
  });

  return teams
    .map((team) => {
      const games = [
        ...team.homeGames.map((game) => ({
          gameNumber: game.gameNumber,
          leagueName: game.season.league.name,
          seasonName: game.season.name,
          opponent: game.awayTeam.name
        })),
        ...team.awayGames.map((game) => ({
          gameNumber: game.gameNumber,
          leagueName: game.season.league.name,
          seasonName: game.season.name,
          opponent: game.homeTeam.name
        }))
      ];
      const gameStatLeagueNames = team.gameStats.map((stat) => stat.game.season.league.name);
      const pybcEvidence = [...games.map((game) => game.leagueName), ...gameStatLeagueNames].some(isPybcLeagueName);

      return {
        teamId: team.id,
        teamName: team.name,
        programId: team.programId,
        currentProgram: team.program,
        displayTeamName: getTeamDisplayName(team.name),
        proposedProgram: pybcTeamProgramIdentity(team.name),
        gameCount: games.length,
        gameStatCount: team.gameStats.length,
        gameNumbers: unique(games.map((game) => game.gameNumber)),
        leagueNames: unique(games.map((game) => normalizeCompetitionDisplayName(game.leagueName))),
        seasonNames: unique(games.map((game) => game.seasonName)),
        opponents: unique(games.map((game) => game.opponent)),
        pybcEvidence
      };
    })
    .filter((team) => team.pybcEvidence);
}

async function main() {
  const beforeCounts = await protectedCounts();
  const pybcTeams = await loadCandidates();
  const candidates = pybcTeams.filter((team) => !team.programId);
  const incorrectPybcLeagueProgramTeams = pybcTeams.filter((team) => team.currentProgram?.fullName === "PYBC 15U");
  const candidateProgramNames = unique([
    ...candidates.map((team) => team.proposedProgram.programFullName),
    ...incorrectPybcLeagueProgramTeams.map((team) => team.proposedProgram.programFullName)
  ]);
  const existingPrograms = await prisma.program.findMany({
    where: { fullName: { in: candidateProgramNames }, deletedAt: null },
    select: { id: true, fullName: true, abbreviation: true, type: true }
  });
  const existingProgramByName = new Map(existingPrograms.map((program) => [program.fullName, program]));
  const incorrectPybcLeagueProgramLinks = incorrectPybcLeagueProgramTeams
    .map((team) => {
      const existingProgram = existingProgramByName.get(team.proposedProgram.programFullName) ?? null;
      return {
      teamId: team.teamId,
      teamName: team.teamName,
      displayTeamName: team.displayTeamName,
      currentProgramId: team.currentProgram?.id ?? null,
      currentProgramName: team.currentProgram?.fullName ?? null,
      gameCount: team.gameCount,
      gameStatCount: team.gameStatCount,
      gameNumbers: team.gameNumbers,
      leagueNames: team.leagueNames,
      seasonNames: team.seasonNames,
      proposedProgram: {
        existingProgramId: existingProgram?.id ?? null,
        wouldCreateProgram: !existingProgram,
        fullName: team.proposedProgram.programFullName,
        abbreviation: team.proposedProgram.programAbbreviation || null,
        type: programTypeFromIdentity(team.proposedProgram),
        aliases: unique([
          team.proposedProgram.normalizedAlias,
          team.proposedProgram.teamDisplayName,
          team.proposedProgram.programFullName,
          team.proposedProgram.programAbbreviation,
          team.teamName,
          team.displayTeamName
        ])
      }
    };
    });
  const candidatePlans = candidates.map((team) => {
    const existingProgram = existingProgramByName.get(team.proposedProgram.programFullName) ?? null;
    return {
      ...team,
      proposedProgram: {
        existingProgramId: existingProgram?.id ?? null,
        wouldCreateProgram: !existingProgram,
        fullName: team.proposedProgram.programFullName,
        abbreviation: team.proposedProgram.programAbbreviation || null,
        type: programTypeFromIdentity(team.proposedProgram),
        aliases: unique([
          team.proposedProgram.normalizedAlias,
          team.proposedProgram.teamDisplayName,
          team.proposedProgram.programFullName,
          team.proposedProgram.programAbbreviation,
          team.teamName,
          team.displayTeamName
        ])
      }
    };
  });

  const result = {
    dryRun: !execute,
    mode: repairIncorrectPybcProgramLinks ? "repair_incorrect_pybc_program_links" : "link_null_pybc_team_programs",
    leagueContext: "PYBC 15U",
    model: "PYBC 15U is league/competition context. Each PYBC participant maps to its own Program/team-program.",
    candidates: candidatePlans,
    repairCandidates: repairIncorrectPybcProgramLinks ? incorrectPybcLeagueProgramLinks : [],
    summary: {
      pybcEvidenceTeams: pybcTeams.length,
      teamsToLink: candidatePlans.length,
      teamsAlreadyLinked: pybcTeams.length - candidatePlans.length,
      programsWouldCreate: candidatePlans.filter((team) => team.proposedProgram.wouldCreateProgram).length,
      programsWouldReuse: candidatePlans.filter((team) => !team.proposedProgram.wouldCreateProgram).length,
      gameRefsCovered: candidatePlans.reduce((sum, team) => sum + team.gameCount, 0),
      gameStatsCovered: candidatePlans.reduce((sum, team) => sum + team.gameStatCount, 0),
      incorrectPybcLeagueProgramLinks,
      repairTeamsToRelink: repairIncorrectPybcProgramLinks ? incorrectPybcLeagueProgramLinks.length : 0,
      repairProgramsWouldCreate: repairIncorrectPybcProgramLinks ? incorrectPybcLeagueProgramLinks.filter((team) => team.proposedProgram.wouldCreateProgram).length : 0,
      repairProgramsWouldReuse: repairIncorrectPybcProgramLinks ? incorrectPybcLeagueProgramLinks.filter((team) => !team.proposedProgram.wouldCreateProgram).length : 0,
      repairGameRefsCovered: repairIncorrectPybcProgramLinks ? incorrectPybcLeagueProgramLinks.reduce((sum, team) => sum + team.gameCount, 0) : 0,
      repairGameStatsCovered: repairIncorrectPybcProgramLinks ? incorrectPybcLeagueProgramLinks.reduce((sum, team) => sum + team.gameStatCount, 0) : 0,
      executionBlocked: incorrectPybcLeagueProgramLinks.length > 0
        ? repairIncorrectPybcProgramLinks
          ? null
          : "Existing PYBC teams are already linked to the league Program PYBC 15U. This backfill only links null programId teams; correcting non-null links needs a separate approved repair."
        : null,
      guardrails: [
        repairIncorrectPybcProgramLinks
          ? "Only Teams currently linked to the incorrect PYBC 15U Program are repair candidates."
          : "Only Team rows with programId = null are candidates.",
        "Only teams with active official PYBC game/stat evidence are candidates.",
        "PYBC 15U is treated as league/competition evidence, not as the target Program.",
        "Each PYBC participant is linked to its own Program/team-program.",
        "No deletes, merges, rating recomputes, or snapshot changes are performed."
      ]
    },
    execution: null as null | {
      programsCreated: number;
      programsReused: number;
      teamsLinked: number;
      teamsRepaired?: number;
    },
    validation: {
      protectedCountsBefore: beforeCounts,
      protectedCountsAfter: beforeCounts,
      protectedCountsUnchanged: true,
      validationPassed: true
    }
  };

  if (execute) {
    if (!repairIncorrectPybcProgramLinks && incorrectPybcLeagueProgramLinks.length > 0) {
      throw new Error("Execute blocked: existing PYBC teams are linked to the league Program PYBC 15U. Correcting non-null programId values needs a separate approved repair.");
    }
    if (repairIncorrectPybcProgramLinks && incorrectPybcLeagueProgramLinks.length === 0) {
      throw new Error("Execute blocked: no incorrect PYBC 15U Program links were found to repair.");
    }

    const execution = await prisma.$transaction(async (tx) => {
      let programsCreated = 0;
      let programsReused = 0;
      let teamsLinked = 0;
      let teamsRepaired = 0;

      if (repairIncorrectPybcProgramLinks) {
        for (const candidate of incorrectPybcLeagueProgramLinks) {
          let program = existingProgramByName.get(candidate.proposedProgram.fullName) ?? null;
          if (!program) {
            program = await tx.program.create({
              data: {
                fullName: candidate.proposedProgram.fullName,
                abbreviation: candidate.proposedProgram.abbreviation,
                type: candidate.proposedProgram.type,
                aliases: candidate.proposedProgram.aliases
              },
              select: { id: true, fullName: true, abbreviation: true, type: true }
            });
            existingProgramByName.set(program.fullName, program);
            programsCreated += 1;
          } else {
            programsReused += 1;
          }

          const update = await tx.team.updateMany({
            where: { id: candidate.teamId, programId: candidate.currentProgramId, deletedAt: null },
            data: { programId: program.id }
          });
          teamsRepaired += update.count;
        }
      } else {
        for (const candidate of candidatePlans) {
          let program = existingProgramByName.get(candidate.proposedProgram.fullName) ?? null;
          if (!program) {
            program = await tx.program.create({
              data: {
                fullName: candidate.proposedProgram.fullName,
                abbreviation: candidate.proposedProgram.abbreviation,
                type: candidate.proposedProgram.type,
                aliases: candidate.proposedProgram.aliases
              },
              select: { id: true, fullName: true, abbreviation: true, type: true }
            });
            existingProgramByName.set(program.fullName, program);
            programsCreated += 1;
          } else {
            programsReused += 1;
          }

          const update = await tx.team.updateMany({
            where: { id: candidate.teamId, programId: null, deletedAt: null },
            data: { programId: program.id }
          });
          teamsLinked += update.count;
        }
      }

      return { programsCreated, programsReused, teamsLinked, teamsRepaired };
    });

    const afterCounts = await protectedCounts();
    result.execution = execution;
    result.validation.protectedCountsAfter = afterCounts;
    result.validation.protectedCountsUnchanged = JSON.stringify(beforeCounts) === JSON.stringify(afterCounts);
    result.validation.validationPassed = repairIncorrectPybcProgramLinks
      ? execution.teamsRepaired === incorrectPybcLeagueProgramLinks.length && result.validation.protectedCountsUnchanged
      : execution.teamsLinked === candidatePlans.length && result.validation.protectedCountsUnchanged;
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ dryRun: !execute, validationPassed: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
