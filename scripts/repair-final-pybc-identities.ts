import { prisma } from "../src/lib/prisma";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";

type TeamRepair = {
  participantName: string;
  riskClassification: "EXECUTE_READY";
  canonicalProgramId: string;
  canonicalProgramName: string;
  canonicalTeamId: string;
  canonicalTeamName: string;
  duplicateProgramIds: string[];
  duplicateTeams: Array<{
    teamId: string;
    teamName: string;
    currentProgramId: string;
    updateProgramIdToCanonical: boolean;
    approvedGameNumbers: string[];
    expectedGameStats: number;
  }>;
  reason: string;
};

const finalRepairs: TeamRepair[] = [
  {
    participantName: "San Pedro Spartans",
    riskClassification: "EXECUTE_READY",
    canonicalProgramId: "b5c79a29-bd7b-47ce-ac9c-4d15f1fbb711",
    canonicalProgramName: "San Pedro Spartans",
    canonicalTeamId: "26ce5dc4-0667-4710-ab1b-53d4a13d8d61",
    canonicalTeamName: "San Pedro Spartans",
    duplicateProgramIds: ["1ec13bb5-3fea-420c-a3b6-3a849922a3b6"],
    duplicateTeams: [
      {
        teamId: "8b564cd2-c365-47d6-b0e6-9c461c1454c3",
        teamName: "San Pedro Spartans U16 Boys",
        currentProgramId: "b5c79a29-bd7b-47ce-ac9c-4d15f1fbb711",
        updateProgramIdToCanonical: false,
        approvedGameNumbers: ["G-2025-011", "G-2025-017", "G-2025-021", "G-2025-023", "G-2025-028"],
        expectedGameStats: 56
      },
      {
        teamId: "667a8587-b134-4fb6-8ec9-9a8487e02f02",
        teamName: "SPARTANS U16 Boys",
        currentProgramId: "1ec13bb5-3fea-420c-a3b6-3a849922a3b6",
        updateProgramIdToCanonical: true,
        approvedGameNumbers: ["G-2025-008"],
        expectedGameStats: 15
      }
    ],
    reason: "User confirmed Spartans should resolve/display as San Pedro Spartans; all source Teams have active PYBC-only evidence and explicit game/stat counts."
  },
  {
    participantName: "JPM-TEC San Beda / SBU",
    riskClassification: "EXECUTE_READY",
    canonicalProgramId: "65908829-cfda-4053-821c-47435a45e33e",
    canonicalProgramName: "JPM-TEC San Beda",
    canonicalTeamId: "8af1de8f-7e66-436b-9e2e-6c22d9add869",
    canonicalTeamName: "JPM-TEC San Beda",
    duplicateProgramIds: [],
    duplicateTeams: [
      {
        teamId: "f2705e3c-8cb6-4c27-84e9-8941e6c8599a",
        teamName: "SBU U16 Boys",
        currentProgramId: "65908829-cfda-4053-821c-47435a45e33e",
        updateProgramIdToCanonical: false,
        approvedGameNumbers: ["G-2025-016", "G-2025-019", "G-2025-021", "G-2025-022", "G-2025-027"],
        expectedGameStats: 69
      }
    ],
    reason: "User confirmed the current intended Program is JPM-TEC San Beda; SBU U16 Boys is already under that Program and has active PYBC-only evidence."
  }
];

function isExecuteRequested() {
  return process.argv.includes("--execute");
}

function isRepairRequested() {
  return process.argv.includes("--repair-final-pybc-identities");
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function loadPrograms(programIds: string[]) {
  return prisma.program.findMany({
    where: { id: { in: programIds }, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      abbreviation: true,
      aliases: true,
      city: true,
      region: true,
      type: true
    }
  });
}

async function loadTeams(teamIds: string[]) {
  return prisma.team.findMany({
    where: { id: { in: teamIds }, deletedAt: null },
    include: { program: { select: { id: true, fullName: true } } },
    orderBy: { name: "asc" }
  });
}

async function loadTeamEvidence(teamId: string) {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      season: { deletedAt: null, league: { deletedAt: null } }
    },
    include: { season: { include: { league: true } } },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });
  const pybcGames = games.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U");
  const nonPybcGames = games.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) !== "PYBC 15U");
  const pybcGameIds = pybcGames.map((game) => game.id);
  const gameStatCount = await prisma.gameStat.count({
    where: { deletedAt: null, teamId, gameId: { in: pybcGameIds } }
  });

  return {
    teamId,
    nonPybcGameCount: nonPybcGames.length,
    gameRefs: pybcGames.map((game) => ({
      gameId: game.id,
      gameNumber: game.gameNumber,
      gameDate: formatDate(game.gameDate),
      league: game.season.league.name,
      normalizedLeague: normalizeCompetitionDisplayName(game.season.league.name),
      season: game.season.name,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      origin: String(game.gameNumber ?? "").startsWith("PYBC-DRAFT") ? "draft-origin" : "official"
    })),
    gameNumbers: pybcGames.map((game) => String(game.gameNumber)),
    gameStatCount
  };
}

async function buildDryRun() {
  const cases = await Promise.all(finalRepairs.map(async (repair) => {
    const allProgramIds = [repair.canonicalProgramId, ...repair.duplicateProgramIds];
    const allTeamIds = [repair.canonicalTeamId, ...repair.duplicateTeams.map((team) => team.teamId)];
    const [programs, teams] = await Promise.all([loadPrograms(allProgramIds), loadTeams(allTeamIds)]);
    const evidence = await Promise.all(allTeamIds.map(loadTeamEvidence));
    const canonicalTeam = teams.find((team) => team.id === repair.canonicalTeamId);
    const duplicateTeamRows = repair.duplicateTeams.map((expected) => {
      const team = teams.find((item) => item.id === expected.teamId);
      const teamEvidence = evidence.find((item) => item.teamId === expected.teamId);
      return { expected, team, teamEvidence };
    });
    const canonicalEvidence = evidence.find((item) => item.teamId === repair.canonicalTeamId);
    const duplicateValidations = duplicateTeamRows.map(({ expected, team, teamEvidence }) => ({
      teamExists: Boolean(team),
      programMatches: team?.programId === expected.currentProgramId,
      pybcOnly: (teamEvidence?.nonPybcGameCount ?? 0) === 0,
      gameRefsMatch: sameStringSet(teamEvidence?.gameNumbers ?? [], expected.approvedGameNumbers),
      gameStatsMatch: teamEvidence?.gameStatCount === expected.expectedGameStats
    }));
    const executeReady = programs.length === allProgramIds.length
      && Boolean(canonicalTeam)
      && canonicalTeam?.programId === repair.canonicalProgramId
      && duplicateValidations.every((validation) => Object.values(validation).every(Boolean));

    return {
      participantName: repair.participantName,
      riskClassification: executeReady ? repair.riskClassification : "NEEDS_REVIEW",
      reason: executeReady ? repair.reason : "Live DB evidence does not match the guarded final repair constants; do not execute without refreshing the plan.",
      programs,
      teams: teams.map((team) => {
        const teamEvidence = evidence.find((item) => item.teamId === team.id);
        return {
          teamId: team.id,
          teamName: team.name,
          programId: team.programId,
          programName: team.program?.fullName ?? null,
          activePybcGameRefs: teamEvidence?.gameRefs.filter((game) => game.origin === "official") ?? [],
          draftOriginGameRefs: teamEvidence?.gameRefs.filter((game) => game.origin === "draft-origin") ?? [],
          gameStatsCount: teamEvidence?.gameStatCount ?? 0,
          nonPybcGameCount: teamEvidence?.nonPybcGameCount ?? 0
        };
      }),
      proposedCanonicalProgram: {
        programId: repair.canonicalProgramId,
        programName: repair.canonicalProgramName
      },
      proposedCanonicalTeam: {
        teamId: repair.canonicalTeamId,
        teamName: repair.canonicalTeamName,
        existingGameRefs: canonicalEvidence?.gameNumbers ?? [],
        existingGameStats: canonicalEvidence?.gameStatCount ?? 0
      },
      proposedReassignments: repair.duplicateTeams.map((team) => ({
        type: "GAME_AND_GAMESTAT_TEAM_ID",
        fromTeamId: team.teamId,
        fromTeamName: team.teamName,
        toTeamId: repair.canonicalTeamId,
        toTeamName: repair.canonicalTeamName,
        teamProgramIdUpdate: team.updateProgramIdToCanonical ? {
          teamId: team.teamId,
          fromProgramId: team.currentProgramId,
          toProgramId: repair.canonicalProgramId
        } : null,
        gameRefsToUpdate: team.approvedGameNumbers,
        gameStatsToUpdate: team.expectedGameStats
      })),
      validation: {
        canonicalTeamProgramMatches: canonicalTeam?.programId === repair.canonicalProgramId,
        duplicateValidations
      }
    };
  }));

  return {
    mode: "final-pybc-identities-dry-run",
    guardrails: [
      "Scope is limited to San Pedro Spartans and JPM-TEC San Beda / SBU.",
      "Each case is independently validated; one case can fail without adding the other to scope.",
      "Only active PYBC 15U game/stat evidence is eligible.",
      "Execute requires --repair-final-pybc-identities --execute.",
      "No broad repair-all mode exists.",
      "No deletes, merges, imports, rating recomputes, or snapshot changes are performed.",
      "If executed, only Team.programId, Game.homeTeamId, Game.awayTeamId, and GameStat.teamId are updated."
    ],
    summary: {
      casesInspected: cases.length,
      executeReadyCases: cases.filter((item) => item.riskClassification === "EXECUTE_READY").length,
      needsReviewCases: cases.filter((item) => item.riskClassification !== "EXECUTE_READY").length,
      gamesToUpdateIfExecuted: finalRepairs.reduce((sum, repair) => sum + repair.duplicateTeams.reduce((inner, team) => inner + team.approvedGameNumbers.length, 0), 0),
      gameStatsToUpdateIfExecuted: finalRepairs.reduce((sum, repair) => sum + repair.duplicateTeams.reduce((inner, team) => inner + team.expectedGameStats, 0), 0),
      teamProgramUpdatesIfExecuted: finalRepairs.reduce((sum, repair) => sum + repair.duplicateTeams.filter((team) => team.updateProgramIdToCanonical).length, 0)
    },
    cases,
    noWritesPerformed: true
  };
}

async function protectedCounts() {
  return {
    games: await prisma.game.count(),
    gameStats: await prisma.gameStat.count(),
    gamePerformanceScores: await prisma.gamePerformanceScore.count(),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };
}

async function executeFinalRepairs() {
  const dryRun = await buildDryRun();
  const readyCases = dryRun.cases.filter((item) => item.riskClassification === "EXECUTE_READY");
  if (readyCases.length !== finalRepairs.length) {
    throw new Error(`Expected ${finalRepairs.length} execute-ready final PYBC cases, found ${readyCases.length}.`);
  }

  const countsBefore = await protectedCounts();
  const result = await prisma.$transaction(async (tx) => {
    const repairs = [];

    for (const repair of finalRepairs) {
      const canonicalTeam = await tx.team.findFirst({
        where: { id: repair.canonicalTeamId, programId: repair.canonicalProgramId, deletedAt: null },
        select: { id: true, name: true, programId: true }
      });
      if (!canonicalTeam) {
        throw new Error(`Canonical Team does not match expected Program for ${repair.participantName}.`);
      }

      for (const duplicateTeam of repair.duplicateTeams) {
        const sourceTeam = await tx.team.findFirst({
          where: { id: duplicateTeam.teamId, programId: duplicateTeam.currentProgramId, deletedAt: null },
          select: { id: true, name: true, programId: true }
        });
        if (!sourceTeam) {
          throw new Error(`Source Team does not match expected Program for ${repair.participantName}: ${duplicateTeam.teamName}.`);
        }

        const games = await tx.game.findMany({
          where: {
            deletedAt: null,
            OR: [{ homeTeamId: duplicateTeam.teamId }, { awayTeamId: duplicateTeam.teamId }],
            season: { deletedAt: null, league: { deletedAt: null } }
          },
          include: { season: { include: { league: true } } }
        });
        const pybcGames = games.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U");
        const nonPybcGames = games.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) !== "PYBC 15U");
        const gameNumbers = pybcGames.map((game) => String(game.gameNumber));
        if (nonPybcGames.length > 0) {
          throw new Error(`Non-PYBC games found for ${duplicateTeam.teamName}.`);
        }
        if (!sameStringSet(gameNumbers, duplicateTeam.approvedGameNumbers) || pybcGames.length !== duplicateTeam.approvedGameNumbers.length) {
          throw new Error(`Game refs changed for ${duplicateTeam.teamName}. Found ${gameNumbers.join(", ")}.`);
        }

        const gameIds = pybcGames.map((game) => game.id);
        const gameStatsToUpdate = await tx.gameStat.count({
          where: { deletedAt: null, teamId: duplicateTeam.teamId, gameId: { in: gameIds } }
        });
        if (gameStatsToUpdate !== duplicateTeam.expectedGameStats) {
          throw new Error(`GameStat count changed for ${duplicateTeam.teamName}. Expected ${duplicateTeam.expectedGameStats}, found ${gameStatsToUpdate}.`);
        }

        let teamProgramUpdated = 0;
        if (duplicateTeam.updateProgramIdToCanonical) {
          const update = await tx.team.updateMany({
            where: { id: duplicateTeam.teamId, programId: duplicateTeam.currentProgramId, deletedAt: null },
            data: { programId: repair.canonicalProgramId }
          });
          teamProgramUpdated = update.count;
          if (teamProgramUpdated !== 1) {
            throw new Error(`Expected to update exactly 1 Team.programId for ${duplicateTeam.teamName}, updated ${teamProgramUpdated}.`);
          }
        }

        const homeGamesUpdated = await tx.game.updateMany({
          where: { id: { in: gameIds }, homeTeamId: duplicateTeam.teamId, deletedAt: null },
          data: { homeTeamId: repair.canonicalTeamId }
        });
        const awayGamesUpdated = await tx.game.updateMany({
          where: { id: { in: gameIds }, awayTeamId: duplicateTeam.teamId, deletedAt: null },
          data: { awayTeamId: repair.canonicalTeamId }
        });
        const gameStatsUpdated = await tx.gameStat.updateMany({
          where: { deletedAt: null, teamId: duplicateTeam.teamId, gameId: { in: gameIds } },
          data: { teamId: repair.canonicalTeamId }
        });

        repairs.push({
          participantName: repair.participantName,
          fromTeamId: duplicateTeam.teamId,
          fromTeamName: duplicateTeam.teamName,
          toTeamId: repair.canonicalTeamId,
          toTeamName: repair.canonicalTeamName,
          teamProgramUpdated,
          gamesUpdated: homeGamesUpdated.count + awayGamesUpdated.count,
          homeGamesUpdated: homeGamesUpdated.count,
          awayGamesUpdated: awayGamesUpdated.count,
          gameStatsUpdated: gameStatsUpdated.count,
          gameNumbersUpdated: uniqueSorted(gameNumbers)
        });
      }
    }

    return repairs;
  });
  const countsAfter = await protectedCounts();
  const countNames = Object.keys(countsBefore) as Array<keyof Awaited<ReturnType<typeof protectedCounts>>>;
  const countValidationPassed = countNames.every((key) => countsBefore[key] === countsAfter[key]);
  if (!countValidationPassed) {
    throw new Error("Protected table counts changed unexpectedly.");
  }

  return {
    mode: "final-pybc-identities-execute",
    repairs: result,
    protectedCountsBefore: countsBefore,
    protectedCountsAfter: countsAfter,
    validationPassed: true
  };
}

async function main() {
  const executeRequested = isExecuteRequested();
  if (executeRequested && !isRepairRequested()) {
    throw new Error("Execute requires --repair-final-pybc-identities --execute.");
  }

  const dryRun = await buildDryRun();
  if (executeRequested) {
    const result = await executeFinalRepairs();
    console.log(JSON.stringify({ ...dryRun, noWritesPerformed: false, ...result }, null, 2));
    return;
  }

  console.log(JSON.stringify(dryRun, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
