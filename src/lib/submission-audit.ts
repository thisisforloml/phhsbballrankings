import { AgeGroup, PlayerGender, RankingScope, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMonthStart } from "@/lib/ranking-eligibility";

const targetSubmissionId = "a1d0b638-901f-4f89-b8b2-1f2f7281892f";
const expected = {
  games: 3,
  gameStats: 79,
  gamePerformanceScores: 79,
  playerRatings: 79,
  rankingSnapshotRows: 79,
  u19SnapshotRows: 138
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function check(actual: number | null, expectedValue: number) {
  return actual === expectedValue;
}

export async function getSubmissionImportPublishAudit(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, title: true }
  });

  if (!submission) throw new Error("Submission not found.");

  if (submission.id !== targetSubmissionId) {
    return {
      available: false as const,
      reason: "Import audit is currently available for the imported U16 Boys submission only.",
      submission: { id: submission.id, status: submission.status, title: submission.title }
    };
  }

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });

  const league = await prisma.league.findFirst({
    where: { name: "UAAP Season 88 16U Boys Basketball", ageGroup: AgeGroup.U16, deletedAt: null },
    select: { id: true, name: true, ageGroup: true }
  });

  const season = league
    ? await prisma.season.findUnique({
        where: { leagueId_name: { leagueId: league.id, name: "Season 88" } },
        select: { id: true, name: true, deletedAt: true }
      })
    : null;

  const monthStart = getMonthStart(new Date());
  const games = season
    ? await prisma.game.findMany({
        where: { seasonId: season.id, deletedAt: null },
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          stats: {
            where: { deletedAt: null },
            include: { team: { select: { id: true, name: true } } }
          }
        },
        orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
      })
    : [];

  const gameIds = games.map((game) => game.id);
  const gameStatIds = games.flatMap((game) => game.stats.map((stat) => stat.id));
  const teamNames = unique(games.flatMap((game) => [game.homeTeam.name, game.awayTeam.name, ...game.stats.map((stat) => stat.team.name)])).sort();

  const pointTotals = games.map((game) => {
    const summedHomePlayerPoints = game.stats.filter((stat) => stat.teamId === game.homeTeamId).reduce((sum, stat) => sum + stat.points, 0);
    const summedAwayPlayerPoints = game.stats.filter((stat) => stat.teamId === game.awayTeamId).reduce((sum, stat) => sum + stat.points, 0);
    return {
      gameId: game.id,
      gameNumber: game.gameNumber,
      homeTeam: game.homeTeam.name,
      awayTeam: game.awayTeam.name,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      summedHomePlayerPoints,
      summedAwayPlayerPoints,
      homePass: summedHomePlayerPoints === game.homeScore,
      awayPass: summedAwayPlayerPoints === game.awayScore,
      pass: summedHomePlayerPoints === game.homeScore && summedAwayPlayerPoints === game.awayScore
    };
  });

  const [gamePerformanceScores, playerRatings, latestSnapshot, globalCounts, u19SnapshotRows] = await Promise.all([
    formulaVersion
      ? prisma.gamePerformanceScore.count({
          where: { deletedAt: null, formulaVersionId: formulaVersion.id, gameStatId: { in: gameStatIds } }
        })
      : Promise.resolve(null),
    prisma.playerRating.count({
      where: { ageGroup: AgeGroup.U16, player: { gender: PlayerGender.BOYS, deletedAt: null } }
    }),
    formulaVersion
      ? prisma.rankingSnapshot.findFirst({
          where: {
            scope: RankingScope.NATIONAL,
            ageGroup: AgeGroup.U16,
            gender: PlayerGender.BOYS,
            formulaVersionId: formulaVersion.id,
            weekOf: monthStart,
            city: null,
            region: null
          },
          include: { _count: { select: { rows: true } } },
          orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
        })
      : Promise.resolve(null),
    Promise.all([
      prisma.game.count({ where: { deletedAt: null } }),
      prisma.gameStat.count({ where: { deletedAt: null } }),
      prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
      prisma.playerRating.count(),
      prisma.rankingSnapshot.count(),
      prisma.rankingSnapshotRow.count()
    ]),
    formulaVersion
      ? prisma.rankingSnapshotRow.count({ where: { snapshot: { ageGroup: AgeGroup.U19, formulaVersionId: formulaVersion.id } } })
      : Promise.resolve(null)
  ]);

  const activeGames = gameIds.length;
  const activeGameStats = gameStatIds.length;
  const snapshotRows = latestSnapshot?._count.rows ?? null;
  const imported = submission.status === SubmissionStatus.IMPORTED;
  const processed = gamePerformanceScores === expected.gamePerformanceScores && playerRatings === expected.playerRatings;
  const published = snapshotRows === expected.rankingSnapshotRows;
  const pointTotalsPass = pointTotals.every((row) => row.pass);
  const expectedChecks = {
    u16Games: { actual: activeGames, expected: expected.games, pass: check(activeGames, expected.games) },
    u16GameStats: { actual: activeGameStats, expected: expected.gameStats, pass: check(activeGameStats, expected.gameStats) },
    u16GamePerformanceScores: { actual: gamePerformanceScores, expected: expected.gamePerformanceScores, pass: check(gamePerformanceScores, expected.gamePerformanceScores) },
    u16PlayerRatings: { actual: playerRatings, expected: expected.playerRatings, pass: check(playerRatings, expected.playerRatings) },
    u16SnapshotRows: { actual: snapshotRows, expected: expected.rankingSnapshotRows, pass: check(snapshotRows, expected.rankingSnapshotRows) },
    u19SnapshotRows: { actual: u19SnapshotRows, expected: expected.u19SnapshotRows, pass: check(u19SnapshotRows, expected.u19SnapshotRows) },
    pointTotals: { actual: pointTotals.filter((row) => row.pass).length, expected: pointTotals.length, pass: pointTotalsPass }
  };

  const allExpectedHealthy = Object.values(expectedChecks).every((item) => item.pass);

  return {
    available: true as const,
    submission: {
      id: submission.id,
      title: submission.title,
      status: submission.status,
      imported,
      processed,
      published
    },
    officialData: {
      league: league ? { id: league.id, name: league.name, ageGroup: league.ageGroup } : null,
      season: season && !season.deletedAt ? { id: season.id, name: season.name } : null,
      activeGames,
      activeGameStats,
      detectedTeams: teamNames,
      pointTotals
    },
    ratingsPublishing: {
      formulaVersionId: formulaVersion?.id ?? null,
      gamePerformanceScores,
      playerRatings,
      latestMonthlyRankingSnapshotId: latestSnapshot?.id ?? null,
      latestMonthlyRankingSnapshotRows: snapshotRows,
      validationStatus: allExpectedHealthy ? "Healthy" : "Needs attention"
    },
    globalSafetyCounts: {
      activeGame: globalCounts[0],
      activeGameStat: globalCounts[1],
      gamePerformanceScore: globalCounts[2],
      playerRating: globalCounts[3],
      rankingSnapshot: globalCounts[4],
      rankingSnapshotRow: globalCounts[5]
    },
    expectedChecks,
    overallStatus: allExpectedHealthy ? "Healthy" : "Needs attention"
  };
}
