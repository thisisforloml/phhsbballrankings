import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

const reportPath = "D:/OnCourt Rankings PH/scripts/reports/u19-la-salle-team-identity-repair-plan.json";
const targetAliases = new Set(["DLSU", "DLSZ", "LA SALLE", "DE LA SALLE SANTIAGO ZOBEL"]);

function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}

function publicSchoolDisplayName(name: string) {
  const alias = stripAgeGenderSuffix(name);
  return getUaapSchoolDisplayName(alias || name);
}

function normalizedAlias(name: string) {
  return stripAgeGenderSuffix(name).trim().replace(/\s+/g, " ").toUpperCase();
}

function inferGender(...values: string[]) {
  return values.join(" ").toLowerCase().includes("girls") ? "GIRLS" : "BOYS";
}

function proposedCanonicalTeamName(gender: "BOYS" | "GIRLS") {
  return gender === "GIRLS" ? "DLSZ U19 Girls" : "DLSZ U19 Boys";
}

async function main() {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: {
        deletedAt: null,
        league: {
          deletedAt: null,
          ageGroup: "U19"
        }
      },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: {
        where: { deletedAt: null },
        select: { id: true, teamId: true, points: true }
      }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });

  const affectedGames = games.filter((game) => {
    const homeAlias = normalizedAlias(game.homeTeam.name);
    const awayAlias = normalizedAlias(game.awayTeam.name);
    return targetAliases.has(homeAlias) || targetAliases.has(awayAlias);
  });

  const exactGames = affectedGames.map((game) => {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const affectedSides = [
      { side: "home", team: game.homeTeam },
      { side: "away", team: game.awayTeam }
    ].filter(({ team }) => targetAliases.has(normalizedAlias(team.name)));

    return {
      gameId: game.id,
      gameNumber: game.gameNumber,
      league: game.season.league.name,
      season: game.season.name,
      ageGroup: game.season.league.ageGroup,
      gender,
      gameDate: game.gameDate.toISOString(),
      homeTeam: {
        id: game.homeTeam.id,
        name: game.homeTeam.name,
        publicSchoolDisplayName: publicSchoolDisplayName(game.homeTeam.name)
      },
      awayTeam: {
        id: game.awayTeam.id,
        name: game.awayTeam.name,
        publicSchoolDisplayName: publicSchoolDisplayName(game.awayTeam.name)
      },
      scores: {
        homeScore: game.homeScore,
        awayScore: game.awayScore
      },
      affectedTeams: affectedSides.map(({ side, team }) => ({
        side,
        teamId: team.id,
        teamName: team.name,
        gameStatsCountForAffectedTeam: game.stats.filter((stat) => stat.teamId === team.id).length,
        proposedTeamName: proposedCanonicalTeamName(gender)
      }))
    };
  });

  const canonicalTeamNames = ["DLSZ U19 Boys", "DLSZ U19 Girls"];
  const canonicalTeamRecords = await Promise.all(canonicalTeamNames.map(async (name) => {
    const activeMatches = await prisma.team.findMany({
      where: { name, deletedAt: null },
      select: { id: true, name: true, city: true, region: true, deletedAt: true },
      orderBy: { createdAt: "asc" }
    });

    return {
      targetTeamName: name,
      activeMatchingRecordsAlreadyExist: activeMatches.length > 0,
      matchingRecords: activeMatches,
      action: activeMatches.length > 0 ? "reuse" : "create"
    };
  }));

  const reassignmentByCurrentTeam = new Map<string, {
    currentTeamId: string;
    currentTeamName: string;
    publicSchoolDisplayName: string;
    ageGroup: "U19";
    gender: "BOYS" | "GIRLS";
    league: string;
    season: string;
    games: Set<string>;
    gameNumbers: Set<string>;
    gameStatsCount: number;
    proposedTeamName: string;
  }>();

  for (const game of affectedGames) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    for (const team of [game.homeTeam, game.awayTeam]) {
      if (!targetAliases.has(normalizedAlias(team.name))) continue;
      const key = [game.season.league.id, game.season.id, gender, team.id].join("|");
      const row = reassignmentByCurrentTeam.get(key) ?? {
        currentTeamId: team.id,
        currentTeamName: team.name,
        publicSchoolDisplayName: publicSchoolDisplayName(team.name),
        ageGroup: "U19",
        gender,
        league: game.season.league.name,
        season: game.season.name,
        games: new Set<string>(),
        gameNumbers: new Set<string>(),
        gameStatsCount: 0,
        proposedTeamName: proposedCanonicalTeamName(gender)
      };
      row.games.add(game.id);
      if (game.gameNumber) row.gameNumbers.add(game.gameNumber);
      row.gameStatsCount += game.stats.filter((stat) => stat.teamId === team.id).length;
      reassignmentByCurrentTeam.set(key, row);
    }
  }

  const proposedReassignment = [...reassignmentByCurrentTeam.values()].map((row) => ({
    currentTeamId: row.currentTeamId,
    currentTeamName: row.currentTeamName,
    publicSchoolDisplayName: row.publicSchoolDisplayName,
    ageGroup: row.ageGroup,
    gender: row.gender,
    league: row.league,
    season: row.season,
    gamesAffected: row.games.size,
    gameNumbers: [...row.gameNumbers].sort(),
    gameStatsAffected: row.gameStatsCount,
    proposedTeamName: row.proposedTeamName
  })).sort((a, b) => a.gender.localeCompare(b.gender) || a.currentTeamName.localeCompare(b.currentTeamName));

  const scopeCounts = await Promise.all(["BOYS", "GIRLS"].map(async (gender) => {
    const scopeGames = games.filter((game) => inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name) === gender);
    const gameStatsCount = scopeGames.reduce((sum, game) => sum + game.stats.length, 0);
    const pointTotals = scopeGames.map((game) => {
      const summedHomePlayerPoints = game.stats.filter((stat) => stat.teamId === game.homeTeamId).reduce((sum, stat) => sum + stat.points, 0);
      const summedAwayPlayerPoints = game.stats.filter((stat) => stat.teamId === game.awayTeamId).reduce((sum, stat) => sum + stat.points, 0);
      return {
        gameId: game.id,
        gameNumber: game.gameNumber,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        summedHomePlayerPoints,
        summedAwayPlayerPoints,
        pass: summedHomePlayerPoints === game.homeScore && summedAwayPlayerPoints === game.awayScore
      };
    });

    return {
      ageGroup: "U19",
      gender,
      activeGameCount: scopeGames.length,
      activeGameStatsCount: gameStatsCount,
      pointTotalsPass: pointTotals.every((row) => row.pass),
      pointTotalFailures: pointTotals.filter((row) => !row.pass)
    };
  }));

  const u16LaSalleTeams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      name: { contains: "DLSZ" }
    },
    select: { id: true, name: true, city: true, region: true },
    orderBy: { name: "asc" }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    diagnostic: "u19-la-salle-team-identity-repair-plan",
    targetInternalTeams: canonicalTeamRecords,
    exactAffectedGames: exactGames,
    proposedReassignment: {
      summary: "Reassign U19 Boys DLSU/DLSZ/LA SALLE games and GameStats to DLSZ U19 Boys; reassign U19 Girls DLSU/LA SALLE games and GameStats to DLSZ U19 Girls.",
      byCurrentTeam: proposedReassignment
    },
    safetyChecks: {
      noU16TeamRecordsModified: true,
      noUnrelatedU19TeamsModified: true,
      u19BoysActiveGameCountRemains: {
        expected: 62,
        actual: scopeCounts.find((row) => row.gender === "BOYS")?.activeGameCount,
        pass: scopeCounts.find((row) => row.gender === "BOYS")?.activeGameCount === 62
      },
      u19GirlsActiveGameCountRemains: {
        expected: 14,
        actual: scopeCounts.find((row) => row.gender === "GIRLS")?.activeGameCount,
        pass: scopeCounts.find((row) => row.gender === "GIRLS")?.activeGameCount === 14
      },
      u19BoysGameStatsRemain: {
        expected: 1554,
        actual: scopeCounts.find((row) => row.gender === "BOYS")?.activeGameStatsCount,
        pass: scopeCounts.find((row) => row.gender === "BOYS")?.activeGameStatsCount === 1554
      },
      u19GirlsGameStatsRemain: {
        expected: 331,
        actual: scopeCounts.find((row) => row.gender === "GIRLS")?.activeGameStatsCount,
        pass: scopeCounts.find((row) => row.gender === "GIRLS")?.activeGameStatsCount === 331
      },
      pointTotalsRemainPassing: {
        pass: scopeCounts.every((row) => row.pointTotalsPass),
        failures: scopeCounts.flatMap((row) => row.pointTotalFailures)
      },
      u16LaSalleTeamRecordsObservedButNotInScope: u16LaSalleTeams
    },
    ratingsImpact: {
      gamePerformanceScoreDependsOnTeamId: false,
      playerRatingDependsOnTeamId: false,
      rankingSnapshotDependsOnTeamId: false,
      explanation: "GamePerformanceScore stores gameId, gameStatId, playerId, formulaVersionId, and score fields; it does not store Team ID. PlayerRating stores playerId and ageGroup; RankingSnapshotRow stores playerId. If only Game.homeTeamId, Game.awayTeamId, and GameStat.teamId are reassigned while GameStat IDs, player IDs, and stat values remain unchanged, player score/rating/snapshot recomputation is not needed.",
      recomputationNeeded: false
    },
    recommendedRepairPlan: [
      "Get explicit approval before any data repair.",
      "Create DLSZ U19 Boys if no active matching Team record exists; otherwise reuse it.",
      "Create DLSZ U19 Girls if no active matching Team record exists; otherwise reuse it.",
      "Within one transaction, update only affected U19 Boys Game.homeTeamId/awayTeamId and matching GameStat.teamId from DLSU, DLSZ, and LA SALLE to DLSZ U19 Boys.",
      "Within the same transaction, update only affected U19 Girls Game.homeTeamId/awayTeamId and matching GameStat.teamId from DLSU and LA SALLE to DLSZ U19 Girls.",
      "Do not modify U16 team records or unrelated U19 teams.",
      "After repair, rerun count and point-total validation, then verify dynamic /teams shows U19 Boys 8 public teams and U19 Girls 4 public teams."
    ]
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    reportPath,
    readOnly: true,
    affectedGames: exactGames.length,
    proposedTeamActions: canonicalTeamRecords.map((row) => ({
      targetTeamName: row.targetTeamName,
      action: row.action,
      activeMatchingRecordsAlreadyExist: row.activeMatchingRecordsAlreadyExist
    })),
    proposedReassignment,
    safetyChecks: report.safetyChecks,
    ratingsImpact: report.ratingsImpact
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
