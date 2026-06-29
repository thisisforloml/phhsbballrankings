import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../src/lib/prisma";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

const reportPath = "D:/Peach Basket/scripts/reports/u19-gender-shared-team-repair-plan.json";
const targetAliases = new Set(["ATENEO", "ATENEO JRS", "NU", "NU JRS", "NUNS", "UST", "UST JRS"]);
const expectedTeamNames = [
  "ATENEO U19 Boys",
  "ATENEO U19 Girls",
  "NU U19 Boys",
  "NU U19 Girls",
  "UST U19 Boys",
  "UST U19 Girls"
];

function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}

function normalizeAlias(name: string) {
  return stripAgeGenderSuffix(name).trim().replace(/\s+/g, " ").toUpperCase();
}

function publicSchoolDisplayName(name: string) {
  const alias = stripAgeGenderSuffix(name);
  return getUaapSchoolDisplayName(alias || name);
}

function inferGender(...values: string[]) {
  return values.join(" ").toLowerCase().includes("girls") ? "GIRLS" as const : "BOYS" as const;
}

function schoolPrefix(publicName: string) {
  const map: Record<string, string> = {
    "Ateneo de Manila University": "ATENEO",
    "National University Nazareth School": "NU",
    "University of Santo Tomas": "UST"
  };
  return map[publicName] ?? publicName;
}

function proposedTeamName(publicName: string, gender: "BOYS" | "GIRLS") {
  return `${schoolPrefix(publicName)} U19 ${gender === "BOYS" ? "Boys" : "Girls"}`;
}

async function main() {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null, ageGroup: "U19" } },
      homeTeam: { deletedAt: null },
      awayTeam: { deletedAt: null }
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true, points: true } }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });

  const targetTeamIds = new Set<string>();
  for (const game of games) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      if (targetAliases.has(normalizeAlias(team.name)) || ["Ateneo de Manila University", "National University Nazareth School", "University of Santo Tomas"].includes(publicSchoolDisplayName(team.name))) {
        targetTeamIds.add(team.id);
      }
    }
  }

  const usage = new Map<string, {
    teamId: string;
    teamName: string;
    publicSchoolDisplayName: string;
    boysGames: Set<string>;
    boysGameNumbers: Set<string>;
    boysGameStatsCount: number;
    girlsGames: Set<string>;
    girlsGameNumbers: Set<string>;
    girlsGameStatsCount: number;
    boysAffectedGames: Array<Record<string, unknown>>;
    girlsAffectedGames: Array<Record<string, unknown>>;
  }>();

  const pointTotalFailures: Array<Record<string, unknown>> = [];
  const scopeCounts = {
    BOYS: { games: 0, gameStats: 0 },
    GIRLS: { games: 0, gameStats: 0 }
  };

  for (const game of games) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    scopeCounts[gender].games += 1;
    scopeCounts[gender].gameStats += game.stats.length;

    const summedHomePlayerPoints = game.stats.filter((stat) => stat.teamId === game.homeTeamId).reduce((sum, stat) => sum + stat.points, 0);
    const summedAwayPlayerPoints = game.stats.filter((stat) => stat.teamId === game.awayTeamId).reduce((sum, stat) => sum + stat.points, 0);
    if (summedHomePlayerPoints !== game.homeScore || summedAwayPlayerPoints !== game.awayScore) {
      pointTotalFailures.push({
        gameId: game.id,
        gameNumber: game.gameNumber,
        gender,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        summedHomePlayerPoints,
        summedAwayPlayerPoints
      });
    }

    for (const side of ["home", "away"] as const) {
      const team = side === "home" ? game.homeTeam : game.awayTeam;
      if (!targetTeamIds.has(team.id)) continue;

      const publicName = publicSchoolDisplayName(team.name);
      const row = usage.get(team.id) ?? {
        teamId: team.id,
        teamName: team.name,
        publicSchoolDisplayName: publicName,
        boysGames: new Set<string>(),
        boysGameNumbers: new Set<string>(),
        boysGameStatsCount: 0,
        girlsGames: new Set<string>(),
        girlsGameNumbers: new Set<string>(),
        girlsGameStatsCount: 0,
        boysAffectedGames: [],
        girlsAffectedGames: []
      };
      const statCount = game.stats.filter((stat) => stat.teamId === team.id).length;
      const gameDetail = {
        gameId: game.id,
        gameNumber: game.gameNumber,
        league: game.season.league.name,
        season: game.season.name,
        gender,
        side,
        homeTeam: { id: game.homeTeam.id, name: game.homeTeam.name },
        awayTeam: { id: game.awayTeam.id, name: game.awayTeam.name },
        scores: { homeScore: game.homeScore, awayScore: game.awayScore },
        gameStatsCountForTeam: statCount
      };

      if (gender === "BOYS") {
        row.boysGames.add(game.id);
        if (game.gameNumber) row.boysGameNumbers.add(game.gameNumber);
        row.boysGameStatsCount += statCount;
        row.boysAffectedGames.push(gameDetail);
      } else {
        row.girlsGames.add(game.id);
        if (game.gameNumber) row.girlsGameNumbers.add(game.gameNumber);
        row.girlsGameStatsCount += statCount;
        row.girlsAffectedGames.push(gameDetail);
      }
      usage.set(team.id, row);
    }
  }

  const sharedTeamRecords = [...usage.values()]
    .filter((row) => row.boysGames.size > 0 && row.girlsGames.size > 0)
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      publicSchoolDisplayName: row.publicSchoolDisplayName,
      boysGamesCount: row.boysGames.size,
      boysGameStatsCount: row.boysGameStatsCount,
      girlsGamesCount: row.girlsGames.size,
      girlsGameStatsCount: row.girlsGameStatsCount,
      boysGameNumbers: [...row.boysGameNumbers].sort(),
      girlsGameNumbers: [...row.girlsGameNumbers].sort(),
      boysAffectedGames: row.boysAffectedGames,
      girlsAffectedGames: row.girlsAffectedGames
    }))
    .sort((a, b) => a.publicSchoolDisplayName.localeCompare(b.publicSchoolDisplayName) || a.teamName.localeCompare(b.teamName));

  const expectedTeamRecords = await Promise.all(expectedTeamNames.map(async (name) => {
    const records = await prisma.team.findMany({
      where: { name, deletedAt: null },
      select: { id: true, name: true, city: true, region: true, deletedAt: true },
      orderBy: { createdAt: "asc" }
    });
    return {
      targetTeamName: name,
      activeMatchingRecordsAlreadyExist: records.length > 0,
      matchingRecords: records,
      action: records.length > 0 ? "reuse" : "create"
    };
  }));

  const proposedReassignment = sharedTeamRecords.flatMap((team) => [
    {
      publicSchoolDisplayName: team.publicSchoolDisplayName,
      currentTeamId: team.teamId,
      currentTeamName: team.teamName,
      currentGenderUsage: "BOYS",
      proposedTeamName: proposedTeamName(team.publicSchoolDisplayName, "BOYS"),
      gamesAffected: team.boysGamesCount,
      gameNumbers: team.boysGameNumbers,
      gameStatsAffected: team.boysGameStatsCount,
      action: "reassign U19 Boys games/GameStats to U19 Boys team"
    },
    {
      publicSchoolDisplayName: team.publicSchoolDisplayName,
      currentTeamId: team.teamId,
      currentTeamName: team.teamName,
      currentGenderUsage: "GIRLS",
      proposedTeamName: proposedTeamName(team.publicSchoolDisplayName, "GIRLS"),
      gamesAffected: team.girlsGamesCount,
      gameNumbers: team.girlsGameNumbers,
      gameStatsAffected: team.girlsGameStatsCount,
      action: "reassign U19 Girls games/GameStats to U19 Girls team"
    }
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    diagnostic: "u19-gender-shared-team-identity-repair-plan",
    problem: "Ateneo, NU, and UST U19 Boys/Girls appear to share internal Team records. Boys and girls rosters must have separate Team records even when they share public school display names.",
    targetSchools: ["Ateneo de Manila University", "National University Nazareth School", "University of Santo Tomas"],
    sharedTeamRecords,
    targetTeamRecords: expectedTeamRecords,
    proposedRepairPlan: {
      summary: "Create or reuse gender-specific U19 Team records, then reassign only U19 Boys usage to the Boys team and U19 Girls usage to the Girls team for each affected school.",
      byCurrentTeamAndGender: proposedReassignment,
      recommendedSteps: [
        "Get explicit approval before data repair.",
        "Create missing active Team records for ATENEO/NU/UST U19 Boys and Girls, or reuse existing matching records.",
        "In one transaction per repair script, update only affected U19 Games and GameStats for the shared Team records listed in this report.",
        "Do not touch U16 teams or unrelated U19 teams.",
        "Preserve game scores, GameStat IDs, player IDs, and stat values.",
        "Run post-repair count, point-total, and dynamic /teams validation."
      ]
    },
    safetyChecks: {
      noU16TeamsTouchedInPlan: true,
      noUnrelatedTeamsTouchedInPlan: true,
      u19BoysActiveGameCountRemains: { expected: 62, actual: scopeCounts.BOYS.games, pass: scopeCounts.BOYS.games === 62 },
      u19GirlsActiveGameCountRemains: { expected: 14, actual: scopeCounts.GIRLS.games, pass: scopeCounts.GIRLS.games === 14 },
      u19BoysGameStatsRemain: { expected: 1554, actual: scopeCounts.BOYS.gameStats, pass: scopeCounts.BOYS.gameStats === 1554 },
      u19GirlsGameStatsRemain: { expected: 331, actual: scopeCounts.GIRLS.gameStats, pass: scopeCounts.GIRLS.gameStats === 331 },
      pointTotalsRemainPassing: { pass: pointTotalFailures.length === 0, failures: pointTotalFailures }
    },
    ratingsImpact: {
      ratingsRecomputationNeeded: false,
      gamePerformanceScoreDependsOnTeamId: false,
      playerRatingDependsOnTeamId: false,
      rankingSnapshotDependsOnTeamId: false,
      explanation: "GamePerformanceScore stores gameId, gameStatId, playerId, formulaVersionId, and score fields; PlayerRating stores playerId and ageGroup; RankingSnapshotRow stores playerId. If only Game.homeTeamId/awayTeamId and GameStat.teamId are reassigned while GameStat IDs, player IDs, and stat values remain unchanged, ratings recomputation is not needed."
    }
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    reportPath,
    readOnly: true,
    sharedTeamRecords: sharedTeamRecords.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      publicSchoolDisplayName: team.publicSchoolDisplayName,
      boysGamesCount: team.boysGamesCount,
      boysGameStatsCount: team.boysGameStatsCount,
      girlsGamesCount: team.girlsGamesCount,
      girlsGameStatsCount: team.girlsGameStatsCount,
      boysGameNumbers: team.boysGameNumbers,
      girlsGameNumbers: team.girlsGameNumbers
    })),
    targetTeamRecords: expectedTeamRecords,
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
