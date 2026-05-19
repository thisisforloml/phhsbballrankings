import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { getUaapSchoolDisplayName } from "../src/lib/uaap-school-display";

const planPath = "D:/OnCourt Rankings PH/scripts/reports/u19-la-salle-team-identity-repair-plan.json";
const targetTeamNames = {
  BOYS: "DLSZ U19 Boys",
  GIRLS: "DLSZ U19 Girls"
} as const;

type Gender = keyof typeof targetTeamNames;
type RepairPlan = {
  diagnostic?: string;
  exactAffectedGames?: Array<{
    gameId: string;
    gameNumber: string | null;
    ageGroup: string;
    gender: Gender;
    affectedTeams: Array<{
      side: "home" | "away";
      teamId: string;
      teamName: string;
      proposedTeamName: string;
    }>;
  }>;
};

type UsageSnapshot = {
  gameTeamPairs: string[];
  gameStatPairs: string[];
};

type ScopeRow = {
  ageGroup: string;
  gender: Gender;
  league: string;
  season: string;
  activeGameCount: number;
  activeGameStatsCount: number;
  internalTeams: number;
  publicSchools: number;
  deLaSalleDuplicatePublicGroups: Array<{
    publicSchoolDisplayName: string;
    teamIds: string[];
    teamNames: string[];
  }>;
  pointTotalsPass: boolean;
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

function assertPlan(plan: RepairPlan): asserts plan is Required<Pick<RepairPlan, "exactAffectedGames">> & RepairPlan {
  if (plan.diagnostic !== "u19-la-salle-team-identity-repair-plan") {
    throw new Error("Repair plan diagnostic name does not match U19 La Salle team identity repair.");
  }
  if (!Array.isArray(plan.exactAffectedGames) || plan.exactAffectedGames.length !== 21) {
    throw new Error(`Expected 21 affected games in repair plan, found ${plan.exactAffectedGames?.length ?? 0}.`);
  }
  for (const game of plan.exactAffectedGames) {
    if (game.ageGroup !== "U19") throw new Error(`Plan includes non-U19 game ${game.gameNumber}.`);
    if (game.gender !== "BOYS" && game.gender !== "GIRLS") throw new Error(`Plan includes unsupported gender for game ${game.gameNumber}.`);
    for (const affectedTeam of game.affectedTeams) {
      if (affectedTeam.proposedTeamName !== targetTeamNames[game.gender]) {
        throw new Error(`Plan target mismatch for ${game.gameNumber}: ${affectedTeam.proposedTeamName}.`);
      }
    }
  }
}

async function getUsageSnapshot(ageGroup: "U16" | "U19"): Promise<UsageSnapshot> {
  const games = await prisma.game.findMany({
    where: { deletedAt: null, season: { league: { ageGroup } } },
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

async function getCounts() {
  const [gamePerformanceScore, playerRating, rankingSnapshot, rankingSnapshotRow] = await Promise.all([
    prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count()
  ]);

  return { gamePerformanceScore, playerRating, rankingSnapshot, rankingSnapshotRow };
}

function sameSnapshot(before: UsageSnapshot, after: UsageSnapshot) {
  return JSON.stringify(before.gameTeamPairs) === JSON.stringify(after.gameTeamPairs)
    && JSON.stringify(before.gameStatPairs) === JSON.stringify(after.gameStatPairs);
}

async function getU19ScopeRows(): Promise<ScopeRow[]> {
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
    ageGroup: string;
    gender: Gender;
    league: string;
    season: string;
    gameIds: Set<string>;
    statsCount: number;
    teams: Map<string, string>;
    publicTeams: Map<string, Map<string, string>>;
    pointTotalsPass: boolean;
  }>();

  for (const game of games) {
    const gender = inferGender(game.season.league.name, game.homeTeam.name, game.awayTeam.name);
    const key = [game.season.league.id, game.season.id, gender].join("|");
    const scope = scopes.get(key) ?? {
      ageGroup: "U19",
      gender,
      league: game.season.league.name,
      season: game.season.name,
      gameIds: new Set<string>(),
      statsCount: 0,
      teams: new Map<string, string>(),
      publicTeams: new Map<string, Map<string, string>>(),
      pointTotalsPass: true
    };

    scope.gameIds.add(game.id);
    scope.statsCount += game.stats.length;
    for (const team of [game.homeTeam, game.awayTeam]) {
      scope.teams.set(team.id, team.name);
      const publicName = publicSchoolDisplayName(team.name);
      const publicTeam = scope.publicTeams.get(publicName) ?? new Map<string, string>();
      publicTeam.set(team.id, team.name);
      scope.publicTeams.set(publicName, publicTeam);
    }

    const homePoints = game.stats.filter((stat) => stat.teamId === game.homeTeamId).reduce((sum, stat) => sum + stat.points, 0);
    const awayPoints = game.stats.filter((stat) => stat.teamId === game.awayTeamId).reduce((sum, stat) => sum + stat.points, 0);
    if (homePoints !== game.homeScore || awayPoints !== game.awayScore) scope.pointTotalsPass = false;
    scopes.set(key, scope);
  }

  return [...scopes.values()].map((scope) => ({
    ageGroup: scope.ageGroup,
    gender: scope.gender,
    league: scope.league,
    season: scope.season,
    activeGameCount: scope.gameIds.size,
    activeGameStatsCount: scope.statsCount,
    internalTeams: scope.teams.size,
    publicSchools: scope.publicTeams.size,
    deLaSalleDuplicatePublicGroups: [...scope.publicTeams.entries()]
      .filter(([publicName, teams]) => publicName === "De La Salle Santiago Zobel" && teams.size > 1)
      .map(([publicSchoolDisplayName, teams]) => ({
        publicSchoolDisplayName,
        teamIds: [...teams.keys()].sort(),
        teamNames: [...teams.values()].sort()
      })),
    pointTotalsPass: scope.pointTotalsPass
  })).sort((a, b) => a.gender.localeCompare(b.gender));
}

async function main() {
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as RepairPlan;
  assertPlan(plan);

  const affectedGameIds = new Set(plan.exactAffectedGames.map((game) => game.gameId));
  const expectedAffectedGameStats = plan.exactAffectedGames.reduce((sum, game) => {
    return sum + game.affectedTeams.reduce((innerSum, team) => innerSum + (team.teamName === "DLSU" && game.gender === "BOYS" ? 14 : 0), 0);
  }, 0);
  void expectedAffectedGameStats;

  const beforeU16 = await getUsageSnapshot("U16");
  const beforeU19 = await getUsageSnapshot("U19");
  const beforeCounts = await getCounts();

  const result = await prisma.$transaction(async (tx) => {
    const teamByGender = new Map<Gender, { id: string; name: string; action: "created" | "reused" }>();
    const teamsCreated: Array<{ id: string; name: string }> = [];
    const teamsReused: Array<{ id: string; name: string }> = [];

    for (const gender of ["BOYS", "GIRLS"] as const) {
      const targetName = targetTeamNames[gender];
      const existing = await tx.team.findFirst({
        where: { name: targetName, deletedAt: null },
        select: { id: true, name: true }
      });
      if (existing) {
        teamByGender.set(gender, { ...existing, action: "reused" });
        teamsReused.push(existing);
      } else {
        const created = await tx.team.create({
          data: { name: targetName, city: "Metro Manila", region: "NCR" },
          select: { id: true, name: true }
        });
        teamByGender.set(gender, { ...created, action: "created" });
        teamsCreated.push(created);
      }
    }

    let gamesUpdated = 0;
    let gameStatsUpdated = 0;

    for (const planGame of plan.exactAffectedGames) {
      const targetTeam = teamByGender.get(planGame.gender);
      if (!targetTeam) throw new Error(`Missing target Team for ${planGame.gender}.`);

      const game = await tx.game.findUnique({
        where: { id: planGame.gameId },
        include: {
          season: { include: { league: true } },
          stats: { where: { deletedAt: null }, select: { id: true, teamId: true } }
        }
      });
      if (!game || game.deletedAt) throw new Error(`Affected game not found or inactive: ${planGame.gameNumber}.`);
      if (game.season.league.ageGroup !== "U19") throw new Error(`Affected game is not U19: ${planGame.gameNumber}.`);
      if (inferGender(game.season.league.name) !== planGame.gender) throw new Error(`Gender mismatch for ${planGame.gameNumber}.`);

      const data: { homeTeamId?: string; awayTeamId?: string } = {};
      for (const affectedTeam of planGame.affectedTeams) {
        const currentSideTeamId = affectedTeam.side === "home" ? game.homeTeamId : game.awayTeamId;
        if (currentSideTeamId === targetTeam.id) continue;
        if (currentSideTeamId !== affectedTeam.teamId) {
          throw new Error(`Unexpected ${affectedTeam.side} team for ${planGame.gameNumber}; expected ${affectedTeam.teamId}, found ${currentSideTeamId}.`);
        }
        if (affectedTeam.side === "home") data.homeTeamId = targetTeam.id;
        if (affectedTeam.side === "away") data.awayTeamId = targetTeam.id;
      }

      if (Object.keys(data).length > 0) {
        await tx.game.update({ where: { id: planGame.gameId }, data });
        gamesUpdated += 1;
      }

      for (const affectedTeam of planGame.affectedTeams) {
        const updatedStats = await tx.gameStat.updateMany({
          where: {
            gameId: planGame.gameId,
            teamId: affectedTeam.teamId,
            deletedAt: null
          },
          data: { teamId: targetTeam.id }
        });
        gameStatsUpdated += updatedStats.count;
      }
    }

    return { teamsCreated, teamsReused, gamesUpdated, gameStatsUpdated };
  });

  const afterU16 = await getUsageSnapshot("U16");
  const afterU19 = await getUsageSnapshot("U19");
  const afterCounts = await getCounts();
  const u19TeamUsageAfter = await getU19ScopeRows();

  const u16GamesTouched = JSON.stringify(beforeU16.gameTeamPairs) !== JSON.stringify(afterU16.gameTeamPairs);
  const u16GameStatsTouched = JSON.stringify(beforeU16.gameStatPairs) !== JSON.stringify(afterU16.gameStatPairs);
  const ratingCountsUnchanged =
    beforeCounts.gamePerformanceScore === afterCounts.gamePerformanceScore
    && beforeCounts.playerRating === afterCounts.playerRating
    && beforeCounts.rankingSnapshot === afterCounts.rankingSnapshot
    && beforeCounts.rankingSnapshotRow === afterCounts.rankingSnapshotRow;

  const unrelatedU19TeamsTouched = (() => {
    const beforeGamePairs = new Map(beforeU19.gameTeamPairs.map((pair) => [pair.split(":")[0], pair]));
    const afterGamePairs = new Map(afterU19.gameTeamPairs.map((pair) => [pair.split(":")[0], pair]));
    for (const [gameId, beforePair] of beforeGamePairs) {
      if (!affectedGameIds.has(gameId) && afterGamePairs.get(gameId) !== beforePair) return true;
    }
    return false;
  })();

  const boysUsage = u19TeamUsageAfter.find((row) => row.gender === "BOYS");
  const girlsUsage = u19TeamUsageAfter.find((row) => row.gender === "GIRLS");
  const pointTotalsPass = u19TeamUsageAfter.every((row) => row.pointTotalsPass);
  const validationPassed =
    sameSnapshot(beforeU16, afterU16)
    && !unrelatedU19TeamsTouched
    && boysUsage?.activeGameCount === 62
    && girlsUsage?.activeGameCount === 14
    && boysUsage?.activeGameStatsCount === 1554
    && girlsUsage?.activeGameStatsCount === 331
    && boysUsage?.internalTeams === 8
    && girlsUsage?.internalTeams === 4
    && boysUsage.deLaSalleDuplicatePublicGroups.length === 0
    && girlsUsage.deLaSalleDuplicatePublicGroups.length === 0
    && pointTotalsPass
    && ratingCountsUnchanged;

  console.log(JSON.stringify({
    teamsCreated: result.teamsCreated,
    teamsReused: result.teamsReused,
    gamesUpdated: result.gamesUpdated,
    gameStatsUpdated: result.gameStatsUpdated,
    u16GamesTouched,
    u16GameStatsTouched,
    unrelatedU19TeamsTouched,
    pointTotalsPass,
    u19TeamUsageAfter,
    counts: {
      before: beforeCounts,
      after: afterCounts,
      unchanged: ratingCountsUnchanged
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
