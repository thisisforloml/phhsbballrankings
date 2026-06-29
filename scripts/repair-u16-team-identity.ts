import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const planPath = "D:/Peach Basket/scripts/reports/u16-team-identity-repair-plan.json";
const leagueId = "c112c09d-75ac-46ed-96e4-ce2852bfba75";
const seasonId = "39a4a46c-6362-411f-ae85-6f631414f30b";

const teamMap: Record<string, string> = {
  ADU: "ADU U16 Boys",
  ATENEO: "ATENEO U16 Boys",
  FEU: "FEU U16 Boys",
  UP: "UP U16 Boys",
  UST: "UST U16 Boys",
  "De La Salle Santiago Zobel": "DLSZ U16 Boys",
  DLSZ: "DLSZ U16 Boys",
  DLSU: "DLSZ U16 Boys",
  "LA SALLE": "DLSZ U16 Boys"
};

function normalizeTeamName(name: string) {
  const upper = name.trim().toUpperCase();
  if (["ADU", "ADU JRS", "ADAMSON UNIVERSITY"].includes(upper)) return "ADU";
  if (["ATENEO", "ADMU", "ATENEO JRS", "ATENEO DE MANILA UNIVERSITY"].includes(upper)) return "ATENEO";
  if (["FEU", "FEU JRS", "FAR EASTERN UNIVERSITY"].includes(upper)) return "FEU";
  if (["UP", "UPIS", "UPIS JRS", "UNIVERSITY OF THE PHILIPPINES INTEGRATED SCHOOL"].includes(upper)) return "UP";
  if (["UST", "UST JRS", "UNIVERSITY OF SANTO TOMAS"].includes(upper)) return "UST";
  if (["DE LA SALLE SANTIAGO ZOBEL", "DLSZ", "DLSU", "LA SALLE", "DE LA SALLE JRS"].includes(upper)) return "De La Salle Santiago Zobel";
  return name.trim();
}

async function getU19UsageSnapshot() {
  const games = await prisma.game.findMany({
    where: { deletedAt: null, season: { league: { ageGroup: "U19" } } },
    select: { id: true, homeTeamId: true, awayTeamId: true, stats: { where: { deletedAt: null }, select: { id: true, teamId: true } } }
  });
  return {
    gameCount: games.length,
    gameTeamPairs: games.map((game) => `${game.id}:${game.homeTeamId}:${game.awayTeamId}`).sort(),
    gameStatPairs: games.flatMap((game) => game.stats.map((stat) => `${stat.id}:${stat.teamId}`)).sort()
  };
}

async function getPointTotals() {
  const games = await prisma.game.findMany({
    where: { seasonId, deletedAt: null },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      stats: { where: { deletedAt: null }, select: { teamId: true, points: true } }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });

  return games.map((game) => {
    const home = game.stats.filter((stat) => stat.teamId === game.homeTeamId).reduce((sum, stat) => sum + stat.points, 0);
    const away = game.stats.filter((stat) => stat.teamId === game.awayTeamId).reduce((sum, stat) => sum + stat.points, 0);
    return {
      gameNumber: game.gameNumber,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      summedHomePlayerPoints: home,
      summedAwayPlayerPoints: away,
      pass: home === game.homeScore && away === game.awayScore
    };
  });
}

async function main() {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (plan?.context?.league?.id !== leagueId || plan?.context?.season?.id !== seasonId) {
    throw new Error("Repair plan does not match the approved U16 league/season context.");
  }

  const u19Before = await getU19UsageSnapshot();
  const beforeCounts = await Promise.all([
    prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count()
  ]);

  const result = await prisma.$transaction(async (tx) => {
    const league = await tx.league.findUnique({ where: { id: leagueId }, select: { id: true, ageGroup: true, name: true } });
    const season = await tx.season.findUnique({ where: { id: seasonId }, select: { id: true, leagueId: true } });
    if (!league || league.ageGroup !== "U16" || !season || season.leagueId !== leagueId) {
      throw new Error("Target U16 league/season was not found or is mismatched.");
    }

    const games = await tx.game.findMany({
      where: { seasonId, deletedAt: null },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        stats: { where: { deletedAt: null }, include: { team: { select: { name: true } } } }
      },
      orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
    });
    if (games.length !== 3) throw new Error(`Expected 3 U16 games, found ${games.length}.`);
    const gameStatCount = games.reduce((sum, game) => sum + game.stats.length, 0);
    if (gameStatCount !== 79) throw new Error(`Expected 79 U16 GameStats, found ${gameStatCount}.`);

    const sourceKeys = [...new Set(games.flatMap((game) => [game.homeTeam.name, game.awayTeam.name, ...game.stats.map((stat) => stat.team.name)]).map(normalizeTeamName))];
    const teamBySourceKey = new Map<string, { id: string; name: string; action: "created" | "reused" }>();
    const teamsCreated: Array<{ id: string; name: string }> = [];
    const teamsReused: Array<{ id: string; name: string }> = [];

    for (const key of sourceKeys) {
      const targetName = teamMap[key];
      if (!targetName) throw new Error(`No target U16 team mapping for ${key}.`);
      const existing = await tx.team.findFirst({ where: { name: targetName, deletedAt: null }, select: { id: true, name: true } });
      if (existing) {
        teamBySourceKey.set(key, { ...existing, action: "reused" });
        teamsReused.push(existing);
      } else {
        const created = await tx.team.create({ data: { name: targetName, city: "Metro Manila", region: "NCR" }, select: { id: true, name: true } });
        teamBySourceKey.set(key, { ...created, action: "created" });
        teamsCreated.push(created);
      }
    }

    let gamesUpdated = 0;
    let gameStatsUpdated = 0;
    for (const game of games) {
      const newHomeTeam = teamBySourceKey.get(normalizeTeamName(game.homeTeam.name));
      const newAwayTeam = teamBySourceKey.get(normalizeTeamName(game.awayTeam.name));
      if (!newHomeTeam || !newAwayTeam) throw new Error(`Missing new team for game ${game.gameNumber}.`);
      if (game.homeTeamId !== newHomeTeam.id || game.awayTeamId !== newAwayTeam.id) {
        await tx.game.update({ where: { id: game.id }, data: { homeTeamId: newHomeTeam.id, awayTeamId: newAwayTeam.id } });
        gamesUpdated += 1;
      }

      for (const stat of game.stats) {
        const newTeam = teamBySourceKey.get(normalizeTeamName(stat.team.name));
        if (!newTeam) throw new Error(`Missing new team for GameStat ${stat.id}.`);
        if (stat.teamId !== newTeam.id) {
          await tx.gameStat.update({ where: { id: stat.id }, data: { teamId: newTeam.id } });
          gameStatsUpdated += 1;
        }
      }
    }

    return { teamsCreated, teamsReused, gamesUpdated, gameStatsUpdated };
  });

  const u19After = await getU19UsageSnapshot();
  const afterCounts = await Promise.all([
    prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count()
  ]);

  const pointTotals = await getPointTotals();
  const u16Games = await prisma.game.findMany({
    where: { seasonId, deletedAt: null },
    include: { homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } }, stats: { where: { deletedAt: null }, include: { team: { select: { id: true, name: true } } } } },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });
  const u16TeamUsageAfterMap = new Map<string, { teamId: string; name: string; gameCount: number; gameStatCount: number }>();
  for (const game of u16Games) {
    for (const team of [game.homeTeam, game.awayTeam]) {
      const item = u16TeamUsageAfterMap.get(team.id) ?? { teamId: team.id, name: team.name, gameCount: 0, gameStatCount: 0 };
      item.gameCount += 1;
      u16TeamUsageAfterMap.set(team.id, item);
    }
    for (const stat of game.stats) {
      const item = u16TeamUsageAfterMap.get(stat.teamId) ?? { teamId: stat.teamId, name: stat.team.name, gameCount: 0, gameStatCount: 0 };
      item.gameStatCount += 1;
      u16TeamUsageAfterMap.set(stat.teamId, item);
    }
  }

  const u16TeamIds = [...u16TeamUsageAfterMap.keys()];
  const sharedWithU19 = u16TeamIds.filter((teamId) => u19After.gameTeamPairs.some((pair) => pair.includes(teamId)) || u19After.gameStatPairs.some((pair) => pair.endsWith(`:${teamId}`)));

  const u19GamesTouched = JSON.stringify(u19Before.gameTeamPairs) !== JSON.stringify(u19After.gameTeamPairs);
  const u19GameStatsTouched = JSON.stringify(u19Before.gameStatPairs) !== JSON.stringify(u19After.gameStatPairs);
  const countsStable = beforeCounts[0] === afterCounts[0] && beforeCounts[1] === afterCounts[1] && beforeCounts[2] === afterCounts[2] && beforeCounts[3] === afterCounts[3];
  const validationPassed =
    u16Games.length === 3 &&
    u16Games.reduce((sum, game) => sum + game.stats.length, 0) === 79 &&
    sharedWithU19.length === 0 &&
    !u19GamesTouched &&
    !u19GameStatsTouched &&
    pointTotals.every((row) => row.pass) &&
    afterCounts[0] === 1964 &&
    afterCounts[1] === 260 &&
    afterCounts[2] === 3 &&
    afterCounts[3] === 217 &&
    countsStable;

  console.log(JSON.stringify({
    teamsCreated: result.teamsCreated,
    teamsReused: result.teamsReused,
    gamesUpdated: result.gamesUpdated,
    gameStatsUpdated: result.gameStatsUpdated,
    u19GamesTouched,
    u19GameStatsTouched,
    pointTotalsPass: pointTotals.every((row) => row.pass),
    pointTotals,
    u16TeamUsageAfter: [...u16TeamUsageAfterMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    sharedU16TeamIdsStillUsedByU19: sharedWithU19,
    counts: {
      gamePerformanceScoreBefore: beforeCounts[0],
      gamePerformanceScoreAfter: afterCounts[0],
      playerRatingBefore: beforeCounts[1],
      playerRatingAfter: afterCounts[1],
      rankingSnapshotBefore: beforeCounts[2],
      rankingSnapshotAfter: afterCounts[2],
      rankingSnapshotRowBefore: beforeCounts[3],
      rankingSnapshotRowAfter: afterCounts[3]
    },
    validationPassed
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
