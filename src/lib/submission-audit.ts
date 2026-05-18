import { AgeGroup, RankingScope, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMonthStart } from "@/lib/ranking-eligibility";
import { buildSubmissionImportPreflight } from "@/lib/submission-import-preflight";
import { getImportedSubmissionContext } from "@/lib/submission-post-import-processing";

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function checkAtLeast(actual: number | null, expectedValue: number) {
  return (actual ?? 0) >= expectedValue;
}

export async function getSubmissionImportPublishAudit(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, title: true }
  });

  if (!submission) throw new Error("Submission not found.");

  let context: Awaited<ReturnType<typeof getImportedSubmissionContext>> | null = null;
  if (submission.status === SubmissionStatus.IMPORTED) {
    try {
      context = await getImportedSubmissionContext(submissionId);
    } catch (error) {
      return {
        available: false as const,
        reason: error instanceof Error ? error.message : "Unable to read imported submission context."
      };
    }
  }

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: 1 },
    select: { id: true }
  });

  const games = context
    ? await prisma.game.findMany({
        where: { id: { in: context.gameIds }, deletedAt: null },
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

  const monthStart = getMonthStart(new Date());
  const [gamePerformanceScores, playerRatings, latestSnapshot, globalCounts, u19SnapshotRows] = await Promise.all([
    formulaVersion && gameStatIds.length
      ? prisma.gamePerformanceScore.count({
          where: { deletedAt: null, formulaVersionId: formulaVersion.id, gameStatId: { in: gameStatIds } }
        })
      : Promise.resolve(0),
    context
      ? prisma.playerRating.count({
          where: { ageGroup: context.ageGroup, player: { gender: context.gender, deletedAt: null } }
        })
      : Promise.resolve(0),
    formulaVersion && context
      ? prisma.rankingSnapshot.findFirst({
          where: {
            scope: RankingScope.NATIONAL,
            ageGroup: context.ageGroup,
            gender: context.gender,
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
  const expectedGameStats = context?.expectedGameStats ?? 0;
  const snapshotRows = latestSnapshot?._count.rows ?? null;
  const imported = submission.status === SubmissionStatus.IMPORTED && Boolean(context) && activeGames === (context?.gameIds.length ?? 0) && activeGameStats > 0;
  const processed = imported && gamePerformanceScores === expectedGameStats && playerRatings > 0;
  const published = processed && (snapshotRows ?? 0) > 0;
  const pointTotalsPass = pointTotals.length === activeGames && pointTotals.every((row) => row.pass);
  const expectedChecks = {
    importedGames: { actual: activeGames, expected: context?.gameIds.length ?? 0, pass: checkAtLeast(activeGames, context?.gameIds.length ?? 0) },
    importedGameStats: { actual: activeGameStats, expected: expectedGameStats, pass: activeGameStats === expectedGameStats },
    submissionGamePerformanceScores: { actual: gamePerformanceScores, expected: expectedGameStats, pass: gamePerformanceScores === expectedGameStats },
    playerRatings: imported
      ? { actual: playerRatings, expected: 1, pass: playerRatings > 0 }
      : { actual: "Not yet available", expected: "After import", pass: true },
    monthlySnapshotRows: imported
      ? { actual: snapshotRows, expected: 1, pass: (snapshotRows ?? 0) > 0 }
      : { actual: "Not yet available", expected: "After import", pass: true },
    u19SnapshotRows: { actual: u19SnapshotRows, expected: 138, pass: u19SnapshotRows === 138 },
    pointTotals: { actual: pointTotals.filter((row) => row.pass).length, expected: pointTotals.length, pass: pointTotalsPass }
  };

  const issues = Object.entries(expectedChecks)
    .filter(([, item]) => !item.pass)
    .map(([key, item]) => `${key} check failed: ${item.actual} / ${item.expected}`);
  const allExpectedHealthy = issues.length === 0;

  return {
    available: true as const,
    reason: null,
    submission: {
      id: submission.id,
      title: submission.title,
      status: submission.status,
      imported,
      processed,
      published
    },
    officialData: {
      league: context ? { id: context.leagueId, name: context.leagueName, ageGroup: context.ageGroup } : null,
      season: context ? { id: context.seasonId, name: context.seasonName } : null,
      gameNumbers: context?.gameNumbers ?? [],
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
      validationStatus: !imported ? "Not yet available" : allExpectedHealthy ? "Healthy" : "Needs attention"
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
    issues,
    overallStatus: !imported ? "Not yet imported" : allExpectedHealthy ? "Healthy" : "Needs attention"
  };
}

export async function getSubmissionPipelineStatus(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, title: true, leagueName: true, rawText: true, parsedPreview: true }
  });

  if (!submission) throw new Error("Submission not found.");

  let audit: Awaited<ReturnType<typeof getSubmissionImportPublishAudit>> | null = null;
  let preflight: Awaited<ReturnType<typeof buildSubmissionImportPreflight>> | null = null;
  const issues: string[] = [];

  try {
    audit = await getSubmissionImportPublishAudit(submissionId);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Unable to read import audit.");
  }

  try {
    preflight = await buildSubmissionImportPreflight(submission);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Unable to read import preflight.");
  }

  const auditData = audit?.available ? audit : null;
  const imported = submission.status === SubmissionStatus.IMPORTED && Boolean(auditData?.submission.imported);
  const processed = imported && Boolean(auditData?.submission.processed);
  const published = processed && Boolean(auditData?.submission.published);

  return {
    submitted: true,
    underReview: submission.status === SubmissionStatus.UNDER_REVIEW || submission.status === SubmissionStatus.APPROVED || submission.status === SubmissionStatus.IMPORTED,
    approved: submission.status === SubmissionStatus.APPROVED || submission.status === SubmissionStatus.IMPORTED,
    imported,
    processed,
    published,
    issues: [...issues, ...(submission.status === SubmissionStatus.APPROVED && preflight?.overallSummary.importBlocked ? preflight.overallSummary.blockers : []), ...(auditData?.issues ?? [])],
    debug: {
      submissionStatus: submission.status,
      auditAvailable: Boolean(auditData),
      auditOverallStatus: auditData?.overallStatus ?? null,
      auditValidationStatus: auditData?.ratingsPublishing.validationStatus ?? null,
      auditGamePerformanceScores: auditData?.ratingsPublishing.gamePerformanceScores ?? null,
      auditPlayerRatings: auditData?.ratingsPublishing.playerRatings ?? null,
      auditSnapshotRows: auditData?.ratingsPublishing.latestMonthlyRankingSnapshotRows ?? null,
      auditGamePerformanceScoresCheck: auditData?.expectedChecks.submissionGamePerformanceScores ?? null,
      auditPlayerRatingsCheck: auditData?.expectedChecks.playerRatings ?? null,
      auditSnapshotRowsCheck: auditData?.expectedChecks.monthlySnapshotRows ?? null,
      preflightStatus: preflight?.submissionReadiness.status ?? null,
      preflightStatusApproved: preflight?.submissionReadiness.statusApproved ?? null,
      preflightAlreadyImported: preflight?.submissionReadiness.alreadyImported ?? null,
      preflightImportBlocked: preflight?.overallSummary.importBlocked ?? null,
      preflightBlockers: preflight?.overallSummary.blockers ?? [],
      issues
    }
  };
}



