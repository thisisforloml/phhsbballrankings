import { AgeGroup, PlayerGender, RankingScope, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClassYear, getMonthStart, isRankingEligibleByClassYear } from "@/lib/ranking-eligibility";

const formulaVersionNumber = 1;
const formulaVersionDescription = "Formula v1 possession-informed transparent baseline box-score model";
const defaultMinimumVerifiedGames = 1;

const assumptions = {
  assistCreationShare: 0.35,
  blockRetentionFactor: 0.6,
  stealFactor: 1,
  foulDrawnFactor: 0.35,
  foulCostFactor: 0.35,
  offensiveReboundValueFactor: 1,
  scaling: "percentile",
  leagueWeight: 1,
  opponentFactor: 1,
  teamFactor: 1
} as const;

type SubmissionContext = {
  submissionId: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  expectedGameStats: number;
  minimumVerifiedGames: number;
};

type StatInput = {
  id: string;
  gameId: string;
  playerId: string;
  points: number;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  rebounds: number;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
};

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function starFromAdjustedRating(value: number) {
  if (value >= 90) return 5;
  if (value >= 80) return 4;
  if (value >= 70) return 3;
  if (value >= 60) return 2;
  return 1;
}

function percentileScale(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentileByValue = new Map<number, number>();

  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (percentileByValue.has(value)) continue;

    let last = i;
    while (last + 1 < sorted.length && sorted[last + 1] === value) last += 1;

    const percentile = sorted.length === 1 ? 1 : ((i + last) / 2) / (sorted.length - 1);
    percentileByValue.set(value, percentile);
    i = last;
  }

  return values.map((value) => 1 + (percentileByValue.get(value) ?? 0) * 99);
}

function requiredStatIssues(stat: StatInput) {
  const fields: Array<keyof StatInput> = [
    "points",
    "fieldGoalsMade",
    "fieldGoalsAttempt",
    "threeMade",
    "threeAttempt",
    "freeThrowsMade",
    "freeThrowsAttempt",
    "offensiveRebounds",
    "defensiveRebounds",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "fouls",
    "foulsDrawn"
  ];

  return fields.filter((field) => stat[field] === null || stat[field] === undefined).map((field) => `Missing ${field}.`);
}

async function getFormulaVersion() {
  return prisma.formulaVersion.upsert({
    where: { versionNumber: formulaVersionNumber },
    update: { isPublic: false, weights: assumptions },
    create: {
      versionNumber: formulaVersionNumber,
      description: formulaVersionDescription,
      isPublic: false,
      weights: assumptions,
      effectiveFrom: new Date()
    },
    select: { id: true, versionNumber: true }
  });
}

async function getExistingFormulaVersion() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: formulaVersionNumber },
    select: { id: true, versionNumber: true }
  });

  if (!formulaVersion) throw new Error("FormulaVersion v1 does not exist.");
  return formulaVersion;
}

async function getImportedSubmissionContext(submissionId: string): Promise<SubmissionContext> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, title: true }
  });

  if (!submission) throw new Error("Submission not found.");
  if (submission.status !== SubmissionStatus.IMPORTED) {
    throw new Error("Post-import processing is available only for IMPORTED submissions.");
  }

  if (submission.id !== "a1d0b638-901f-4f89-b8b2-1f2f7281892f") {
    throw new Error("This post-import pipeline currently supports the imported U16 Boys submission only.");
  }

  const league = await prisma.league.findFirst({
    where: { name: "UAAP Season 88 16U Boys Basketball", ageGroup: AgeGroup.U16, deletedAt: null },
    select: { id: true, name: true, ageGroup: true }
  });
  if (!league) throw new Error("Imported U16 league was not found.");

  const season = await prisma.season.findUnique({
    where: { leagueId_name: { leagueId: league.id, name: "Season 88" } },
    select: { id: true, name: true, deletedAt: true }
  });
  if (!season || season.deletedAt) throw new Error("Imported U16 season was not found.");

  return {
    submissionId: submission.id,
    leagueId: league.id,
    leagueName: league.name,
    seasonId: season.id,
    seasonName: season.name,
    ageGroup: AgeGroup.U16,
    gender: PlayerGender.BOYS,
    expectedGameStats: 79,
    minimumVerifiedGames: defaultMinimumVerifiedGames
  };
}

async function getGameStatsForContext(context: SubmissionContext) {
  return prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      game: { seasonId: context.seasonId, deletedAt: null },
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
      where: { deletedAt: null, game: { seasonId: context.seasonId, deletedAt: null }, player: { gender: context.gender, deletedAt: null } }
    }),
    prisma.gamePerformanceScore.count({
      where: { deletedAt: null, formulaVersionId: formulaVersion.id, game: { seasonId: context.seasonId, deletedAt: null }, player: { gender: context.gender, deletedAt: null } }
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
      playerRatings: playerRatingsCount === context.expectedGameStats,
      monthlySnapshot: (latestSnapshot?._count.rows ?? 0) === context.expectedGameStats
    }
  };
}

export async function computeImportedSubmissionFormulaScores(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const now = new Date();
  const formulaVersion = await getFormulaVersion();
  const stats = await getGameStatsForContext(context);

  if (stats.length !== context.expectedGameStats) {
    throw new Error(`Expected ${context.expectedGameStats} U16 GameStats, found ${stats.length}.`);
  }

  const skippedRows = stats
    .map((stat) => ({ statId: stat.id, reasons: requiredStatIssues(stat) }))
    .filter((row) => row.reasons.length);
  if (skippedRows.length) {
    throw new Error(`U16 GameStats have missing required fields: ${JSON.stringify(skippedRows)}`);
  }

  const totals = stats.reduce(
    (sum, stat) => ({
      points: sum.points + stat.points,
      fga: sum.fga + stat.fieldGoalsAttempt!,
      oreb: sum.oreb + stat.offensiveRebounds!,
      dreb: sum.dreb + stat.defensiveRebounds!,
      tov: sum.tov + stat.turnovers!,
      fta: sum.fta + stat.freeThrowsAttempt!
    }),
    { points: 0, fga: 0, oreb: 0, dreb: 0, tov: 0, fta: 0 }
  );

  const leaguePossessions = totals.fga - totals.oreb + totals.tov + 0.44 * totals.fta;
  const leaguePPP = safeDivide(totals.points, leaguePossessions);
  const leagueDefRebRate = safeDivide(totals.dreb, totals.dreb + totals.oreb);
  const leagueOffRebRate = safeDivide(totals.oreb, totals.oreb + totals.dreb);
  if (leaguePPP === null || leagueDefRebRate === null || leagueOffRebRate === null) {
    throw new Error("Could not compute U16 league context.");
  }

  const rawScores = stats.map((stat) => {
    const fgm = stat.fieldGoalsMade!;
    const fga = stat.fieldGoalsAttempt!;
    const threeMade = stat.threeMade!;
    const threeAttempt = stat.threeAttempt!;
    const ftm = stat.freeThrowsMade!;
    const fta = stat.freeThrowsAttempt!;
    const missedFG = fga - fgm;
    const missedFT = fta - ftm;
    const twoMade = fgm - threeMade;
    const twoAttempt = fga - threeAttempt;

    if (missedFG < 0 || missedFT < 0 || twoMade < 0 || twoAttempt < 0) {
      throw new Error(`Invalid shot math for GameStat ${stat.id}.`);
    }

    const effectiveFieldGoalPct = fga === 0 ? null : (fgm + 0.5 * threeMade) / fga;
    const trueShootingDenominator = 2 * (fga + 0.44 * fta);
    const trueShootingPct = trueShootingDenominator === 0 ? null : stat.points / trueShootingDenominator;
    const raw =
      stat.points +
      stat.offensiveRebounds! * leaguePPP * assumptions.offensiveReboundValueFactor +
      stat.defensiveRebounds! * leaguePPP * leagueOffRebRate +
      stat.assists * leaguePPP * assumptions.assistCreationShare +
      stat.steals! * leaguePPP * assumptions.stealFactor +
      stat.blocks! * leaguePPP * assumptions.blockRetentionFactor +
      stat.foulsDrawn! * leaguePPP * assumptions.foulDrawnFactor -
      missedFG * leaguePPP * leagueDefRebRate -
      missedFT * 0.44 * leaguePPP -
      stat.turnovers! * leaguePPP -
      stat.fouls! * leaguePPP * assumptions.foulCostFactor;

    return { stat, raw, effectiveFieldGoalPct, trueShootingPct };
  });

  const scaled = percentileScale(rawScores.map((score) => score.raw));
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rawScores.length; i += 1) {
    const score = rawScores[i];
    const existing = await prisma.gamePerformanceScore.findUnique({ where: { gameStatId: score.stat.id }, select: { id: true } });
    await prisma.gamePerformanceScore.upsert({
      where: { gameStatId: score.stat.id },
      update: {
        gameId: score.stat.gameId,
        playerId: score.stat.playerId,
        formulaVersionId: formulaVersion.id,
        productionScore: score.raw,
        leagueWeight: 1,
        opponentFactor: 1,
        teamFactor: 1,
        performanceScore: scaled[i],
        formulaVersionTag: 1,
        effectiveFieldGoalPct: score.effectiveFieldGoalPct,
        trueShootingPct: score.trueShootingPct,
        finalPerformanceScore: scaled[i],
        processedAt: now,
        deletedAt: null
      },
      create: {
        gameId: score.stat.gameId,
        gameStatId: score.stat.id,
        playerId: score.stat.playerId,
        formulaVersionId: formulaVersion.id,
        productionScore: score.raw,
        leagueWeight: 1,
        opponentFactor: 1,
        teamFactor: 1,
        performanceScore: scaled[i],
        formulaVersionTag: 1,
        effectiveFieldGoalPct: score.effectiveFieldGoalPct,
        trueShootingPct: score.trueShootingPct,
        finalPerformanceScore: scaled[i],
        processedAt: now
      }
    });
    if (existing) updated += 1;
    else created += 1;
  }

  return {
    formulaVersionId: formulaVersion.id,
    leagueId: context.leagueId,
    seasonId: context.seasonId,
    ageGroup: context.ageGroup,
    gender: context.gender,
    totalEligibleGameStats: stats.length,
    gamePerformanceScoresCreated: created,
    gamePerformanceScoresUpdated: updated,
    minRawGameValue: Math.min(...rawScores.map((score) => score.raw)),
    maxRawGameValue: Math.max(...rawScores.map((score) => score.raw)),
    minScaledGameScore: Math.min(...scaled),
    maxScaledGameScore: Math.max(...scaled),
    leagueContext: { leaguePossessions, leaguePPP, leagueDefRebRate, leagueOffRebRate }
  };
}

export async function computeImportedSubmissionPlayerRatings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const formulaVersion = await getExistingFormulaVersion();
  const scores = await prisma.gamePerformanceScore.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      deletedAt: null,
      game: { seasonId: context.seasonId, deletedAt: null },
      player: { gender: context.gender, deletedAt: null }
    },
    include: { player: { select: { id: true, displayName: true } } }
  });

  if (scores.length !== context.expectedGameStats) {
    throw new Error(`Expected ${context.expectedGameStats} U16 GamePerformanceScores, found ${scores.length}.`);
  }

  const byPlayer = new Map<string, { playerId: string; displayName: string; values: number[] }>();
  for (const score of scores) {
    if (score.finalPerformanceScore === null) throw new Error(`Missing finalPerformanceScore for ${score.id}.`);
    const item = byPlayer.get(score.playerId) ?? { playerId: score.playerId, displayName: score.player.displayName, values: [] };
    item.values.push(Number(score.finalPerformanceScore));
    byPlayer.set(score.playerId, item);
  }

  const inputs = [...byPlayer.values()].map((player) => {
    const observedRating = average(player.values);
    const adjustedRating = observedRating;
    return {
      playerId: player.playerId,
      displayName: player.displayName,
      observedRating,
      adjustedRating,
      verifiedGameCount: player.values.length,
      starRating: starFromAdjustedRating(adjustedRating)
    };
  });

  let created = 0;
  let updated = 0;
  for (const rating of inputs) {
    const existing = await prisma.playerRating.findUnique({
      where: { playerId_ageGroup: { playerId: rating.playerId, ageGroup: context.ageGroup } },
      select: { id: true }
    });
    await prisma.playerRating.upsert({
      where: { playerId_ageGroup: { playerId: rating.playerId, ageGroup: context.ageGroup } },
      update: {
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating
      },
      create: {
        playerId: rating.playerId,
        ageGroup: context.ageGroup,
        observedRating: rating.observedRating,
        adjustedRating: rating.adjustedRating,
        verifiedGameCount: rating.verifiedGameCount,
        starRating: rating.starRating
      }
    });
    if (existing) updated += 1;
    else created += 1;
  }

  return {
    formulaVersionId: formulaVersion.id,
    ageGroup: context.ageGroup,
    gender: context.gender,
    totalEligibleGamePerformanceScores: scores.length,
    totalPlayersProcessed: inputs.length,
    playerRatingsCreated: created,
    playerRatingsUpdated: updated,
    minObservedRating: Math.min(...inputs.map((row) => row.observedRating)),
    maxObservedRating: Math.max(...inputs.map((row) => row.observedRating)),
    starDistribution: inputs.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.starRating)] = (acc[String(row.starRating)] ?? 0) + 1;
      return acc;
    }, {}),
    verifiedGameCountDistribution: inputs.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.verifiedGameCount)] = (acc[String(row.verifiedGameCount)] ?? 0) + 1;
      return acc;
    }, {}),
    minimumVerifiedGames: context.minimumVerifiedGames,
    top10Preview: inputs.sort((a, b) => b.adjustedRating - a.adjustedRating).slice(0, 10)
  };
}

export async function generateImportedSubmissionMonthlyRankings(submissionId: string) {
  const context = await getImportedSubmissionContext(submissionId);
  const formulaVersion = await getExistingFormulaVersion();
  const snapshotDate = getMonthStart(new Date());

  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup: context.ageGroup,
      verifiedGameCount: { gte: context.minimumVerifiedGames },
      player: { gender: context.gender, deletedAt: null }
    },
    include: { player: { select: { displayName: true, birthDate: true } } },
    orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
  });

  const eligibleByGames = ratings.map((rating) => ({
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    adjustedRating: Number(rating.adjustedRating),
    verifiedGameCount: rating.verifiedGameCount,
    starRating: rating.starRating,
    birthDate: rating.player.birthDate,
    classYear: getClassYear(rating.player.birthDate)
  }));
  const excludedByClassYear = eligibleByGames.filter((rating) => !isRankingEligibleByClassYear(rating.birthDate, snapshotDate));
  const excludedIds = new Set(excludedByClassYear.map((rating) => rating.playerId));
  const finalRows = eligibleByGames.filter((rating) => !excludedIds.has(rating.playerId));
  const rows = finalRows.map((rating, index) => ({
    playerId: rating.playerId,
    rank: index + 1,
    rating: rating.adjustedRating,
    starRating: rating.starRating,
    verifiedGameCount: rating.verifiedGameCount,
    movement: 0
  }));

  const existing = await prisma.rankingSnapshot.findMany({
    where: {
      scope: RankingScope.NATIONAL,
      ageGroup: context.ageGroup,
      gender: context.gender,
      formulaVersionId: formulaVersion.id,
      weekOf: snapshotDate,
      city: null,
      region: null
    },
    select: { id: true }
  });
  if (existing.length > 1) throw new Error(`Found ${existing.length} U16 Boys snapshots for ${snapshotDate.toISOString()}.`);

  let action: "created" | "updated" | "skipped" = "skipped";
  let snapshotId: string | null = null;
  if (rows.length) {
    if (existing.length === 1) {
      snapshotId = existing[0].id;
      await prisma.$transaction(async (tx) => {
        await tx.rankingSnapshotRow.deleteMany({ where: { snapshotId: snapshotId! } });
        await tx.rankingSnapshot.update({ where: { id: snapshotId! }, data: { rows: { create: rows } } });
      });
      action = "updated";
    } else {
      const snapshot = await prisma.rankingSnapshot.create({
        data: {
          scope: RankingScope.NATIONAL,
          ageGroup: context.ageGroup,
          gender: context.gender,
          formulaVersionId: formulaVersion.id,
          weekOf: snapshotDate,
          city: null,
          region: null,
          rows: { create: rows }
        },
        select: { id: true }
      });
      snapshotId = snapshot.id;
      action = "created";
    }
  }

  return {
    formulaVersionId: formulaVersion.id,
    ageGroup: context.ageGroup,
    gender: context.gender,
    snapshotDate: snapshotDate.toISOString(),
    eligibilityRule: { minimumVerifiedGames: context.minimumVerifiedGames, note: "Temporary U16 launch/test threshold because only 3 games are imported." },
    eligibleByGames: eligibleByGames.length,
    excludedByClassYear: excludedByClassYear.length,
    missingBirthDate: eligibleByGames.filter((row) => row.birthDate === null).length,
    rowsCreated: rows.length,
    snapshotId,
    action,
    top10Preview: finalRows.slice(0, 10).map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      displayName: row.displayName,
      adjustedRating: row.adjustedRating,
      verifiedGameCount: row.verifiedGameCount,
      starRating: row.starRating,
      classYear: row.classYear
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
    where: { deletedAt: null, game: { seasonId: context.seasonId, deletedAt: null }, player: { gender: context.gender, deletedAt: null } },
    include: { player: { select: { displayName: true } } }
  });
  const scores = await prisma.gamePerformanceScore.findMany({
    where: { formulaVersionId: formulaVersion.id, deletedAt: null, game: { seasonId: context.seasonId, deletedAt: null }, player: { gender: context.gender, deletedAt: null } }
  });
  if (gameStats.length !== context.expectedGameStats) issues.push(`Expected ${context.expectedGameStats} GameStats, found ${gameStats.length}.`);
  if (scores.length !== context.expectedGameStats) issues.push(`Expected ${context.expectedGameStats} GamePerformanceScores, found ${scores.length}.`);

  const scoreByGameStat = new Map(scores.map((score) => [score.gameStatId, score]));
  for (const stat of gameStats) {
    if (!scoreByGameStat.has(stat.id)) issues.push(`Missing GamePerformanceScore for ${stat.player.displayName} / ${stat.id}.`);
  }

  const countsByPlayer = new Map<string, number>();
  for (const score of scores) countsByPlayer.set(score.playerId, (countsByPlayer.get(score.playerId) ?? 0) + 1);

  const missingPlayerRatings: Array<{ playerId: string; expected: number }> = [];
  const invalidRatings: string[] = [];
  for (const [playerId, count] of countsByPlayer) {
    const rating = await prisma.playerRating.findUnique({
      where: { playerId_ageGroup: { playerId, ageGroup: context.ageGroup } },
      select: { observedRating: true, adjustedRating: true, verifiedGameCount: true, starRating: true }
    });
    if (!rating) {
      missingPlayerRatings.push({ playerId, expected: count });
      continue;
    }
    const observed = Number(rating.observedRating);
    const adjusted = Number(rating.adjustedRating);
    if (rating.verifiedGameCount !== count) invalidRatings.push(`${playerId} verifiedGameCount expected ${count}, found ${rating.verifiedGameCount}.`);
    if (observed < 1 || observed > 100 || adjusted < 1 || adjusted > 100) invalidRatings.push(`${playerId} rating out of range.`);
    if (rating.starRating !== starFromAdjustedRating(adjusted)) invalidRatings.push(`${playerId} star expected ${starFromAdjustedRating(adjusted)}, found ${rating.starRating}.`);
  }

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { scope: RankingScope.NATIONAL, ageGroup: context.ageGroup, gender: context.gender, formulaVersionId: formulaVersion.id, city: null, region: null },
    include: { rows: { include: { player: { select: { displayName: true, birthDate: true } } }, orderBy: { rank: "asc" } } },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });
  const latest = snapshots.find((snapshot) => isMonthStart(snapshot.weekOf)) ?? null;
  if (!latest) issues.push("Missing latest monthly U16 Boys snapshot.");

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
    if (!isMonthStart(latest.weekOf)) snapshotIssues.push("Latest U16 Boys snapshot is not monthly.");
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
    playersChecked: countsByPlayer.size,
    missingPlayerRatings,
    invalidRatings,
    snapshot: latest ? { id: latest.id, weekOf: latest.weekOf.toISOString(), rowsChecked: snapshotRowsChecked, expectedRows: expectedSnapshotRows, missingBirthDate } : null,
    snapshotIssues,
    u19Regression: {
      gamePerformanceScoreCount: u19GamePerformanceScoreCount,
      playerRatingCount: u19PlayerRatingCount,
      rankingSnapshotRows: u19SnapshotRows,
      expectedGamePerformanceScoreCount: 1885,
      expectedPlayerRatingCount: 181,
      expectedRankingSnapshotRows: 138,
      passed: u19GamePerformanceScoreCount === 1885 && u19PlayerRatingCount === 181 && u19SnapshotRows === 138
    },
    issues,
    validationPassed
  };
}
