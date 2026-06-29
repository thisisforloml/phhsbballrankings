import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

const planPath = "D:/Peach Basket/scripts/reports/u19-gender-shared-team-repair-plan.json";

const targetTeamNames = {
  "Ateneo de Manila University": { BOYS: "ATENEO U19 Boys", GIRLS: "ATENEO U19 Girls" },
  "National University Nazareth School": { BOYS: "NU U19 Boys", GIRLS: "NU U19 Girls" },
  "University of Santo Tomas": { BOYS: "UST U19 Boys", GIRLS: "UST U19 Girls" }
} as const;

const protectedDlszTeamNames = new Set(["DLSZ U19 Boys", "DLSZ U19 Girls"]);

type Gender = "BOYS" | "GIRLS";
type PublicSchool = keyof typeof targetTeamNames;
type PlanGame = {
  gameId: string;
  gameNumber: string | null;
  gender: Gender;
  side: "home" | "away";
  gameStatsCountForTeam: number;
};
type SharedTeamRecord = {
  teamId: string;
  teamName: string;
  publicSchoolDisplayName: PublicSchool;
  boysAffectedGames: PlanGame[];
  girlsAffectedGames: PlanGame[];
};
type RepairPlan = {
  diagnostic?: string;
  sharedTeamRecords?: SharedTeamRecord[];
};
type UsageSnapshot = {
  gameTeamPairs: string[];
  gameStatPairs: string[];
};
type CountSnapshot = {
  gamePerformanceScore: number;
  playerRating: number;
  rankingSnapshot: number;
  rankingSnapshotRow: number;
};
type TeamRow = { id: string; name: string };

type ScopeRow = {
  ageGroup: "U19";
  gender: Gender;
  league: string;
  season: string;
  activeGameCount: number;
  activeGameStatsCount: number;
  internalTeams: number;
  publicSchools: number;
  sharedTargetTeamRecords: Array<{ teamId: string; teamName: string; publicSchoolDisplayName: string; genders: Gender[] }>;
  pointTotalsPass: boolean;
  pointTotalFailures: Array<Record<string, unknown>>;
};

function stripAgeGenderSuffix(name: string) {
  return name.replace(/\s+U(?:13|16|19)\s+(?:Boys|Girls)$/i, "").trim();
}

function publicSchoolDisplayName(name: string) {
  const alias = stripAgeGenderSuffix(name);
  return getUaapSchoolDisplayName(alias || name);
}

function inferGender(...values: Array<string | null | undefined>): Gender {
  return values.filter(Boolean).join(" ").toLowerCase().includes("girls") ? "GIRLS" : "BOYS";
}

function assertPlan(plan: RepairPlan): asserts plan is Required<Pick<RepairPlan, "sharedTeamRecords">> & RepairPlan {
  if (plan.diagnostic !== "u19-gender-shared-team-identity-repair-plan") {
    throw new Error("Repair plan diagnostic name does not match U19 gender-shared team identity repair.");
  }
  if (!Array.isArray(plan.sharedTeamRecords) || plan.sharedTeamRecords.length !== 3) {
    throw new Error(`Expected 3 shared team records in repair plan, found ${plan.sharedTeamRecords?.length ?? 0}.`);
  }
  for (const record of plan.sharedTeamRecords) {
    if (!(record.publicSchoolDisplayName in targetTeamNames)) {
      throw new Error(`Unsupported public school in repair plan: ${record.publicSchoolDisplayName}.`);
    }
    if (!record.boysAffectedGames.length || !record.girlsAffectedGames.length) {
      throw new Error(`Expected both boys and girls affected games for ${record.teamName}.`);
    }
    for (const game of [...record.boysAffectedGames, ...record.girlsAffectedGames]) {
      if (game.gender !== "BOYS" && game.gender !== "GIRLS") throw new Error(`Unsupported gender for game ${game.gameNumber}.`);
      if (game.side !== "home" && game.side !== "away") throw new Error(`Unsupported side for game ${game.gameNumber}.`);
    }
  }
}

function sameArray(left: string[], right: string[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffPairs(before: string[], after: string[]) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    removed: before.filter((item) => !afterSet.has(item)),
    added: after.filter((item) => !beforeSet.has(item))
  };
}

async function getUsageSnapshot(ageGroup: "U16" | "U19"): Promise<UsageSnapshot> {
  const games = await prisma.game.findMany({
    where: { deletedAt: null, season: { deletedAt: null, league: { deletedAt: null, ageGroup } } },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
    }
  });

  return {
    gameTeamPairs: games.map((game) => `${game.id}:${game.homeTeamId}:${game.awayTeamId}`).sort(),
    gameStatPairs: games.flatMap((game) => game.stats.map((stat) => `${stat.id}:${stat.teamId}`)).sort()
  };
}

async function getCounts(): Promise<CountSnapshot> {
  const [gamePerformanceScore, playerRating, rankingSnapshot, rankingSnapshotRow] = await Promise.all([
    prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count()
  ]);
  return { gamePerformanceScore, playerRating, rankingSnapshot, rankingSnapshotRow };
}

async function getDlszU19Snapshot(): Promise<UsageSnapshot> {
  const teams = await prisma.team.findMany({ where: { name: { in: [...protectedDlszTeamNames] }, deletedAt: null }, select: { id: true } });
  const teamIds = teams.map((team) => team.id);
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null, ageGroup: "U19" } },
      OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }, { stats: { some: { teamId: { in: teamIds }, deletedAt: null } } }]
    },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      stats: { where: { deletedAt: null, teamId: { in: teamIds } }, select: { id: true, teamId: true } }
    }
  });
  return {
    gameTeamPairs: games.flatMap((game) => [game.homeTeamId, game.awayTeamId].filter((teamId) => teamIds.includes(teamId)).map((teamId) => `${game.id}:${teamId}`)).sort(),
    gameStatPairs: games.flatMap((game) => game.stats.map((stat) => `${stat.id}:${stat.teamId}`)).sort()
  };
}

async function getU19TeamUsageAfter(targetTeamIds: Set<string>): Promise<ScopeRow[]> {
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
      stats: { where: { deletedAt: null }, select: { teamId: true, points: true } }
    }
  });

  const scopes = new Map<string, {
    gender: Gender;
    league: string;
    season: string;
    gameIds: Set<string>;
    statsCount: number;
    teams: Map<string, string>;
    publicSchools: Set<string>;
    targetTeamGenders: Map<string, { teamName: string; publicSchoolDisplayName: string; genders: Set<Gender> }>;
    pointTotalsPass: boolean;
    pointTotalFailures: Array<Record<string, unknown>>;
  }>();

  for (const game of games) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const key = [game.season.league.id, game.season.id, gender].join("|");
    const scope = scopes.get(key) ?? {
      gender,
      league: game.season.league.name,
      season: game.season.name,
      gameIds: new Set<string>(),
      statsCount: 0,
      teams: new Map<string, string>(),
      publicSchools: new Set<string>(),
      targetTeamGenders: new Map<string, { teamName: string; publicSchoolDisplayName: string; genders: Set<Gender> }>(),
      pointTotalsPass: true,
      pointTotalFailures: []
    };

    scope.gameIds.add(game.id);
    scope.statsCount += game.stats.length;
    for (const team of [game.homeTeam, game.awayTeam]) {
      scope.teams.set(team.id, team.name);
      scope.publicSchools.add(publicSchoolDisplayName(team.name));
      if (targetTeamIds.has(team.id)) {
        const row = scope.targetTeamGenders.get(team.id) ?? { teamName: team.name, publicSchoolDisplayName: publicSchoolDisplayName(team.name), genders: new Set<Gender>() };
        row.genders.add(gender);
        scope.targetTeamGenders.set(team.id, row);
      }
    }

    const homePoints = game.stats.filter((stat) => stat.teamId === game.homeTeamId).reduce((sum, stat) => sum + stat.points, 0);
    const awayPoints = game.stats.filter((stat) => stat.teamId === game.awayTeamId).reduce((sum, stat) => sum + stat.points, 0);
    if (homePoints !== game.homeScore || awayPoints !== game.awayScore) {
      scope.pointTotalsPass = false;
      scope.pointTotalFailures.push({ gameId: game.id, gameNumber: game.gameNumber, homeScore: game.homeScore, awayScore: game.awayScore, homePoints, awayPoints });
    }
    scopes.set(key, scope);
  }

  return [...scopes.values()].map((scope) => ({
    ageGroup: "U19" as const,
    gender: scope.gender,
    league: scope.league,
    season: scope.season,
    activeGameCount: scope.gameIds.size,
    activeGameStatsCount: scope.statsCount,
    internalTeams: scope.teams.size,
    publicSchools: scope.publicSchools.size,
    sharedTargetTeamRecords: [...scope.targetTeamGenders.entries()]
      .map(([teamId, row]) => ({ teamId, teamName: row.teamName, publicSchoolDisplayName: row.publicSchoolDisplayName, genders: [...row.genders].sort() as Gender[] }))
      .filter((row) => row.genders.length > 1),
    pointTotalsPass: scope.pointTotalsPass,
    pointTotalFailures: scope.pointTotalFailures
  })).sort((a, b) => a.gender.localeCompare(b.gender));
}

async function main() {
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as RepairPlan;
  assertPlan(plan);

  const beforeU16 = await getUsageSnapshot("U16");
  const beforeU19 = await getUsageSnapshot("U19");
  const beforeDlszU19 = await getDlszU19Snapshot();
  const beforeCounts = await getCounts();
  const affectedGameIds = new Set<string>();
  const affectedOldTeamIds = new Set(plan.sharedTeamRecords.map((record) => record.teamId));

  const result = await prisma.$transaction(async (tx) => {
    const targetBySchoolGender = new Map<string, TeamRow>();
    const teamsCreated: TeamRow[] = [];
    const teamsReused: TeamRow[] = [];

    for (const [publicSchool, namesByGender] of Object.entries(targetTeamNames) as Array<[PublicSchool, Record<Gender, string>]>) {
      for (const gender of ["BOYS", "GIRLS"] as const) {
        const targetName = namesByGender[gender];
        const existing = await tx.team.findFirst({ where: { name: targetName, deletedAt: null }, select: { id: true, name: true } });
        if (existing) {
          targetBySchoolGender.set(`${publicSchool}|${gender}`, existing);
          teamsReused.push(existing);
        } else {
          const created = await tx.team.create({ data: { name: targetName, city: "Metro Manila", region: "NCR" }, select: { id: true, name: true } });
          targetBySchoolGender.set(`${publicSchool}|${gender}`, created);
          teamsCreated.push(created);
        }
      }
    }

    let gamesUpdated = 0;
    let gameStatsUpdated = 0;

    for (const record of plan.sharedTeamRecords) {
      for (const gender of ["BOYS", "GIRLS"] as const) {
        const target = targetBySchoolGender.get(`${record.publicSchoolDisplayName}|${gender}`);
        if (!target) throw new Error(`Missing target team for ${record.publicSchoolDisplayName} ${gender}.`);
        const affectedGames = gender === "BOYS" ? record.boysAffectedGames : record.girlsAffectedGames;

        for (const planGame of affectedGames) {
          affectedGameIds.add(planGame.gameId);
          const game = await tx.game.findUnique({
            where: { id: planGame.gameId },
            include: {
              season: { include: { league: true } },
              stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
            }
          });
          if (!game || game.deletedAt) throw new Error(`Affected game not found or inactive: ${planGame.gameNumber}.`);
          if (game.season.league.ageGroup !== "U19") throw new Error(`Affected game is not U19: ${planGame.gameNumber}.`);
          if (inferGender(game.season.league.name, planGame.gameNumber) !== gender) throw new Error(`Gender mismatch for ${planGame.gameNumber}.`);

          const currentSideTeamId = planGame.side === "home" ? game.homeTeamId : game.awayTeamId;
          const data: { homeTeamId?: string; awayTeamId?: string } = {};
          if (currentSideTeamId !== target.id) {
            if (currentSideTeamId !== record.teamId) {
              throw new Error(`Unexpected ${planGame.side} team for ${planGame.gameNumber}; expected ${record.teamId}, found ${currentSideTeamId}.`);
            }
            if (planGame.side === "home") data.homeTeamId = target.id;
            if (planGame.side === "away") data.awayTeamId = target.id;
          }
          if (Object.keys(data).length > 0) {
            await tx.game.update({ where: { id: planGame.gameId }, data });
            gamesUpdated += 1;
          }

          const currentOldStats = game.stats.filter((stat) => stat.teamId === record.teamId).length;
          const currentTargetStats = game.stats.filter((stat) => stat.teamId === target.id).length;
          if (currentOldStats + currentTargetStats !== planGame.gameStatsCountForTeam) {
            throw new Error(`Current GameStat ownership for ${planGame.gameNumber} is ${currentOldStats + currentTargetStats}; expected ${planGame.gameStatsCountForTeam}.`);
          }
          if (currentOldStats > 0) {
            const updatedStats = await tx.gameStat.updateMany({
              where: { gameId: planGame.gameId, teamId: record.teamId, deletedAt: null },
              data: { teamId: target.id }
            });
            if (updatedStats.count !== currentOldStats) {
              throw new Error(`Updated ${updatedStats.count} GameStats for ${planGame.gameNumber}; expected ${currentOldStats}.`);
            }
            gameStatsUpdated += updatedStats.count;
          }
        }
      }
    }

    return { teamsCreated, teamsReused, gamesUpdated, gameStatsUpdated };
  });

  const afterU16 = await getUsageSnapshot("U16");
  const afterU19 = await getUsageSnapshot("U19");
  const afterDlszU19 = await getDlszU19Snapshot();
  const afterCounts = await getCounts();
  const targetTeamIds = new Set<string>();
  for (const nameSet of Object.values(targetTeamNames)) {
    for (const targetName of Object.values(nameSet)) {
      const team = await prisma.team.findFirst({ where: { name: targetName, deletedAt: null }, select: { id: true } });
      if (team) targetTeamIds.add(team.id);
    }
  }
  const u19TeamUsageAfter = await getU19TeamUsageAfter(targetTeamIds);

  const u16GamesTouched = !sameArray(beforeU16.gameTeamPairs, afterU16.gameTeamPairs);
  const u16GameStatsTouched = !sameArray(beforeU16.gameStatPairs, afterU16.gameStatPairs);
  const dlszU19TeamsTouched = !sameArray(beforeDlszU19.gameTeamPairs, afterDlszU19.gameTeamPairs) || !sameArray(beforeDlszU19.gameStatPairs, afterDlszU19.gameStatPairs);

  const gameDiff = diffPairs(beforeU19.gameTeamPairs, afterU19.gameTeamPairs);
  const statDiff = diffPairs(beforeU19.gameStatPairs, afterU19.gameStatPairs);
  const unrelatedGameChanges = gameDiff.added.concat(gameDiff.removed).filter((pair) => !affectedGameIds.has(pair.split(":")[0] ?? ""));
  const unrelatedStatChanges = statDiff.added.concat(statDiff.removed).filter((pair) => {
    const nextTeamId = pair.split(":")[1] ?? "";
    return !affectedOldTeamIds.has(nextTeamId) && !targetTeamIds.has(nextTeamId);
  });
  const unrelatedTeamsTouched = unrelatedGameChanges.length > 0 || unrelatedStatChanges.length > 0;

  const boysUsage = u19TeamUsageAfter.find((row) => row.gender === "BOYS");
  const girlsUsage = u19TeamUsageAfter.find((row) => row.gender === "GIRLS");
  const pointTotalsPass = u19TeamUsageAfter.every((row) => row.pointTotalsPass);
  const countsUnchanged = beforeCounts.gamePerformanceScore === afterCounts.gamePerformanceScore
    && beforeCounts.playerRating === afterCounts.playerRating
    && beforeCounts.rankingSnapshot === afterCounts.rankingSnapshot
    && beforeCounts.rankingSnapshotRow === afterCounts.rankingSnapshotRow;
  const noTargetSharedAcrossGender = u19TeamUsageAfter.every((row) => row.sharedTargetTeamRecords.length === 0);
  const validationPassed =
    !u16GamesTouched
    && !u16GameStatsTouched
    && !dlszU19TeamsTouched
    && !unrelatedTeamsTouched
    && boysUsage?.activeGameCount === 62
    && girlsUsage?.activeGameCount === 14
    && boysUsage?.activeGameStatsCount === 1554
    && girlsUsage?.activeGameStatsCount === 331
    && boysUsage?.internalTeams === 8
    && girlsUsage?.internalTeams === 4
    && pointTotalsPass
    && countsUnchanged
    && noTargetSharedAcrossGender;

  console.log(JSON.stringify({
    teamsCreated: result.teamsCreated,
    teamsReused: result.teamsReused,
    gamesUpdated: result.gamesUpdated,
    gameStatsUpdated: result.gameStatsUpdated,
    u16GamesTouched,
    u16GameStatsTouched,
    dlszU19TeamsTouched,
    unrelatedTeamsTouched,
    pointTotalsPass,
    u19TeamUsageAfter,
    protectedCounts: {
      before: beforeCounts,
      after: afterCounts,
      unchanged: countsUnchanged
    },
    validation: {
      u16UsageUnchanged: !u16GamesTouched && !u16GameStatsTouched,
      dlszU19RecordsUnchanged: !dlszU19TeamsTouched,
      unrelatedTeamsUntouched: !unrelatedTeamsTouched,
      u19BoysActiveGameCountRemains62: boysUsage?.activeGameCount === 62,
      u19GirlsActiveGameCountRemains14: girlsUsage?.activeGameCount === 14,
      u19BoysGameStatsRemain1554: boysUsage?.activeGameStatsCount === 1554,
      u19GirlsGameStatsRemain331: girlsUsage?.activeGameStatsCount === 331,
      u19BoysInternalTeams8: boysUsage?.internalTeams === 8,
      u19GirlsInternalTeams4: girlsUsage?.internalTeams === 4,
      noAteneoNuUstTeamRecordSharedByU19BoysAndGirls: noTargetSharedAcrossGender,
      protectedCountsUnchanged: countsUnchanged,
      pointTotalsPass
    },
    validationPassed
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});


