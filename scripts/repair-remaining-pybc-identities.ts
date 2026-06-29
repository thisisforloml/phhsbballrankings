import { prisma } from "../src/lib/prisma";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";

const levRepair = {
  participantName: "LEV Construction Full Potential",
  canonicalProgramId: "b668fd23-c767-4c14-9659-8b2d418fd36a",
  canonicalProgramName: "Lev Construction Full Potential",
  duplicateProgramId: "b3009ae6-ac6f-43d4-af9a-fb45613fc20b",
  duplicateProgramName: "LEV Construction Full Potential",
  canonicalTeamId: "aae3a772-c203-4dc0-bd87-35015466c6ea",
  canonicalTeamName: "LEV Construction Full Potential",
  duplicateTeamId: "fba904cf-34c0-46af-9a23-dd701a32a2e2",
  duplicateTeamName: "Lev Construction Full Potential U16 Boys",
  programMoveGameNumbers: ["G-2025-002", "G-2025-004", "G-2025-006", "G-2025-010"],
  programMoveGameStats: 50,
  teamReferenceGameNumbers: ["G-2025-017", "G-2025-020", "G-2025-025"],
  teamReferenceGameStats: 23
};

const needsReviewCases = [
  {
    participantName: "JPM-TEC San Beda / SBU",
    reason: "SBU is not automatically the same identity as JPM-TEC San Beda. Repair needs explicit admin confirmation that the SBU U16 Boys Team belongs under JPM-TEC San Beda.",
    programIds: ["65908829-cfda-4053-821c-47435a45e33e"],
    teamIds: ["8af1de8f-7e66-436b-9e2e-6c22d9add869", "f2705e3c-8cb6-4c27-84e9-8941e6c8599a"]
  },
  {
    participantName: "San Pedro Spartans",
    reason: "San Pedro has duplicate Program rows plus three Team records, including one draft-origin Team and two official PYBC teams. Repair order needs manual confirmation before moving references.",
    programIds: ["b5c79a29-bd7b-47ce-ac9c-4d15f1fbb711", "1ec13bb5-3fea-420c-a3b6-3a849922a3b6"],
    teamIds: ["26ce5dc4-0667-4710-ab1b-53d4a13d8d61", "8b564cd2-c365-47d6-b0e6-9c461c1454c3", "667a8587-b134-4fb6-8ec9-9a8487e02f02"]
  }
];

function isExecuteRequested() {
  return process.argv.includes("--execute");
}

function isRepairRequested() {
  return process.argv.includes("--repair-remaining-pybc-identities");
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
    select: { id: true, fullName: true, abbreviation: true, type: true }
  });
}

async function loadTeams(teamIds: string[]) {
  return prisma.team.findMany({
    where: { id: { in: teamIds }, deletedAt: null },
    include: { program: { select: { id: true, fullName: true } } }
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
  const pybcGameIds = pybcGames.map((game) => game.id);
  const gameStatCount = await prisma.gameStat.count({
    where: { deletedAt: null, teamId, gameId: { in: pybcGameIds } }
  });

  return {
    teamId,
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
      awayScore: game.awayScore
    })),
    gameNumbers: pybcGames.map((game) => String(game.gameNumber)),
    gameStatCount
  };
}

async function buildCaseDetails() {
  const levPrograms = await loadPrograms([levRepair.canonicalProgramId, levRepair.duplicateProgramId]);
  const levTeams = await loadTeams([levRepair.canonicalTeamId, levRepair.duplicateTeamId]);
  const levCanonicalEvidence = await loadTeamEvidence(levRepair.canonicalTeamId);
  const levDuplicateEvidence = await loadTeamEvidence(levRepair.duplicateTeamId);
  const needsReview = await Promise.all(needsReviewCases.map(async (item) => {
    const programs = await loadPrograms(item.programIds);
    const teams = await loadTeams(item.teamIds);
    const evidence = await Promise.all(item.teamIds.map(loadTeamEvidence));

    return {
      participantName: item.participantName,
      riskClassification: "NEEDS_REVIEW",
      reason: item.reason,
      programs,
      teams: teams.map((team) => {
        const teamEvidence = evidence.find((entry) => entry.teamId === team.id);
        return {
          teamId: team.id,
          teamName: team.name,
          programId: team.programId,
          programName: team.program?.fullName ?? null,
          gameRefs: teamEvidence?.gameRefs ?? [],
          gameStatsCount: teamEvidence?.gameStatCount ?? 0
        };
      }),
      proposedCanonicalProgram: null,
      proposedCanonicalTeam: null,
      proposedReassignments: []
    };
  }));

  const levExecuteReady = levPrograms.length === 2
    && levTeams.length === 2
    && levTeams.some((team) => team.id === levRepair.canonicalTeamId && team.programId === levRepair.duplicateProgramId)
    && levTeams.some((team) => team.id === levRepair.duplicateTeamId && team.programId === levRepair.canonicalProgramId)
    && sameStringSet(levCanonicalEvidence.gameNumbers, levRepair.programMoveGameNumbers)
    && sameStringSet(levDuplicateEvidence.gameNumbers, levRepair.teamReferenceGameNumbers)
    && levCanonicalEvidence.gameStatCount === levRepair.programMoveGameStats
    && levDuplicateEvidence.gameStatCount === levRepair.teamReferenceGameStats;

  return {
    executeReadyCases: [
      {
        participantName: levRepair.participantName,
        riskClassification: levExecuteReady ? "EXECUTE_READY" : "NEEDS_REVIEW",
        reason: levExecuteReady
          ? "LEV/Lev is constrained to active PYBC evidence with exact approved Program and Team IDs, game refs, and GameStat counts."
          : "LEV live evidence no longer matches the guarded repair constants; do not execute without a refreshed plan.",
        programs: levPrograms,
        teams: levTeams.map((team) => ({
          teamId: team.id,
          teamName: team.name,
          programId: team.programId,
          programName: team.program?.fullName ?? null,
          gameRefs: team.id === levRepair.canonicalTeamId ? levCanonicalEvidence.gameRefs : levDuplicateEvidence.gameRefs,
          gameStatsCount: team.id === levRepair.canonicalTeamId ? levCanonicalEvidence.gameStatCount : levDuplicateEvidence.gameStatCount
        })),
        proposedCanonicalProgram: {
          programId: levRepair.canonicalProgramId,
          programName: levRepair.canonicalProgramName
        },
        proposedCanonicalTeam: {
          teamId: levRepair.canonicalTeamId,
          teamName: levRepair.canonicalTeamName
        },
        proposedReassignments: [
          {
            type: "TEAM_PROGRAM_ID",
            teamId: levRepair.canonicalTeamId,
            teamName: levRepair.canonicalTeamName,
            fromProgramId: levRepair.duplicateProgramId,
            fromProgramName: levRepair.duplicateProgramName,
            toProgramId: levRepair.canonicalProgramId,
            toProgramName: levRepair.canonicalProgramName,
            gameRefsCovered: levCanonicalEvidence.gameNumbers,
            gameStatsCovered: levCanonicalEvidence.gameStatCount
          },
          {
            type: "GAME_AND_GAMESTAT_TEAM_ID",
            fromTeamId: levRepair.duplicateTeamId,
            fromTeamName: levRepair.duplicateTeamName,
            toTeamId: levRepair.canonicalTeamId,
            toTeamName: levRepair.canonicalTeamName,
            gameRefsToUpdate: levDuplicateEvidence.gameNumbers,
            gameStatsToUpdate: levDuplicateEvidence.gameStatCount
          }
        ]
      }
    ],
    needsReviewCases: needsReview
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

async function executeLevRepair() {
  const details = await buildCaseDetails();
  const levCase = details.executeReadyCases[0];
  if (levCase.riskClassification !== "EXECUTE_READY") {
    throw new Error("LEV repair is not execute-ready. Run dry-run and refresh the plan.");
  }

  const countsBefore = await protectedCounts();
  const result = await prisma.$transaction(async (tx) => {
    const canonicalTeam = await tx.team.findFirst({
      where: { id: levRepair.canonicalTeamId, programId: levRepair.duplicateProgramId, deletedAt: null },
      select: { id: true, name: true, programId: true }
    });
    const duplicateTeam = await tx.team.findFirst({
      where: { id: levRepair.duplicateTeamId, programId: levRepair.canonicalProgramId, deletedAt: null },
      select: { id: true, name: true, programId: true }
    });
    if (!canonicalTeam || !duplicateTeam) {
      throw new Error("LEV Teams do not match the expected pre-repair Program assignments.");
    }

    const games = await tx.game.findMany({
      where: {
        deletedAt: null,
        OR: [{ homeTeamId: levRepair.duplicateTeamId }, { awayTeamId: levRepair.duplicateTeamId }],
        season: { deletedAt: null, league: { deletedAt: null } }
      },
      include: { season: { include: { league: true } } }
    });
    const pybcGames = games.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U");
    const gameNumbers = pybcGames.map((game) => String(game.gameNumber));
    if (!sameStringSet(gameNumbers, levRepair.teamReferenceGameNumbers) || pybcGames.length !== levRepair.teamReferenceGameNumbers.length) {
      throw new Error(`LEV duplicate Team game refs changed. Found ${gameNumbers.join(", ")}`);
    }

    const gameIds = pybcGames.map((game) => game.id);
    const gameStatsToUpdate = await tx.gameStat.count({
      where: { deletedAt: null, teamId: levRepair.duplicateTeamId, gameId: { in: gameIds } }
    });
    if (gameStatsToUpdate !== levRepair.teamReferenceGameStats) {
      throw new Error(`LEV GameStat count changed. Expected ${levRepair.teamReferenceGameStats}, found ${gameStatsToUpdate}.`);
    }

    const teamProgramUpdated = await tx.team.updateMany({
      where: { id: levRepair.canonicalTeamId, programId: levRepair.duplicateProgramId, deletedAt: null },
      data: { programId: levRepair.canonicalProgramId }
    });
    if (teamProgramUpdated.count !== 1) {
      throw new Error(`Expected to update exactly 1 LEV Team.programId, updated ${teamProgramUpdated.count}.`);
    }

    const homeGamesUpdated = await tx.game.updateMany({
      where: { id: { in: gameIds }, homeTeamId: levRepair.duplicateTeamId, deletedAt: null },
      data: { homeTeamId: levRepair.canonicalTeamId }
    });
    const awayGamesUpdated = await tx.game.updateMany({
      where: { id: { in: gameIds }, awayTeamId: levRepair.duplicateTeamId, deletedAt: null },
      data: { awayTeamId: levRepair.canonicalTeamId }
    });
    const gameStatsUpdated = await tx.gameStat.updateMany({
      where: { deletedAt: null, teamId: levRepair.duplicateTeamId, gameId: { in: gameIds } },
      data: { teamId: levRepair.canonicalTeamId }
    });

    return {
      teamProgramUpdated: teamProgramUpdated.count,
      gamesUpdated: homeGamesUpdated.count + awayGamesUpdated.count,
      homeGamesUpdated: homeGamesUpdated.count,
      awayGamesUpdated: awayGamesUpdated.count,
      gameStatsUpdated: gameStatsUpdated.count,
      gameNumbersUpdated: uniqueSorted(gameNumbers)
    };
  });
  const countsAfter = await protectedCounts();
  const countNames = Object.keys(countsBefore) as Array<keyof Awaited<ReturnType<typeof protectedCounts>>>;
  const countValidationPassed = countNames.every((key) => countsBefore[key] === countsAfter[key]);
  if (!countValidationPassed) {
    throw new Error("Protected table counts changed unexpectedly.");
  }

  return {
    mode: "remaining-pybc-identities-execute",
    executedCases: [levRepair.participantName],
    result,
    protectedCountsBefore: countsBefore,
    protectedCountsAfter: countsAfter,
    validationPassed: true
  };
}

async function main() {
  const executeRequested = isExecuteRequested();
  if (executeRequested && !isRepairRequested()) {
    throw new Error("Execute requires --repair-remaining-pybc-identities --execute.");
  }

  const details = await buildCaseDetails();
  const summary = {
    mode: executeRequested ? "remaining-pybc-identities-execute-requested" : "remaining-pybc-identities-dry-run",
    guardrails: [
      "Scope is limited to remaining PYBC participant identities: LEV, San Pedro Spartans, and JPM-TEC/SBU.",
      "Only LEV can be EXECUTE_READY, and only if exact IDs, game refs, and GameStat counts match.",
      "San Pedro Spartans and JPM-TEC/SBU are report-only NEEDS_REVIEW cases.",
      "Execute requires --repair-remaining-pybc-identities --execute.",
      "No deletes, merges, imports, rating recomputes, or snapshot changes are performed.",
      "If executed, only Team.programId, Game.homeTeamId, Game.awayTeamId, and GameStat.teamId are updated."
    ],
    executeReadyCases: details.executeReadyCases.filter((item) => item.riskClassification === "EXECUTE_READY").length,
    needsReviewCases: details.needsReviewCases.length + details.executeReadyCases.filter((item) => item.riskClassification !== "EXECUTE_READY").length,
    cases: [...details.executeReadyCases, ...details.needsReviewCases],
    noWritesPerformed: !executeRequested
  };

  if (executeRequested) {
    const result = await executeLevRepair();
    console.log(JSON.stringify({ ...summary, noWritesPerformed: false, ...result }, null, 2));
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
