import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const canonicalTeamId = "08b4a2a4-670b-4a02-a88b-4a6151c0c343";
const sourceTeamId = "7543e4de-09d2-45e5-869e-341a760b59b8";
const programName = "San Sebastian College-Recoletos";
const leagueName = "NCAA Season 101 Junior's Basketball";
const seasonName = "Season 101";
const expectedGameNumbers = [
  "NCAA-S101-JRB-009",
  "NCAA-S101-JRB-013",
  "NCAA-S101-JRB-018",
  "NCAA-S101-JRB-021",
  "NCAA-S101-JRB-027",
  "NCAA-S101-JRB-031",
  "NCAA-S101-JRB-037",
  "NCAA-S101-JRB-041",
  "NCAA-S101-JB-049",
  "NCAA-S101-JB-054",
  "NCAA-S101-JB-059",
  "NCAA-S101-JB-062",
  "NCAA-S101-JB-066",
  "NCAA-S101-JB-071"
];

function fail(message: string): never {
  throw new Error(message);
}

function inferGender(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "Girls" : "Boys";
}

function sorted(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).slice().sort((left, right) => left.localeCompare(right));
}

function sameSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function countActiveGames(teamId: string) {
  return prisma.game.count({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
    }
  });
}

async function countActiveGameStats(teamId: string) {
  return prisma.gameStat.count({
    where: {
      teamId,
      deletedAt: null,
      game: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }
    }
  });
}

async function countSameContextDuplicateGroups(programId: string) {
  const teams = await prisma.team.findMany({
    where: { programId, deletedAt: null },
    include: {
      homeGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } } } },
      awayGames: { where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null } } }, include: { season: { include: { league: true } } } }
    }
  });

  const contextTeams = new Map<string, Set<string>>();
  for (const team of teams) {
    const gameMap = new Map([...team.homeGames, ...team.awayGames].map((game) => [game.id, game]));
    for (const game of gameMap.values()) {
      const gender = inferGender(game.season.league.name, team.name);
      const key = `${game.season.league.ageGroup}|${gender}|${game.season.league.name}|${game.season.name}`;
      const teamIds = contextTeams.get(key) ?? new Set<string>();
      teamIds.add(team.id);
      contextTeams.set(key, teamIds);
    }
  }

  return Array.from(contextTeams.entries())
    .filter(([key, teamIds]) => key === `U19|Boys|${leagueName}|${seasonName}` && teamIds.size > 1)
    .map(([key, teamIds]) => ({ key, teamIds: Array.from(teamIds).sort() }));
}

async function main() {
  const [canonicalTeam, sourceTeam] = await Promise.all([
    prisma.team.findFirst({ where: { id: canonicalTeamId, deletedAt: null }, include: { program: true } }),
    prisma.team.findFirst({ where: { id: sourceTeamId, deletedAt: null }, include: { program: true } })
  ]);

  if (!canonicalTeam) fail("Canonical team was not found or is deleted.");
  if (!sourceTeam) fail("Source duplicate team was not found or is deleted.");
  if (canonicalTeam.name !== "SSC-R U19 Boys") fail(`Canonical team name mismatch: ${canonicalTeam.name}`);
  if (sourceTeam.name !== "SSCR U19 Boys") fail(`Source team name mismatch: ${sourceTeam.name}`);
  if (!canonicalTeam.programId) fail("Canonical team has no Program.");
  if (canonicalTeam.programId !== sourceTeam.programId) fail("Canonical and source teams do not share the same Program.");
  if (canonicalTeam.program?.fullName !== programName) fail(`Unexpected Program: ${canonicalTeam.program?.fullName ?? "none"}`);

  const before = {
    sourceActiveGames: await countActiveGames(sourceTeamId),
    sourceActiveGameStats: await countActiveGameStats(sourceTeamId),
    canonicalActiveGames: await countActiveGames(canonicalTeamId),
    canonicalActiveGameStats: await countActiveGameStats(canonicalTeamId),
    activeGameStats: await prisma.gameStat.count({ where: { deletedAt: null } }),
    gamePerformanceScores: await prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count()
  };

  const affectedGames = await prisma.game.findMany({
    where: {
      deletedAt: null,
      OR: [{ homeTeamId: sourceTeamId }, { awayTeamId: sourceTeamId }],
      season: { name: seasonName, deletedAt: null, league: { name: leagueName, ageGroup: "U19", deletedAt: null } }
    },
    include: { season: { include: { league: true } }, homeTeam: true, awayTeam: true, stats: { where: { deletedAt: null, teamId: sourceTeamId }, select: { id: true } } },
    orderBy: { gameNumber: "asc" }
  });

  const actualGameNumbers = sorted(affectedGames.map((game) => game.gameNumber));
  if (!sameSet(actualGameNumbers, sorted(expectedGameNumbers))) {
    fail(`Affected game numbers did not match approved set. Actual: ${actualGameNumbers.join(", ")}`);
  }

  const invalidScopeGames = affectedGames.filter((game) => {
    const gender = inferGender(game.season.league.name, sourceTeam.name, game.homeTeam.name, game.awayTeam.name);
    return game.season.league.ageGroup !== "U19" || gender !== "Boys" || game.season.league.name !== leagueName || game.season.name !== seasonName;
  });
  if (invalidScopeGames.length) fail(`Found games outside approved U19 Boys NCAA Season 101 scope: ${invalidScopeGames.map((game) => game.gameNumber).join(", ")}`);

  const affectedGameIds = affectedGames.map((game) => game.id);
  const affectedGameStats = await prisma.gameStat.count({
    where: { teamId: sourceTeamId, deletedAt: null, gameId: { in: affectedGameIds } }
  });

  if (before.sourceActiveGames !== 14) fail(`Expected source activeGames before repair = 14, got ${before.sourceActiveGames}`);
  if (before.sourceActiveGameStats !== 174) fail(`Expected source activeGameStats before repair = 174, got ${before.sourceActiveGameStats}`);
  if (before.canonicalActiveGames !== 1) fail(`Expected canonical activeGames before repair = 1, got ${before.canonicalActiveGames}`);
  if (before.canonicalActiveGameStats !== 14) fail(`Expected canonical activeGameStats before repair = 14, got ${before.canonicalActiveGameStats}`);
  if (before.activeGameStats !== 5363) fail(`Expected active GameStat count before repair = 5363, got ${before.activeGameStats}`);
  if (affectedGames.length !== 14) fail(`Expected 14 affected games, got ${affectedGames.length}`);
  if (affectedGameStats !== 174) fail(`Expected 174 affected GameStats, got ${affectedGameStats}`);

  const repairResult = await prisma.$transaction(async (tx) => {
    const homeGames = await tx.game.updateMany({
      where: { id: { in: affectedGameIds }, homeTeamId: sourceTeamId, deletedAt: null },
      data: { homeTeamId: canonicalTeamId }
    });
    const awayGames = await tx.game.updateMany({
      where: { id: { in: affectedGameIds }, awayTeamId: sourceTeamId, deletedAt: null },
      data: { awayTeamId: canonicalTeamId }
    });
    const gameStats = await tx.gameStat.updateMany({
      where: { gameId: { in: affectedGameIds }, teamId: sourceTeamId, deletedAt: null },
      data: { teamId: canonicalTeamId }
    });
    return { homeGamesUpdated: homeGames.count, awayGamesUpdated: awayGames.count, gameStatsUpdated: gameStats.count };
  });

  const after = {
    sourceActiveGames: await countActiveGames(sourceTeamId),
    sourceActiveGameStats: await countActiveGameStats(sourceTeamId),
    canonicalActiveGames: await countActiveGames(canonicalTeamId),
    canonicalActiveGameStats: await countActiveGameStats(canonicalTeamId),
    activeGameStats: await prisma.gameStat.count({ where: { deletedAt: null } }),
    gamePerformanceScores: await prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    playerRatings: await prisma.playerRating.count(),
    rankingSnapshots: await prisma.rankingSnapshot.count(),
    rankingSnapshotRows: await prisma.rankingSnapshotRow.count(),
    duplicateContextGroups: await countSameContextDuplicateGroups(canonicalTeam.programId)
  };

  const validation = {
    sourceTeamNoActiveUsage: after.sourceActiveGames === 0 && after.sourceActiveGameStats === 0,
    canonicalTeamExpectedUsage: after.canonicalActiveGames === 15 && after.canonicalActiveGameStats === 188,
    noActiveSameContextDuplicateRemains: after.duplicateContextGroups.length === 0,
    activeGameStatCountUnchanged: before.activeGameStats === after.activeGameStats && after.activeGameStats === 5363,
    gamePerformanceScoreCountUnchanged: before.gamePerformanceScores === after.gamePerformanceScores,
    playerRatingCountUnchanged: before.playerRatings === after.playerRatings,
    rankingSnapshotCountUnchanged: before.rankingSnapshots === after.rankingSnapshots,
    rankingSnapshotRowCountUnchanged: before.rankingSnapshotRows === after.rankingSnapshotRows
  };

  const validationPassed = Object.values(validation).every(Boolean);
  if (!validationPassed) fail(`Post-repair validation failed: ${JSON.stringify(validation)}`);

  console.log(JSON.stringify({
    repairScriptPath: "scripts/repair-san-sebastian-u19-team-identity.ts",
    approvedScope: { programName, leagueName, seasonName, ageGroup: "U19", gender: "Boys" },
    canonicalTeam: { id: canonicalTeam.id, name: canonicalTeam.name },
    sourceTeamRetiredToLegacy: { id: sourceTeam.id, name: sourceTeam.name, deleted: false },
    expectedAffected: { games: 14, gameStats: 174 },
    before,
    repairResult,
    affectedGameNumbers: actualGameNumbers,
    after,
    validation,
    validationPassed
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


