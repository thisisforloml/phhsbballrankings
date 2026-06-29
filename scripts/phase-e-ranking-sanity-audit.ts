/**
 * Validation Phase E — read-only ranking sanity audit.
 * Usage: npx tsx scripts/phase-e-ranking-sanity-audit.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { getPublicBoardRows, publicBoardMinimumGames } from "../src/lib/public-board-ranks";
import { getLatestNationalRankings, type RankingAgeGroup } from "../src/lib/rankings";

type Severity = "critical" | "high" | "medium" | "low" | "info";

type Finding = {
  id: string;
  severity: Severity;
  category: string;
  summary: string;
  count: number;
  sample?: unknown[];
};

const FORMULA_V1 = 1;
const AGE_GROUPS: AgeGroup[] = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19];
const RATING_AGE_GROUPS: RankingAgeGroup[] = ["U13", "U16", "U19"];

function starFromAdjustedRating(value: number) {
  if (value >= 90) return 5;
  if (value >= 80) return 4;
  if (value >= 70) return 3;
  if (value >= 60) return 2;
  return 1;
}

function genderLabel(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function distribution(values: number[]) {
  if (!values.length) return { count: 0, min: null, max: null, mean: null, median: null, p25: null, p75: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  return { count: sorted.length, min: sorted[0], max: sorted.at(-1)!, mean, median, p25, p75 };
}

async function main() {
  const findings: Finding[] = [];
  const blockers: string[] = [];

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1 },
    select: { id: true, versionNumber: true }
  });

  const [
    playerRatingCount,
    gpsCount,
    snapshotCount,
    snapshotRowCount,
    activePlayersWithRatings
  ] = await Promise.all([
    prisma.playerRating.count(),
    prisma.gamePerformanceScore.count({ where: { deletedAt: null, formulaVersion: { versionNumber: FORMULA_V1 } } }),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.player.count({ where: { deletedAt: null, currentRatings: { some: {} } } })
  ]);

  const playerRatings = await prisma.playerRating.findMany({
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true,
          ageGroupOverride: true,
          deletedAt: true
        }
      }
    },
    orderBy: [{ ageGroup: "asc" }, { adjustedRating: "desc" }]
  });

  const gpsByPlayerAge = await prisma.$queryRaw<
    Array<{
      player_id: string;
      age_group: AgeGroup;
      gps_count: number;
      avg_final_score: number;
      min_final_score: number;
      max_final_score: number;
      league_names: string[];
    }>
  >`
    SELECT
      gps."playerId" AS player_id,
      l."ageGroup" AS age_group,
      COUNT(*)::int AS gps_count,
      AVG(gps."finalPerformanceScore")::float AS avg_final_score,
      MIN(gps."finalPerformanceScore")::float AS min_final_score,
      MAX(gps."finalPerformanceScore")::float AS max_final_score,
      array_agg(DISTINCT l.name ORDER BY l.name) AS league_names
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
    JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
    JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
    JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
    WHERE gps."deletedAt" IS NULL
      AND fv."versionNumber" = ${FORMULA_V1}
      AND gps."finalPerformanceScore" IS NOT NULL
    GROUP BY gps."playerId", l."ageGroup"
  `;

  const gpsMap = new Map(gpsByPlayerAge.map((row) => [`${row.player_id}|${row.age_group}`, row]));

  type RatingAuditRow = {
    playerId: string;
    displayName: string;
    gender: PlayerGender;
    ageGroup: AgeGroup;
    storedObserved: number;
    storedAdjusted: number;
    storedVerifiedGames: number;
    storedStars: number;
    recomputedObserved: number | null;
    gpsCount: number;
    verifiedGameDelta: number;
    ratingDelta: number | null;
    starMismatch: boolean;
    dominantLeagues: string[];
    computedAgeBracket: ReturnType<typeof getCurrentRankingAgeBracket>;
    wrongBoardAssignment: boolean;
    crossAgeGroupGps: string[];
  };

  const auditRows: RatingAuditRow[] = [];

  for (const rating of playerRatings) {
    if (rating.player.deletedAt) continue;
    const key = `${rating.playerId}|${rating.ageGroup}`;
    const gps = gpsMap.get(key);
    const recomputedObserved = gps ? gps.avg_final_score : null;
    const storedObserved = Number(rating.observedRating);
    const storedAdjusted = Number(rating.adjustedRating);
    const gpsCountForBoard = gps?.gps_count ?? 0;
    const ratingDelta =
      recomputedObserved === null ? null : Math.abs(storedObserved - recomputedObserved);
    const computedAgeBracket = getCurrentRankingAgeBracket(
      rating.player.birthDate,
      new Date(),
      rating.player.classYearOverride,
      rating.ageGroup
    );

    const crossAgeGroupGps = gpsByPlayerAge
      .filter((row) => row.player_id === rating.playerId && row.age_group !== rating.ageGroup)
      .map((row) => `${row.age_group}:${row.gps_count}`);

    auditRows.push({
      playerId: rating.playerId,
      displayName: rating.player.displayName,
      gender: rating.player.gender,
      ageGroup: rating.ageGroup,
      storedObserved,
      storedAdjusted,
      storedVerifiedGames: rating.verifiedGameCount,
      storedStars: rating.starRating,
      recomputedObserved,
      gpsCount: gpsCountForBoard,
      verifiedGameDelta: rating.verifiedGameCount - gpsCountForBoard,
      ratingDelta,
      starMismatch: rating.starRating !== starFromAdjustedRating(storedAdjusted),
      dominantLeagues: gps?.league_names ?? [],
      computedAgeBracket,
      wrongBoardAssignment:
        computedAgeBracket !== null &&
        computedAgeBracket !== "OUT_OF_RANGE" &&
        computedAgeBracket !== rating.ageGroup,
      crossAgeGroupGps
    });
  }

  const boardDistributions = RATING_AGE_GROUPS.map((ageGroup) => {
    const rows = auditRows.filter((row) => row.ageGroup === ageGroup);
    return {
      ageGroup,
      boys: distribution(rows.filter((row) => row.gender === PlayerGender.BOYS).map((row) => row.storedAdjusted)),
      girls: distribution(rows.filter((row) => row.gender === PlayerGender.GIRLS).map((row) => row.storedAdjusted)),
      starDistribution: rows.reduce<Record<string, number>>((acc, row) => {
        acc[String(row.storedStars)] = (acc[String(row.storedStars)] ?? 0) + 1;
        return acc;
      }, {})
    };
  });

  const topByBoard = RATING_AGE_GROUPS.flatMap((ageGroup) =>
    (["Boys", "Girls"] as const).map((genderLabelValue) => {
      const gender = genderLabelValue === "Girls" ? PlayerGender.GIRLS : PlayerGender.BOYS;
      const minGames = publicBoardMinimumGames(genderLabelValue);
      const boardRows = auditRows
        .filter((row) => row.ageGroup === ageGroup && row.gender === gender)
        .sort((a, b) => b.storedAdjusted - a.storedAdjusted);
      const publicEligible = boardRows.filter((row) => row.storedVerifiedGames >= minGames);
      return {
        board: `${ageGroup} ${genderLabelValue}`,
        minimumGames: minGames,
        totalRatedPlayers: boardRows.length,
        publicEligibleCount: publicEligible.length,
        top10: publicEligible.slice(0, 10).map((row, index) => ({
          rank: index + 1,
          displayName: row.displayName,
          adjustedRating: Number(row.storedAdjusted.toFixed(2)),
          verifiedGameCount: row.storedVerifiedGames,
          gpsCount: row.gpsCount,
          stars: row.storedStars,
          dominantLeagues: row.dominantLeagues.slice(0, 3)
        })),
        top10BelowMinGames: boardRows
          .filter((row) => row.storedVerifiedGames < minGames)
          .slice(0, 5)
          .map((row) => ({
            displayName: row.displayName,
            adjustedRating: Number(row.storedAdjusted.toFixed(2)),
            verifiedGameCount: row.storedVerifiedGames
          }))
      };
    })
  );

  const verifiedGameMismatches = auditRows.filter((row) => row.verifiedGameDelta !== 0);
  const ratingMismatches = auditRows.filter((row) => row.ratingDelta !== null && row.ratingDelta > 0.5);
  const starMismatches = auditRows.filter((row) => row.starMismatch);
  const wrongBoardAssignments = auditRows.filter((row) => row.wrongBoardAssignment);
  const lowSampleHighRating = auditRows.filter((row) => {
    const minGames = publicBoardMinimumGames(genderLabel(row.gender));
    return row.storedVerifiedGames < minGames && row.storedAdjusted >= 75;
  });
  const lowSampleOnPublicBoard: RatingAuditRow[] = [];

  const nationalRankings = await getLatestNationalRankings();
  for (const ageGroup of RATING_AGE_GROUPS) {
    for (const genderKey of ["boys", "girls"] as const) {
      const snapshot = nationalRankings.snapshotsByAge[ageGroup][genderKey];
      const publicRows = getPublicBoardRows(snapshot);
      for (const row of publicRows) {
        const audit = auditRows.find((item) => item.playerId === row.playerId && item.ageGroup === ageGroup);
        if (!audit) continue;
        const minGames = publicBoardMinimumGames(row.gender);
        if (audit.storedVerifiedGames < minGames) lowSampleOnPublicBoard.push(audit);
      }
    }
  }

  const boardMeans = boardDistributions.map((board) => ({
    ageGroup: board.ageGroup,
    boysMean: board.boys.mean,
    girlsMean: board.girls.mean
  }));
  const statisticalOutliers = auditRows.filter((row) => {
    const boardMean = boardMeans.find((board) => board.ageGroup === row.ageGroup);
    const mean =
      row.gender === PlayerGender.GIRLS ? boardMean?.girlsMean : boardMean?.boysMean;
    if (mean === null || mean === undefined) return false;
    return row.storedAdjusted > mean + 20;
  });

  const snapshots = await prisma.rankingSnapshot.findMany({
    include: {
      rows: {
        include: { player: { select: { displayName: true, gender: true, deletedAt: true } } },
        orderBy: { rank: "asc" }
      },
      formulaVersion: { select: { versionNumber: true } }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const snapshotVsLiveRating: Array<{
    snapshotId: string;
    ageGroup: AgeGroup | null;
    gender: PlayerGender;
    weekOf: string;
    rowCount: number;
    ratingMismatches: number;
    gameCountMismatches: number;
    sampleMismatches: unknown[];
  }> = [];

  for (const snapshot of snapshots) {
    let ratingMismatchesCount = 0;
    let gameCountMismatchesCount = 0;
    const samples: unknown[] = [];
    for (const row of snapshot.rows) {
      if (!snapshot.ageGroup) continue;
      const live = auditRows.find(
        (item) => item.playerId === row.playerId && item.ageGroup === snapshot.ageGroup
      );
      if (!live) continue;
      const ratingDelta = Math.abs(Number(row.rating) - live.storedAdjusted);
      const gameDelta = row.verifiedGameCount - live.storedVerifiedGames;
      if (ratingDelta > 0.5) {
        ratingMismatchesCount += 1;
        if (samples.length < 5) {
          samples.push({
            player: row.player.displayName,
            snapshotRating: Number(row.rating),
            liveRating: live.storedAdjusted,
            delta: ratingDelta
          });
        }
      }
      if (gameDelta !== 0) gameCountMismatchesCount += 1;
    }
    snapshotVsLiveRating.push({
      snapshotId: snapshot.id,
      ageGroup: snapshot.ageGroup,
      gender: snapshot.gender,
      weekOf: snapshot.weekOf.toISOString().slice(0, 10),
      rowCount: snapshot.rows.length,
      ratingMismatches: ratingMismatchesCount,
      gameCountMismatches: gameCountMismatchesCount,
      sampleMismatches: samples
    });
  }

  const ncaaTop = auditRows
    .filter(
      (row) =>
        row.ageGroup === AgeGroup.U19 &&
        row.dominantLeagues.some((league) => /NCAA/i.test(league))
    )
    .sort((a, b) => b.storedAdjusted - a.storedAdjusted)
    .slice(0, 10)
    .map((row) => ({
      displayName: row.displayName,
      rating: row.storedAdjusted,
      games: row.storedVerifiedGames,
      leagues: row.dominantLeagues
    }));

  if (verifiedGameMismatches.length > 0) {
    findings.push({
      id: "verified-game-count-mismatch",
      severity: verifiedGameMismatches.some((row) => Math.abs(row.verifiedGameDelta) > 2) ? "high" : "medium",
      category: "gps_consistency",
      summary: `${verifiedGameMismatches.length} PlayerRating row(s) have verifiedGameCount != Formula v1 GPS count for that age group.`,
      count: verifiedGameMismatches.length,
      sample: verifiedGameMismatches.slice(0, 15).map((row) => ({
        displayName: row.displayName,
        ageGroup: row.ageGroup,
        stored: row.storedVerifiedGames,
        gps: row.gpsCount,
        delta: row.verifiedGameDelta
      }))
    });
    if (verifiedGameMismatches.some((row) => Math.abs(row.verifiedGameDelta) > 2)) {
      blockers.push(`${verifiedGameMismatches.filter((row) => Math.abs(row.verifiedGameDelta) > 2).length} PlayerRating verifiedGameCount mismatches exceed tolerance.`);
    }
  }

  if (ratingMismatches.length > 0) {
    findings.push({
      id: "stored-vs-recomputed-rating-mismatch",
      severity: ratingMismatches.length > 20 ? "high" : "medium",
      category: "gps_consistency",
      summary: `${ratingMismatches.length} PlayerRating row(s) differ from GPS average finalPerformanceScore by >0.5.`,
      count: ratingMismatches.length,
      sample: ratingMismatches.slice(0, 15).map((row) => ({
        displayName: row.displayName,
        ageGroup: row.ageGroup,
        stored: Number(row.storedObserved.toFixed(2)),
        recomputed: row.recomputedObserved ? Number(row.recomputedObserved.toFixed(2)) : null,
        delta: row.ratingDelta ? Number(row.ratingDelta.toFixed(2)) : null
      }))
    });
  }

  if (lowSampleOnPublicBoard.length > 0) {
    findings.push({
      id: "public-board-below-minimum-games",
      severity: "critical",
      category: "minimum_games",
      summary: `${lowSampleOnPublicBoard.length} public-board player(s) appear with verifiedGameCount below gender minimum.`,
      count: lowSampleOnPublicBoard.length,
      sample: lowSampleOnPublicBoard.slice(0, 10)
    });
    blockers.push("Public rankings board includes players below minimum verified games threshold.");
  } else if (lowSampleHighRating.length > 0) {
    findings.push({
      id: "low-sample-high-rating-stored",
      severity: "medium",
      category: "low_sample_inflation",
      summary: `${lowSampleHighRating.length} rated player(s) have rating >=75 but verified games below public-board minimum (filtered from public UI).`,
      count: lowSampleHighRating.length,
      sample: lowSampleHighRating.slice(0, 15).map((row) => ({
        displayName: row.displayName,
        ageGroup: row.ageGroup,
        gender: genderLabel(row.gender),
        rating: row.storedAdjusted,
        verifiedGames: row.storedVerifiedGames,
        minRequired: publicBoardMinimumGames(genderLabel(row.gender))
      }))
    });
  }

  if (wrongBoardAssignments.length > 0) {
    findings.push({
      id: "age-bracket-board-mismatch",
      severity: "medium",
      category: "age_group_assignment",
      summary: `${wrongBoardAssignments.length} PlayerRating row(s) are on a board that does not match computed age bracket.`,
      count: wrongBoardAssignments.length,
      sample: wrongBoardAssignments.slice(0, 15).map((row) => ({
        displayName: row.displayName,
        board: row.ageGroup,
        computedAgeBracket: row.computedAgeBracket
      }))
    });
  }

  if (starMismatches.length > 0) {
    findings.push({
      id: "star-rating-mismatch",
      severity: "low",
      category: "star_bands",
      summary: `${starMismatches.length} PlayerRating row(s) have starRating inconsistent with Formula v1 bands.`,
      count: starMismatches.length,
      sample: starMismatches.slice(0, 10)
    });
  }

  const staleSnapshots = snapshotVsLiveRating.filter((row) => row.ratingMismatches > 5);
  if (staleSnapshots.length > 0) {
    findings.push({
      id: "snapshot-stale-vs-live-ratings",
      severity: "medium",
      category: "ranking_snapshot",
      summary: `${staleSnapshots.length} RankingSnapshot(s) have >5 row rating mismatches vs live PlayerRating.`,
      count: staleSnapshots.length,
      sample: staleSnapshots
    });
  }

  if (statisticalOutliers.length > 0) {
    findings.push({
      id: "statistical-rating-outliers",
      severity: "low",
      category: "outliers",
      summary: `${statisticalOutliers.length} player(s) rated >20 points above board gender mean (review for legitimacy).`,
      count: statisticalOutliers.length,
      sample: statisticalOutliers.slice(0, 10).map((row) => ({
        displayName: row.displayName,
        board: `${row.ageGroup} ${genderLabel(row.gender)}`,
        rating: row.storedAdjusted,
        games: row.storedVerifiedGames
      }))
    });
  }

  const playersRatedWithoutGps = auditRows.filter((row) => row.gpsCount === 0);
  if (playersRatedWithoutGps.length > 0) {
    findings.push({
      id: "rating-without-gps",
      severity: "critical",
      category: "gps_consistency",
      summary: `${playersRatedWithoutGps.length} PlayerRating row(s) have zero Formula v1 GPS in that age group.`,
      count: playersRatedWithoutGps.length,
      sample: playersRatedWithoutGps.slice(0, 10)
    });
    blockers.push(`${playersRatedWithoutGps.length} PlayerRating rows have no backing GPS in their board age group.`);
  }

  const severityCounts = findings.reduce<Record<Severity, number>>(
    (acc, finding) => {
      acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const hasCritical = (severityCounts.critical ?? 0) > 0;
  const recommendation =
    hasCritical || blockers.length > 0
      ? "STOP"
      : findings.some((finding) => finding.severity === "high" || finding.severity === "medium")
        ? "PROCEED_WITH_CAUTION"
        : "PROCEED";

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "E-ranking-sanity-audit",
    mode: "read-only",
    metrics: {
      formulaVersion: formulaVersion?.versionNumber ?? null,
      playerRatings: playerRatingCount,
      formulaV1Gps: gpsCount,
      activePlayersWithRatings,
      rankingSnapshots: snapshotCount,
      rankingSnapshotRows: snapshotRowCount,
      auditRows: auditRows.length,
      verifiedGameMismatches: verifiedGameMismatches.length,
      ratingMismatches: ratingMismatches.length,
      lowSampleHighRating: lowSampleHighRating.length,
      lowSampleOnPublicBoard: lowSampleOnPublicBoard.length,
      wrongBoardAssignments: wrongBoardAssignments.length,
      playersRatedWithoutGps: playersRatedWithoutGps.length,
      publicBoardMinimumGames: { boys: 10, girls: 5 }
    },
    ratingDistributions: boardDistributions,
    topByBoard,
    ncaaTopPerformers: ncaaTop,
    snapshotVsLiveRating,
    findings,
    severityCounts,
    blockers: Array.from(new Set(blockers)),
    recommendation
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "phase-e-ranking-sanity-audit-report.json");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${reportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
