import { AgeGroup, PlayerGender, RankingScope, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveFormulaV1VersionId,
  upsertGamePerformanceScoresForStats
} from "@/lib/formula-v1/compute-game-performance-scores";
import { getActivePolicyVersionId } from "@/lib/ratings/player-rating-query";
import {
  buildTierNormalizedRatingTargets,
  loadTierNormalizedGpsGames
} from "@/lib/ratings/tier-normalized-v1";
import { syncDerivedRatingsForSubmissionBoard } from "@/lib/ratings/sync-derived-ratings";
import { getMonthStart, isRankingEligibleByClassYear } from "@/lib/ranking-eligibility";
import { buildSnapshotBoardRows } from "@/lib/snapshot-board-rows";
import { buildSubmissionReview } from "@/lib/submission-review";
import { formatSubmissionJsonParseError, safeParseSubmissionJson } from "@/lib/submission-json";

function minimumVerifiedGamesForContext(ageGroup: AgeGroup, gender: PlayerGender) {
  if (ageGroup === AgeGroup.U16 && gender === PlayerGender.BOYS) return 1;
  if (ageGroup === AgeGroup.U19 && gender === PlayerGender.BOYS) return 10;
  if (ageGroup === AgeGroup.U19 && gender === PlayerGender.GIRLS) return 5;
  return 1;
}

function rankingContextLabel(ageGroup: AgeGroup, gender: PlayerGender) {
  return `${ageGroup} ${gender === PlayerGender.GIRLS ? "Girls" : "Boys"}`;
}

function eligibilityNote(ageGroup: AgeGroup, gender: PlayerGender) {
  if (ageGroup === AgeGroup.U16 && gender === PlayerGender.BOYS) return "Temporary U16 Boys launch/test threshold.";
  if (ageGroup === AgeGroup.U19 && gender === PlayerGender.BOYS) return "Existing U19 Boys public eligibility threshold.";
  if (ageGroup === AgeGroup.U19 && gender === PlayerGender.GIRLS) return "Existing U19 Girls public eligibility threshold.";
  return "Default launch-stage eligibility threshold.";
}

type SubmissionContext = {
  submissionId: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  gameNumbers: string[];
  gameIds: string[];
  expectedGameStats: number;
  minimumVerifiedGames: number;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function coerceAgeGroup(value: string | null): AgeGroup | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(AgeGroup).includes(normalized as AgeGroup) ? (normalized as AgeGroup) : null;
}

function inferGender(value: "BOYS" | "GIRLS" | null): PlayerGender {
  return value === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
}

function parseSubmissionJson(submission: { rawText: string | null; parsedPreview: unknown }) {
  const result = safeParseSubmissionJson(submission);
  if (!result.ok) throw new Error(formatSubmissionJsonParseError(result) ?? "Submission JSON is not valid.");
  return result.data;
}

function getPackages(parsed: unknown): JsonRecord[] {
  const root = asRecord(parsed);
  if (root) return [root];
  return asArray(parsed).map(asRecord).filter((item): item is JsonRecord => item !== null);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

async function getExistingFormulaVersion() {
  const id = await resolveFormulaV1VersionId();
  return { id };
}

export async function getImportedSubmissionContext(submissionId: string): Promise<SubmissionContext> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, title: true, leagueName: true, rawText: true, parsedPreview: true }
  });

  if (!submission) throw new Error("Submission not found.");
  if (submission.status !== SubmissionStatus.IMPORTED) {
    throw new Error("Post-import processing is available only for IMPORTED submissions.");
  }

  const review = buildSubmissionReview(submission);
  if (!review.validJson) throw new Error(review.parseError ?? "Submission JSON is not valid.");

  const parsed = parseSubmissionJson(submission);
  const packages = getPackages(parsed);
  const primaryPackage = packages[0] ?? null;
  const leagueRecord = asRecord(primaryPackage?.league);
  const seasonRecord = asRecord(primaryPackage?.season);
  const games = packages.flatMap((submissionPackage) => asArray(submissionPackage.games).map(asRecord).filter((game): game is JsonRecord => game !== null));
  const targetAgeGroup = coerceAgeGroup(review.summary.ageGroup);
  const targetGender = inferGender(review.recommendations.inferredGender);
  const targetLeagueName = review.recommendations.recommendedLeagueName ?? review.summary.leagueName ?? submission.leagueName ?? submission.title;
  const seasonName = stringValue(seasonRecord?.name) || review.summary.seasonName;
  const gameNumbers = unique(games.map((game) => stringValue(game.gameNumber)).filter(Boolean));

  if (!primaryPackage) throw new Error("Submission JSON package was not found.");
  if (!targetAgeGroup) throw new Error(`Unsupported or missing age group: ${review.summary.ageGroup ?? "missing"}.`);
  if (!seasonName) throw new Error("Season name is missing.");
  if (!gameNumbers.length) throw new Error("Submission does not include any game numbers.");

  const submittedLeagueName = stringValue(leagueRecord?.name) || review.summary.leagueName;
  const league = await prisma.league.findFirst({
    where: { name: targetLeagueName, ageGroup: targetAgeGroup, deletedAt: null },
    select: { id: true, name: true, ageGroup: true }
  });
  if (!league) {
    throw new Error(`Imported league was not found for ${targetLeagueName} (${targetAgeGroup}). Submitted league: ${submittedLeagueName ?? "missing"}.`);
  }

  const season = await prisma.season.findUnique({
    where: { leagueId_name: { leagueId: league.id, name: seasonName } },
    select: { id: true, name: true, deletedAt: true }
  });
  if (!season || season.deletedAt) throw new Error(`Imported season was not found for ${league.name} / ${seasonName}.`);

  const importedGames = await prisma.game.findMany({
    where: { seasonId: season.id, gameNumber: { in: gameNumbers }, deletedAt: null },
    select: { id: true, gameNumber: true }
  });
  const importedGameNumbers = new Set(importedGames.map((game) => game.gameNumber).filter(Boolean));
  const missingGameNumbers = gameNumbers.filter((gameNumber) => !importedGameNumbers.has(gameNumber));
  if (missingGameNumbers.length) {
    throw new Error(`Imported games were not found for submitted game numbers: ${missingGameNumbers.join(", ")}.`);
  }

  const gameIds = importedGames.map((game) => game.id);
  const expectedGameStats = await prisma.gameStat.count({
    where: { deletedAt: null, gameId: { in: gameIds }, player: { gender: targetGender, deletedAt: null } }
  });
  if (expectedGameStats === 0) {
    throw new Error("Imported games do not have active GameStats for the inferred submission gender.");
  }

  return {
    submissionId: submission.id,
    leagueId: league.id,
    leagueName: league.name,
    seasonId: season.id,
    seasonName: season.name,
    ageGroup: league.ageGroup,
    gender: targetGender,
    gameNumbers,
    gameIds,
    expectedGameStats,
    minimumVerifiedGames: minimumVerifiedGamesForContext(targetAgeGroup, targetGender)
  };
}
async function getGameStatsForContext(context: SubmissionContext) {
  return prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      gameId: { in: context.gameIds },
      player: { gender: context.gender, deletedAt: null }
    },
    select: {
      id: true,
      gameId: true,
      playerId: true,
      points: true,
      fieldGoalsMade: true,
      fieldGoalsAttempt: true,
      threeMade: true,
      threeAttempt: true,
      freeThrowsMade: true,
      freeThrowsAttempt: true,
      offensiveRebounds: true,
      defensiveRebounds: true,
      rebounds: true,
      assists: true,
      steals: true,
      blocks: true,
      turnovers: true,
      fouls: true,
      foulsDrawn: true
    }
  });
}

export async function getImportedSubmissionProcessingStatus(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const formulaVersion = await getExistingFormulaVersion();
  const snapshotDate = getMonthStart(new Date());

  const [gameStatsCount, gamePerformanceScoresCount, playerRatingsCount, latestSnapshot, missingBirthDateCount] = await Promise.all([
    prisma.gameStat.count({
      where: { deletedAt: null, gameId: { in: context.gameIds }, player: { gender: context.gender, deletedAt: null } }
    }),
    prisma.gamePerformanceScore.count({
      where: { deletedAt: null, formulaVersionId: formulaVersion.id, gameId: { in: context.gameIds }, player: { gender: context.gender, deletedAt: null } }
    }),
    prisma.playerRating.count({
      where: { ageGroup: context.ageGroup, player: { gender: context.gender, deletedAt: null } }
    }),
    prisma.rankingSnapshot.findFirst({
      where: {
        scope: RankingScope.NATIONAL,
        ageGroup: context.ageGroup,
        gender: context.gender,
        formulaVersionId: formulaVersion.id,
        weekOf: snapshotDate,
        city: null,
        region: null
      },
      include: { _count: { select: { rows: true } } },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
    }),
    prisma.playerRating.count({
      where: { ageGroup: context.ageGroup, player: { gender: context.gender, deletedAt: null, birthDate: null } }
    })
  ]);

  return {
    submissionId,
    formulaVersionId: formulaVersion.id,
    leagueId: context.leagueId,
    leagueName: context.leagueName,
    seasonId: context.seasonId,
    seasonName: context.seasonName,
    ageGroup: context.ageGroup,
    gender: context.gender,
    expectedGameStats: context.expectedGameStats,
    minimumVerifiedGames: context.minimumVerifiedGames,
    snapshotDate: snapshotDate.toISOString(),
    gameStatsCount,
    gamePerformanceScoresCount,
    playerRatingsCount,
    monthlyRankingSnapshotId: latestSnapshot?.id ?? null,
    monthlyRankingSnapshotRows: latestSnapshot?._count.rows ?? 0,
    missingBirthDateCount,
    complete: {
      formulaScores: gamePerformanceScoresCount === context.expectedGameStats,
      playerRatings: playerRatingsCount > 0,
      monthlySnapshot: (latestSnapshot?._count.rows ?? 0) > 0
    }
  };
}

export async function computeImportedSubmissionFormulaScores(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const stats = await getGameStatsForContext(context);

  if (stats.length !== context.expectedGameStats) {
    throw new Error(`Expected ${context.expectedGameStats} imported GameStats, found ${stats.length}.`);
  }

  const result = await upsertGamePerformanceScoresForStats(stats);

  return {
    formulaVersionId: result.formulaVersionId,
    leagueId: context.leagueId,
    seasonId: context.seasonId,
    ageGroup: context.ageGroup,
    gender: context.gender,
    totalEligibleGameStats: result.totalEligibleGameStats,
    gamePerformanceScoresCreated: result.created,
    gamePerformanceScoresUpdated: result.updated,
    minRawGameValue: result.minRawGameValue,
    maxRawGameValue: result.maxRawGameValue,
    minScaledGameScore: result.minScaledGameScore,
    maxScaledGameScore: result.maxScaledGameScore,
    leagueContext: result.leagueContext
  };
}

export async function refreshImportedSubmissionDerivedRatings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  return syncDerivedRatingsForSubmissionBoard({
    ageGroup: context.ageGroup,
    gender: context.gender
  });
}

export async function computeImportedSubmissionPlayerRatings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const formulaVersion = await getExistingFormulaVersion();

  const submissionScores = await prisma.gamePerformanceScore.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      deletedAt: null,
      game: { seasonId: context.seasonId, deletedAt: null },
      player: { gender: context.gender, deletedAt: null }
    },
    select: { id: true, playerId: true, finalPerformanceScore: true }
  });

  if (submissionScores.length < context.expectedGameStats) {
    throw new Error(
      `Expected at least ${context.expectedGameStats} ${context.ageGroup} GamePerformanceScores for this submission, found ${submissionScores.length}.`
    );
  }

  for (const score of submissionScores) {
    if (score.finalPerformanceScore === null) {
      throw new Error(`Missing finalPerformanceScore for ${score.id}.`);
    }
  }

  const sync = await refreshImportedSubmissionDerivedRatings(submissionId);
  const tierGames = await loadTierNormalizedGpsGames({ ageGroup: context.ageGroup });
  const inputs = buildTierNormalizedRatingTargets(tierGames);

  const playerNames = await prisma.player.findMany({
    where: { id: { in: inputs.map((row) => row.playerId) }, deletedAt: null },
    select: { id: true, displayName: true }
  });
  const displayNameById = new Map(playerNames.map((player) => [player.id, player.displayName]));
  const previewInputs = inputs.map((row) => ({
    ...row,
    displayName: displayNameById.get(row.playerId) ?? row.playerId
  }));

  return {
    formulaVersionId: formulaVersion.id,
    ageGroup: context.ageGroup,
    gender: context.gender,
    aggregationScope: "playerId + league.ageGroup (Formula v1 tier-normalized cumulative GPS)",
    submissionGamePerformanceScores: submissionScores.length,
    totalEligibleGamePerformanceScores: tierGames.length,
    totalPlayersProcessed: sync.playerRatings.totalPlayersProcessed,
    playerRatingsCreated: sync.playerRatings.created,
    playerRatingsUpdated: sync.playerRatings.updated,
    homeBoardProjectionsCreated: sync.homeBoard.created,
    homeBoardProjectionsUpdated: sync.homeBoard.updated,
    minObservedRating: inputs.length ? Math.min(...inputs.map((row) => row.observedRating)) : null,
    maxObservedRating: inputs.length ? Math.max(...inputs.map((row) => row.observedRating)) : null,
    starDistribution: inputs.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.starRating)] = (acc[String(row.starRating)] ?? 0) + 1;
      return acc;
    }, {}),
    verifiedGameCountDistribution: inputs.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.verifiedGameCount)] = (acc[String(row.verifiedGameCount)] ?? 0) + 1;
      return acc;
    }, {}),
    minimumVerifiedGames: context.minimumVerifiedGames,
    top10Preview: previewInputs.sort((a, b) => b.adjustedRating - a.adjustedRating).slice(0, 10)
  };
}

export async function computeImportedSubmissionTeamRatings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const sync = await refreshImportedSubmissionDerivedRatings(submissionId);
  return {
    submissionId,
    ageGroup: context.ageGroup,
    gender: context.gender,
    upserted: sync.teamRatings.upserted,
    deleted: sync.teamRatings.deleted,
    totalRows: sync.teamRatings.totalRows
  };
}

export async function generateImportedSubmissionMonthlyRankings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const formulaVersion = await getExistingFormulaVersion();
  const snapshotDate = getMonthStart(new Date());
  const sync = await refreshImportedSubmissionDerivedRatings(submissionId);
  const boardSnapshot = sync.snapshots?.results.find(
    (row) => row.ageGroup === context.ageGroup && row.gender === context.gender
  );

  const built = await buildSnapshotBoardRows({
    ageGroup: context.ageGroup,
    gender: context.gender,
    evaluationDate: snapshotDate,
    formulaVersionId: formulaVersion.id
  });

  return {
    formulaVersionId: formulaVersion.id,
    ageGroup: context.ageGroup,
    gender: context.gender,
    snapshotDate: snapshotDate.toISOString(),
    snapshotPolicy: "rev-2-public-rank-allowed",
    eligibilityRule: { minimumVerifiedGames: context.minimumVerifiedGames, note: eligibilityNote(context.ageGroup, context.gender) },
    poolAtThreshold: built.poolAtThreshold,
    excludedByVisibility: built.excludedByVisibility,
    verifiedCount: built.verifiedCount,
    pendingCount: built.pendingCount,
    rowsCreated: boardSnapshot?.rowsCreated ?? 0,
    snapshotId: boardSnapshot?.snapshotId ?? null,
    action: boardSnapshot?.action ?? "skipped",
    top10Preview: built.rows.slice(0, 10).map((row) => ({
      rank: row.rank,
      playerId: row.playerId,
      adjustedRating: row.rating,
      verifiedGameCount: row.verifiedGameCount,
      starRating: row.starRating,
      ageVerificationStatus: row.ageVerificationStatus
    }))
  };
}

function isMonthStart(date: Date) {
  return date.getTime() === getMonthStart(date).getTime();
}

export async function validateImportedSubmissionRankings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const formulaVersion = await getExistingFormulaVersion();
  const issues: string[] = [];

  const gameStats = await prisma.gameStat.findMany({
    where: { deletedAt: null, gameId: { in: context.gameIds }, player: { gender: context.gender, deletedAt: null } },
    include: { player: { select: { displayName: true } } }
  });
  const scores = await prisma.gamePerformanceScore.findMany({
    where: { formulaVersionId: formulaVersion.id, deletedAt: null, gameId: { in: context.gameIds }, player: { gender: context.gender, deletedAt: null } }
  });
  if (gameStats.length !== context.expectedGameStats) issues.push(`Expected ${context.expectedGameStats} GameStats, found ${gameStats.length}.`);
  if (scores.length !== context.expectedGameStats) issues.push(`Expected ${context.expectedGameStats} GamePerformanceScores, found ${scores.length}.`);

  const scoreByGameStat = new Map(scores.map((score) => [score.gameStatId, score]));
  for (const stat of gameStats) {
    if (!scoreByGameStat.has(stat.id)) issues.push(`Missing GamePerformanceScore for ${stat.player.displayName} / ${stat.id}.`);
  }

  const seasonScores = await prisma.gamePerformanceScore.findMany({
    where: { formulaVersionId: formulaVersion.id, deletedAt: null, game: { seasonId: context.seasonId, deletedAt: null }, player: { gender: context.gender, deletedAt: null } }
  });
  const tierGames = await loadTierNormalizedGpsGames({ ageGroup: context.ageGroup });
  const targets = buildTierNormalizedRatingTargets(tierGames);
  const targetByPlayer = new Map(targets.map((row) => [row.playerId, row]));

  const missingPlayerRatings: Array<{ playerId: string; expected: number }> = [];
  const invalidRatings: string[] = [];
  const activePolicy = getActivePolicyVersionId();
  for (const target of targets) {
    const rating = await prisma.playerRating.findUnique({
      where: {
        playerId_ageGroup_formulaVersionId_policyVersionId: {
          playerId: target.playerId,
          ageGroup: context.ageGroup,
          formulaVersionId: formulaVersion.id,
          policyVersionId: activePolicy
        }
      },
      select: { observedRating: true, adjustedRating: true, verifiedGameCount: true, starRating: true }
    });
    if (!rating) {
      missingPlayerRatings.push({ playerId: target.playerId, expected: target.verifiedGameCount });
      continue;
    }
    const observed = Number(rating.observedRating);
    const adjusted = Number(rating.adjustedRating);
    if (rating.verifiedGameCount !== target.verifiedGameCount) {
      invalidRatings.push(
        `${target.playerId} verifiedGameCount expected ${target.verifiedGameCount} (tier-normalized GPS), found ${rating.verifiedGameCount}.`
      );
    }
    if (Math.abs(observed - target.observedRating) > 0.01) {
      invalidRatings.push(`${target.playerId} observedRating expected ${target.observedRating}, found ${observed}.`);
    }
    if (Math.abs(adjusted - target.adjustedRating) > 0.01) {
      invalidRatings.push(`${target.playerId} adjustedRating expected ${target.adjustedRating}, found ${adjusted}.`);
    }
    if (observed < 1 || observed > 100 || adjusted < 1 || adjusted > 100) invalidRatings.push(`${target.playerId} rating out of range.`);
    if (rating.starRating !== target.starRating) {
      invalidRatings.push(`${target.playerId} star expected ${target.starRating}, found ${rating.starRating}.`);
    }
  }

  const orphanRatings = await prisma.playerRating.findMany({
    where: {
      ageGroup: context.ageGroup,
      formulaVersionId: formulaVersion.id,
      policyVersionId: activePolicy,
      player: { gender: context.gender, deletedAt: null }
    },
    select: { playerId: true, verifiedGameCount: true }
  });
  for (const rating of orphanRatings) {
    if (!targetByPlayer.has(rating.playerId)) {
      invalidRatings.push(`${rating.playerId} has PlayerRating without tier-normalized GPS for ${context.ageGroup}.`);
    }
  }

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { scope: RankingScope.NATIONAL, ageGroup: context.ageGroup, gender: context.gender, formulaVersionId: formulaVersion.id, city: null, region: null },
    include: { rows: { include: { player: { select: { displayName: true, birthDate: true } } }, orderBy: { rank: "asc" } } },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });
  const latest = snapshots.find((snapshot) => isMonthStart(snapshot.weekOf)) ?? null;
  if (!latest) issues.push(`Missing latest monthly ${rankingContextLabel(context.ageGroup, context.gender)} snapshot.`);

  let snapshotIssues: string[] = [];
  let expectedSnapshotRows = 0;
  let snapshotRowsChecked = 0;
  let missingBirthDate = 0;
  if (latest) {
    const expectedRatings = await prisma.playerRating.findMany({
      where: { ageGroup: context.ageGroup, verifiedGameCount: { gte: context.minimumVerifiedGames }, player: { gender: context.gender, deletedAt: null } },
      include: { player: { select: { displayName: true, birthDate: true } } },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
    });
    const eligible = expectedRatings.filter((rating) => isRankingEligibleByClassYear(rating.player.birthDate, latest.weekOf));
    expectedSnapshotRows = eligible.length;
    snapshotRowsChecked = latest.rows.length;
    missingBirthDate = eligible.filter((rating) => rating.player.birthDate === null).length;
    if (!isMonthStart(latest.weekOf)) snapshotIssues.push(`Latest ${rankingContextLabel(context.ageGroup, context.gender)} snapshot is not monthly.`);
    if (latest.rows.length !== eligible.length) snapshotIssues.push(`Expected ${eligible.length} rows, found ${latest.rows.length}.`);

    const expectedByPlayer = new Map(eligible.map((rating, index) => [rating.playerId, { rating, rank: index + 1 }]));
    let previousRating: number | null = null;
    const ranks = new Set<number>();
    const players = new Set<string>();
    for (const row of latest.rows) {
      const expected = expectedByPlayer.get(row.playerId);
      const actualRating = Number(row.rating);
      if (!expected) snapshotIssues.push(`${row.player.displayName} is not expected eligible.`);
      if (ranks.has(row.rank)) snapshotIssues.push(`Duplicate rank ${row.rank}.`);
      ranks.add(row.rank);
      if (players.has(row.playerId)) snapshotIssues.push(`Duplicate player ${row.playerId}.`);
      players.add(row.playerId);
      if (previousRating !== null && actualRating > previousRating) snapshotIssues.push("Rows are not sorted by rating desc.");
      previousRating = actualRating;
      if (!isRankingEligibleByClassYear(row.player.birthDate, latest.weekOf)) snapshotIssues.push(`${row.player.displayName} is class-year ineligible.`);
      if (expected) {
        if (row.rank !== expected.rank) snapshotIssues.push(`${row.player.displayName} expected rank ${expected.rank}, found ${row.rank}.`);
        if (Math.abs(actualRating - Number(expected.rating.adjustedRating)) > 0.01) snapshotIssues.push(`${row.player.displayName} rating mismatch.`);
        if (row.starRating !== expected.rating.starRating) snapshotIssues.push(`${row.player.displayName} star mismatch.`);
        if (row.verifiedGameCount !== expected.rating.verifiedGameCount) snapshotIssues.push(`${row.player.displayName} game count mismatch.`);
      }
    }
    for (let rank = 1; rank <= latest.rows.length; rank += 1) {
      if (!ranks.has(rank)) snapshotIssues.push(`Missing rank ${rank}.`);
    }
  }

  const [u19GamePerformanceScoreCount, u19PlayerRatingCount, u19SnapshotRows] = await Promise.all([
    prisma.gamePerformanceScore.count({ where: { deletedAt: null, game: { season: { league: { ageGroup: AgeGroup.U19 } } } } }),
    prisma.playerRating.count({ where: { ageGroup: AgeGroup.U19 } }),
    prisma.rankingSnapshotRow.count({ where: { snapshot: { ageGroup: AgeGroup.U19, formulaVersionId: formulaVersion.id } } })
  ]);

  const validationPassed = issues.length === 0 && missingPlayerRatings.length === 0 && invalidRatings.length === 0 && snapshotIssues.length === 0;

  return {
    formulaVersionId: formulaVersion.id,
    ageGroup: context.ageGroup,
    gender: context.gender,
    expectedGameStats: context.expectedGameStats,
    gameStatsChecked: gameStats.length,
    gamePerformanceScoresChecked: scores.length,
    submissionGamePerformanceScoresChecked: seasonScores.length,
    cumulativeGpsPlayersChecked: targets.length,
    aggregationScope: "playerId + league.ageGroup (Formula v1 tier-normalized cumulative GPS)",
    missingPlayerRatings,
    invalidRatings,
    snapshot: latest ? { id: latest.id, weekOf: latest.weekOf.toISOString(), rowsChecked: snapshotRowsChecked, expectedRows: expectedSnapshotRows, missingBirthDate } : null,
    snapshotIssues,
    u19Inventory: {
      gamePerformanceScoreCount: u19GamePerformanceScoreCount,
      playerRatingCount: u19PlayerRatingCount,
      rankingSnapshotRows: u19SnapshotRows
    },
    issues,
    validationPassed
  };
}









