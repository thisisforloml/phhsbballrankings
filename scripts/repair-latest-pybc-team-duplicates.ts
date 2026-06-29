import { prisma } from "../src/lib/prisma";
import { normalizeCompetitionDisplayName } from "../src/lib/competition-naming";

type Repair = {
  participantName: string;
  programId: string;
  canonicalTeamId: string;
  canonicalTeamName: string;
  duplicateTeamId: string;
  duplicateTeamName: string;
  approvedGameNumbers: string[];
  expectedGameStats: number;
  note: string;
};

const repairs: Repair[] = [
  {
    participantName: "JMTG Medical Trading Infinite",
    programId: "7e62a36c-4691-497a-990f-201a0ca42810",
    canonicalTeamId: "bf8f1578-6a68-4991-9966-da32aff82f60",
    canonicalTeamName: "JMTG Medical Trading Infinite",
    duplicateTeamId: "c17caa40-d059-4348-ad63-3b31f5b35b80",
    duplicateTeamName: "JMTG Medical Trading Infinite U16 Boys",
    approvedGameNumbers: ["G-2025-032"],
    expectedGameStats: 14,
    note: "Suffix/internal Team was reused by the latest PYBC publish."
  },
  {
    participantName: "LEV Construction Full Potential",
    programId: "b668fd23-c767-4c14-9659-8b2d418fd36a",
    canonicalTeamId: "aae3a772-c203-4dc0-bd87-35015466c6ea",
    canonicalTeamName: "LEV Construction Full Potential",
    duplicateTeamId: "fba904cf-34c0-46af-9a23-dd701a32a2e2",
    duplicateTeamName: "Lev Construction Full Potential U16 Boys",
    approvedGameNumbers: ["G-2025-031"],
    expectedGameStats: 12,
    note: "Case-only Program duplicate remains separate; this repair only fixes the active suffix Team under the current Program."
  },
  {
    participantName: "Migrafix Doc Boleros",
    programId: "132b41bb-5470-4a52-b295-5625177566cd",
    canonicalTeamId: "f0063ff0-31f0-45ad-8efe-86905b479163",
    canonicalTeamName: "Migrafix Doc Boleros",
    duplicateTeamId: "c66313bf-145d-4486-a5a0-a207b1c4aa94",
    duplicateTeamName: "Migrafix Doc Boleros U16 Boys",
    approvedGameNumbers: ["G-2025-031", "G-2025-034", "G-2025-036"],
    expectedGameStats: 41,
    note: "Suffix/internal Team was reused by the latest PYBC publish."
  },
  {
    participantName: "Migueluz Trading Moderno",
    programId: "68b06396-32af-4b8c-9c5d-7ff2fbb5817d",
    canonicalTeamId: "efbfd74c-0a70-4764-82df-65f2a883b92b",
    canonicalTeamName: "Migueluz Trading Moderno",
    duplicateTeamId: "efcab0cf-4a7e-4c2c-a010-98a13e0beecb",
    duplicateTeamName: "Migueluz Trading Moderno U16 Boys",
    approvedGameNumbers: ["G-2025-030", "G-2025-037"],
    expectedGameStats: 27,
    note: "Suffix/internal Team was reused by the latest PYBC publish."
  },
  {
    participantName: "Prime Ascencion Medical Supplies San Anton",
    programId: "10bdfbd4-397c-4f00-a29d-6fc6bb2b76f2",
    canonicalTeamId: "5a0d52b6-a998-455f-b5ab-4c8ea538e32a",
    canonicalTeamName: "Prime Ascencion Medical Supplies San Anton",
    duplicateTeamId: "cfcaa1ea-9166-458b-9140-fd8df2d7507e",
    duplicateTeamName: "Prime Ascencion Medical Supplies San Anton U16 Boys",
    approvedGameNumbers: ["G-2025-032", "G-2025-035"],
    expectedGameStats: 23,
    note: "Suffix/internal Team was reused by the latest PYBC publish."
  },
  {
    participantName: "Smile 360 Bullies",
    programId: "58f9e2a2-fe97-44bf-b4d7-caf0164637d9",
    canonicalTeamId: "48b03b46-91b7-4acb-9b85-1a8278c33773",
    canonicalTeamName: "Smile 360 Bullies",
    duplicateTeamId: "b961adec-77e3-4b3b-ab2e-d1868644a633",
    duplicateTeamName: "SMILE 360 BULLIES U16 Boys",
    approvedGameNumbers: ["G-2025-030", "G-2025-034"],
    expectedGameStats: 26,
    note: "Uppercase suffix Team is equivalent to the canonical clean Team by Program and PYBC evidence."
  },
  {
    participantName: "San Pedro Spartans",
    programId: "b5c79a29-bd7b-47ce-ac9c-4d15f1fbb711",
    canonicalTeamId: "26ce5dc4-0667-4710-ab1b-53d4a13d8d61",
    canonicalTeamName: "San Pedro Spartans",
    duplicateTeamId: "8b564cd2-c365-47d6-b0e6-9c461c1454c3",
    duplicateTeamName: "San Pedro Spartans U16 Boys",
    approvedGameNumbers: ["G-2025-029", "G-2025-033", "G-2025-035", "G-2025-036", "G-2025-037"],
    expectedGameStats: 67,
    note: "User-confirmed San Pedro Spartans identity; stale SPARTANS Team is not touched because it has zero active PYBC evidence."
  },
  {
    participantName: "JPM-TEC San Beda / SBU",
    programId: "65908829-cfda-4053-821c-47435a45e33e",
    canonicalTeamId: "8af1de8f-7e66-436b-9e2e-6c22d9add869",
    canonicalTeamName: "JPM-TEC San Beda",
    duplicateTeamId: "f2705e3c-8cb6-4c27-84e9-8941e6c8599a",
    duplicateTeamName: "SBU U16 Boys",
    approvedGameNumbers: ["G-2025-029", "G-2025-033"],
    expectedGameStats: 30,
    note: "User-confirmed current Program is JPM-TEC San Beda; SBU U16 Boys is already under that Program and has PYBC-only evidence."
  }
];

function isExecuteRequested() {
  return process.argv.includes("--execute");
}

function isRepairRequested() {
  return process.argv.includes("--repair-latest-pybc-team-duplicates");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

async function loadRepairEvidence(repair: Repair) {
  const [program, canonicalTeam, duplicateTeam, duplicateGames, duplicateGameStats] = await Promise.all([
    prisma.program.findFirst({ where: { id: repair.programId, deletedAt: null }, select: { id: true, fullName: true } }),
    prisma.team.findFirst({ where: { id: repair.canonicalTeamId, deletedAt: null }, select: { id: true, name: true, programId: true } }),
    prisma.team.findFirst({ where: { id: repair.duplicateTeamId, deletedAt: null }, select: { id: true, name: true, programId: true } }),
    prisma.game.findMany({
      where: {
        deletedAt: null,
        OR: [{ homeTeamId: repair.duplicateTeamId }, { awayTeamId: repair.duplicateTeamId }],
        season: { deletedAt: null, league: { deletedAt: null } }
      },
      include: { season: { include: { league: true } } },
      orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
    }),
    prisma.gameStat.count({
      where: {
        deletedAt: null,
        teamId: repair.duplicateTeamId,
        game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }
      }
    })
  ]);

  const pybcGames = duplicateGames.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) === "PYBC 15U");
  const nonPybcGames = duplicateGames.filter((game) => normalizeCompetitionDisplayName(game.season.league.name) !== "PYBC 15U");
  const gameNumbers = uniqueSorted(pybcGames.map((game) => String(game.gameNumber)));
  const validations = {
    programExists: Boolean(program),
    canonicalTeamExists: Boolean(canonicalTeam),
    duplicateTeamExists: Boolean(duplicateTeam),
    canonicalTeamInProgram: canonicalTeam?.programId === repair.programId,
    duplicateTeamInProgram: duplicateTeam?.programId === repair.programId,
    duplicateHasPybcOnlyEvidence: nonPybcGames.length === 0,
    gameRefsMatch: sameStringSet(gameNumbers, repair.approvedGameNumbers),
    gameStatsMatch: duplicateGameStats === repair.expectedGameStats
  };
  const executeReady = Object.values(validations).every(Boolean);

  return {
    participantName: repair.participantName,
    executeReady,
    note: repair.note,
    program,
    canonicalTeam,
    duplicateTeam,
    approvedGameNumbers: repair.approvedGameNumbers,
    liveGameNumbers: gameNumbers,
    gamesToUpdate: pybcGames.map((game) => ({
      gameId: game.id,
      gameNumber: game.gameNumber,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      league: game.season.league.name,
      season: game.season.name
    })),
    gameStatsToUpdate: duplicateGameStats,
    validations
  };
}

async function buildDryRun() {
  const cases = await Promise.all(repairs.map(loadRepairEvidence));
  const executeReadyCases = cases.filter((item) => item.executeReady);
  return {
    mode: "latest-pybc-team-duplicates-dry-run",
    executeReady: executeReadyCases.length === repairs.length,
    guardrails: [
      "Scope is limited to the 8 known PYBC participant duplicate Team cases after the latest publish.",
      "Every duplicate Team must be under the same Program as its canonical Team.",
      "Every duplicate Team must have PYBC 15U evidence only.",
      "Exact game refs and GameStats counts are revalidated before writes.",
      "Execute requires --repair-latest-pybc-team-duplicates --execute.",
      "Only Game.homeTeamId, Game.awayTeamId, and GameStat.teamId are updated if executed.",
      "No Teams are deleted or merged. No players, stat values, ratings, snapshots, rankings, imports, or submissions are touched."
    ],
    summary: {
      casesInspected: cases.length,
      executeReadyCases: executeReadyCases.length,
      needsReviewCases: cases.length - executeReadyCases.length,
      teamReferencesToReassign: cases.reduce((sum, item) => sum + item.gamesToUpdate.length, 0),
      uniqueGameRowsAffected: new Set(cases.flatMap((item) => item.gamesToUpdate.map((game) => game.gameId))).size,
      gameStatsToReassign: cases.reduce((sum, item) => sum + item.gameStatsToUpdate, 0)
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

async function executeRepair() {
  const dryRun = await buildDryRun();
  if (!dryRun.executeReady) {
    throw new Error("Latest PYBC duplicate repair is not execute-ready. Run dry-run and inspect needs-review cases.");
  }

  const countsBefore = await protectedCounts();
  const result = await prisma.$transaction(async (tx) => {
    let homeGameRefsUpdated = 0;
    let awayGameRefsUpdated = 0;
    let gameStatsUpdated = 0;

    for (const repair of repairs) {
      const evidence = dryRun.cases.find((item) => item.participantName === repair.participantName);
      if (!evidence?.executeReady) throw new Error(`Repair case is not execute-ready: ${repair.participantName}`);
      const gameIds = evidence.gamesToUpdate.map((game) => game.gameId);

      const homeUpdate = await tx.game.updateMany({
        where: { id: { in: gameIds }, homeTeamId: repair.duplicateTeamId, deletedAt: null },
        data: { homeTeamId: repair.canonicalTeamId }
      });
      const awayUpdate = await tx.game.updateMany({
        where: { id: { in: gameIds }, awayTeamId: repair.duplicateTeamId, deletedAt: null },
        data: { awayTeamId: repair.canonicalTeamId }
      });
      const statUpdate = await tx.gameStat.updateMany({
        where: { gameId: { in: gameIds }, teamId: repair.duplicateTeamId, deletedAt: null },
        data: { teamId: repair.canonicalTeamId }
      });

      homeGameRefsUpdated += homeUpdate.count;
      awayGameRefsUpdated += awayUpdate.count;
      gameStatsUpdated += statUpdate.count;
    }

    return { homeGameRefsUpdated, awayGameRefsUpdated, gameStatsUpdated };
  });
  const countsAfter = await protectedCounts();
  const postDryRun = await buildDryRun();

  return {
    mode: "latest-pybc-team-duplicates-executed",
    repairsExecuted: repairs.length,
    result,
    protectedCounts: { before: countsBefore, after: countsAfter, unchanged: JSON.stringify(countsBefore) === JSON.stringify(countsAfter) },
    validation: {
      remainingDuplicateTeamRefs: postDryRun.summary.teamReferencesToReassign,
      remainingDuplicateGameStats: postDryRun.summary.gameStatsToReassign,
      validationPassed: postDryRun.summary.teamReferencesToReassign === 0 && postDryRun.summary.gameStatsToReassign === 0 && JSON.stringify(countsBefore) === JSON.stringify(countsAfter)
    }
  };
}

async function main() {
  if (!isRepairRequested()) {
    throw new Error("Use --repair-latest-pybc-team-duplicates for dry-run or --repair-latest-pybc-team-duplicates --execute for execution.");
  }

  const output = isExecuteRequested() ? await executeRepair() : await buildDryRun();
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
