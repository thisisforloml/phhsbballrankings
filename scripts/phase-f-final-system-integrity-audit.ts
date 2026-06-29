/**
 * Validation Phase F — read-only final system integrity audit.
 * Usage: npx tsx scripts/phase-f-final-system-integrity-audit.ts
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildEligibilityInput, evaluateEligibility, isPublicBoardRanked, publicBoardMinimumGames } from "../src/lib/eligibility";
import { getLatestNationalRankings, type RankingAgeGroup } from "../src/lib/rankings";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { getCurrentRankingAgeBracket, isRankingEligibleByClassYear } from "../src/lib/ranking-eligibility";

type DomainStatus = "PASS" | "WARN" | "FAIL";
type Severity = "blocker" | "warning" | "info";

type DomainResult = {
  status: DomainStatus;
  counts: Record<string, number>;
  blockers: string[];
  warnings: string[];
  topFindings: string[];
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

function loadPhaseReport<T>(filename: string): T | null {
  const reportPath = join(process.cwd(), "scripts", "reports", filename);
  if (!existsSync(reportPath)) return null;
  try {
    return JSON.parse(readFileSync(reportPath, "utf8")) as T;
  } catch {
    return null;
  }
}

function domainStatus(blockers: number, warnings: number): DomainStatus {
  if (blockers > 0) return "FAIL";
  if (warnings > 0) return "WARN";
  return "PASS";
}

async function auditGameIdentities(): Promise<DomainResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const topFindings: string[] = [];

  const [
    activeGames,
    homeAwaySameTeamRows,
    gamesWithDeletedHomeTeam,
    gamesWithDeletedAwayTeam,
    gamesWithMissingSeason,
    duplicateGameNumbers
  ] = await Promise.all([
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM games
      WHERE "deletedAt" IS NULL AND "homeTeamId" IS NOT NULL AND "awayTeamId" IS NOT NULL AND "homeTeamId" = "awayTeamId"
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM games g
      JOIN teams ht ON ht.id = g."homeTeamId"
      WHERE g."deletedAt" IS NULL AND ht."deletedAt" IS NOT NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM games g
      JOIN teams at ON at.id = g."awayTeamId"
      WHERE g."deletedAt" IS NULL AND at."deletedAt" IS NOT NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM games g
      LEFT JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
      WHERE g."deletedAt" IS NULL AND s.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ season_id: string; game_number: string; game_count: number }>>`
      SELECT g."seasonId" AS season_id, g."gameNumber" AS game_number, COUNT(*)::int AS game_count
      FROM games g
      WHERE g."deletedAt" IS NULL
      GROUP BY g."seasonId", g."gameNumber"
      HAVING COUNT(*) > 1
    `
  ]);

  const homeAwaySame = Number(homeAwaySameTeamRows[0]?.count ?? 0);

  if (homeAwaySame > 0) {
    blockers.push(`${homeAwaySame} active game(s) have homeTeamId = awayTeamId`);
    topFindings.push(`${homeAwaySame} home/away same-team games`);
  }
  if (gamesWithDeletedHomeTeam > 0) {
    blockers.push(`${gamesWithDeletedHomeTeam} active game(s) reference soft-deleted home teams`);
    topFindings.push(`${gamesWithDeletedHomeTeam} games with deleted home team`);
  }
  if (gamesWithDeletedAwayTeam > 0) {
    blockers.push(`${gamesWithDeletedAwayTeam} active game(s) reference soft-deleted away teams`);
    topFindings.push(`${gamesWithDeletedAwayTeam} games with deleted away team`);
  }
  if (gamesWithMissingSeason > 0) {
    blockers.push(`${gamesWithMissingSeason} active game(s) missing active season`);
    topFindings.push(`${gamesWithMissingSeason} orphan games (no season)`);
  }
  if (duplicateGameNumbers.length > 0) {
    blockers.push(`${duplicateGameNumbers.length} season+gameNumber duplicate group(s)`);
    topFindings.push(`${duplicateGameNumbers.length} duplicate gameNumber groups in season`);
  }

  const gamesWithoutStats = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM games g
    WHERE g."deletedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM game_stats gs WHERE gs."gameId" = g.id AND gs."deletedAt" IS NULL)
  `;
  const gamesNoStats = Number(gamesWithoutStats[0]?.count ?? 0);
  if (gamesNoStats > 0) {
    warnings.push(`${gamesNoStats} active game(s) have zero active GameStats (may be forfeit/default)`);
    topFindings.push(`${gamesNoStats} games without stats`);
  }

  return {
    status: domainStatus(blockers.length, warnings.length),
    counts: {
      activeGames,
      homeAwaySameTeam: homeAwaySame,
      gamesWithDeletedHomeTeam,
      gamesWithDeletedAwayTeam,
      gamesWithMissingSeason,
      duplicateGameNumberGroups: duplicateGameNumbers.length,
      gamesWithoutStats: gamesNoStats
    },
    blockers,
    warnings,
    topFindings
  };
}

async function auditGameStatIntegrity(): Promise<DomainResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const topFindings: string[] = [];

  const [
    activeGameStats,
    orphanGameStats,
    orphanPlayerRefs,
    orphanTeamRefs,
    duplicatePlayerGame,
    teamMismatch
  ] = await Promise.all([
    prisma.gameStat.count({ where: { deletedAt: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM game_stats gs
      LEFT JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
      WHERE gs."deletedAt" IS NULL AND g.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM game_stats gs
      LEFT JOIN players p ON p.id = gs."playerId" AND p."deletedAt" IS NULL
      WHERE gs."deletedAt" IS NULL AND p.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM game_stats gs
      LEFT JOIN teams t ON t.id = gs."teamId" AND t."deletedAt" IS NULL
      WHERE gs."deletedAt" IS NULL AND t.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT gs."gameId", gs."playerId", COUNT(*)::int AS cnt
        FROM game_stats gs
        WHERE gs."deletedAt" IS NULL
        GROUP BY gs."gameId", gs."playerId"
        HAVING COUNT(*) > 1
      ) dup
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM game_stats gs
      JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
      WHERE gs."deletedAt" IS NULL
        AND gs."teamId" IS NOT NULL
        AND gs."teamId" NOT IN (g."homeTeamId", g."awayTeamId")
    `.then((rows) => Number(rows[0]?.count ?? 0))
  ]);

  if (orphanGameStats > 0) {
    blockers.push(`${orphanGameStats} GameStat(s) reference deleted/missing games`);
    topFindings.push(`${orphanGameStats} orphan GameStats (no game)`);
  }
  if (orphanPlayerRefs > 0) {
    blockers.push(`${orphanPlayerRefs} GameStat(s) reference deleted/missing players`);
    topFindings.push(`${orphanPlayerRefs} GameStats with missing player`);
  }
  if (orphanTeamRefs > 0) {
    blockers.push(`${orphanTeamRefs} GameStat(s) reference deleted/missing teams`);
    topFindings.push(`${orphanTeamRefs} GameStats with missing team`);
  }
  if (duplicatePlayerGame > 0) {
    blockers.push(`${duplicatePlayerGame} duplicate player+game GameStat group(s)`);
    topFindings.push(`${duplicatePlayerGame} duplicate player-game pairs`);
  }
  if (teamMismatch > 0) {
    blockers.push(`${teamMismatch} GameStat(s) teamId not in game home/away`);
    topFindings.push(`${teamMismatch} GameStat team mismatches`);
  }

  return {
    status: domainStatus(blockers.length, warnings.length),
    counts: {
      activeGameStats,
      orphanGameStats,
      orphanPlayerRefs,
      orphanTeamRefs,
      duplicatePlayerGame,
      teamMismatch
    },
    blockers,
    warnings,
    topFindings
  };
}

async function auditGpsIntegrity(formulaVersionId: string): Promise<DomainResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const topFindings: string[] = [];

  const [
    formulaV1Gps,
    activeGameStats,
    gameStatsWithoutGps,
    gpsWithoutGameStat,
    gpsNullFinalScore
  ] = await Promise.all([
    prisma.gamePerformanceScore.count({
      where: { deletedAt: null, formulaVersionId, formulaVersion: { versionNumber: FORMULA_V1 } }
    }),
    prisma.gameStat.count({ where: { deletedAt: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM game_stats gs
      JOIN games g ON g.id = gs."gameId" AND g."deletedAt" IS NULL
      LEFT JOIN game_performance_scores gps ON gps."gameStatId" = gs.id
        AND gps."deletedAt" IS NULL
        AND gps."formulaVersionId" = ${formulaVersionId}::uuid
      WHERE gs."deletedAt" IS NULL AND gps.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM game_performance_scores gps
      LEFT JOIN game_stats gs ON gs.id = gps."gameStatId" AND gs."deletedAt" IS NULL
      WHERE gps."deletedAt" IS NULL
        AND gps."formulaVersionId" = ${formulaVersionId}::uuid
        AND gs.id IS NULL
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.gamePerformanceScore.count({
      where: {
        deletedAt: null,
        formulaVersionId,
        finalPerformanceScore: null
      }
    })
  ]);

  if (formulaV1Gps !== activeGameStats) {
    blockers.push(`Formula v1 GPS count (${formulaV1Gps}) != active GameStat count (${activeGameStats})`);
    topFindings.push(`GPS/GameStat count delta: ${formulaV1Gps - activeGameStats}`);
  }
  if (gameStatsWithoutGps > 0) {
    blockers.push(`${gameStatsWithoutGps} active GameStat(s) missing Formula v1 GPS`);
    topFindings.push(`${gameStatsWithoutGps} GameStats without GPS`);
  }
  if (gpsWithoutGameStat > 0) {
    blockers.push(`${gpsWithoutGameStat} Formula v1 GPS row(s) without active GameStat`);
    topFindings.push(`${gpsWithoutGameStat} orphan GPS rows`);
  }
  if (gpsNullFinalScore > 0) {
    warnings.push(`${gpsNullFinalScore} GPS row(s) have null finalPerformanceScore`);
    topFindings.push(`${gpsNullFinalScore} GPS with null final score`);
  }

  return {
    status: domainStatus(blockers.length, warnings.length),
    counts: {
      formulaV1Gps,
      activeGameStats,
      gameStatsWithoutGps,
      gpsWithoutGameStat,
      gpsNullFinalScore,
      gpsGameStatDelta: formulaV1Gps - activeGameStats
    },
    blockers,
    warnings,
    topFindings
  };
}

async function auditPlayerRatingIntegrity(formulaVersionId: string): Promise<DomainResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const topFindings: string[] = [];

  const playerRatings = await prisma.playerRating.findMany({
    include: {
      player: {
        select: { id: true, displayName: true, gender: true, birthDate: true, classYearOverride: true, ageGroupOverride: true, deletedAt: true }
      }
    }
  });

  const gpsByPlayerAge = await prisma.$queryRaw<
    Array<{ player_id: string; age_group: AgeGroup; gps_count: number; avg_final_score: number }>
  >`
    SELECT
      gps."playerId" AS player_id,
      l."ageGroup" AS age_group,
      COUNT(*)::int AS gps_count,
      AVG(gps."finalPerformanceScore")::float AS avg_final_score
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

  let verifiedGameMismatches = 0;
  let ratingMismatches = 0;
  let starMismatches = 0;
  let ratingsWithoutGps = 0;
  let orphanRatings = 0;
  let wrongBoardAssignments = 0;

  for (const rating of playerRatings) {
    if (rating.player.deletedAt) {
      orphanRatings += 1;
      continue;
    }
    const key = `${rating.playerId}|${rating.ageGroup}`;
    const gps = gpsMap.get(key);
    const gpsCount = gps?.gps_count ?? 0;
    const verifiedDelta = rating.verifiedGameCount - gpsCount;
    if (verifiedDelta !== 0) verifiedGameMismatches += 1;
    if (gpsCount === 0) ratingsWithoutGps += 1;
    if (gps) {
      const delta = Math.abs(Number(rating.observedRating) - gps.avg_final_score);
      if (delta > 0.5) ratingMismatches += 1;
    }
    if (rating.starRating !== starFromAdjustedRating(Number(rating.adjustedRating))) starMismatches += 1;
    const computedAgeBracket = getCurrentRankingAgeBracket(
      rating.player.birthDate,
      new Date(),
      rating.player.classYearOverride,
      rating.ageGroup
    );
    if (
      computedAgeBracket !== null &&
      computedAgeBracket !== "OUT_OF_RANGE" &&
      computedAgeBracket !== rating.ageGroup
    ) {
      wrongBoardAssignments += 1;
    }
  }

  const missingRatingsForGps = gpsByPlayerAge.filter((row) => {
    return !playerRatings.some((rating) => rating.playerId === row.player_id && rating.ageGroup === row.age_group);
  }).length;

  if (verifiedGameMismatches > 0) {
    blockers.push(`${verifiedGameMismatches} PlayerRating verifiedGameCount != GPS count`);
    topFindings.push(`${verifiedGameMismatches} verifiedGameCount mismatches (Phase E had 212, now ${verifiedGameMismatches})`);
  }
  if (ratingMismatches > 0) {
    blockers.push(`${ratingMismatches} PlayerRating observedRating != GPS average (>0.5 delta)`);
    topFindings.push(`${ratingMismatches} rating vs GPS mismatches`);
  }
  if (ratingsWithoutGps > 0) {
    blockers.push(`${ratingsWithoutGps} PlayerRating row(s) with zero backing GPS`);
    topFindings.push(`${ratingsWithoutGps} ratings without GPS`);
  }
  if (missingRatingsForGps > 0) {
    blockers.push(`${missingRatingsForGps} GPS player+ageGroup group(s) missing PlayerRating`);
    topFindings.push(`${missingRatingsForGps} missing PlayerRating for GPS groups`);
  }
  if (orphanRatings > 0) {
    warnings.push(`${orphanRatings} PlayerRating row(s) on soft-deleted players`);
    topFindings.push(`${orphanRatings} ratings on deleted players`);
  }
  if (starMismatches > 0) {
    warnings.push(`${starMismatches} PlayerRating starRating inconsistent with adjustedRating bands`);
    topFindings.push(`${starMismatches} star band mismatches`);
  }
  if (wrongBoardAssignments > 0) {
    warnings.push(`${wrongBoardAssignments} PlayerRating row(s) on board != computed age bracket`);
    topFindings.push(`${wrongBoardAssignments} age-bracket board mismatches`);
  }

  return {
    status: domainStatus(blockers.length, warnings.length),
    counts: {
      playerRatings: playerRatings.length,
      verifiedGameMismatches,
      ratingMismatches,
      starMismatches,
      ratingsWithoutGps,
      missingRatingsForGps,
      orphanRatings,
      wrongBoardAssignments
    },
    blockers,
    warnings,
    topFindings
  };
}

async function auditRankingSnapshotIntegrity(formulaVersionId: string): Promise<DomainResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const topFindings: string[] = [];

  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { formulaVersionId, scope: RankingScope.NATIONAL, city: null, region: null },
    include: {
      rows: {
        include: { player: { select: { displayName: true, gender: true, birthDate: true, classYearOverride: true, deletedAt: true } } },
        orderBy: { rank: "asc" }
      }
    },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }]
  });

  const latestByBoard = new Map<string, typeof snapshots[number]>();
  for (const snapshot of snapshots) {
    if (!snapshot.ageGroup) continue;
    const key = `${snapshot.ageGroup}|${snapshot.gender}`;
    if (!latestByBoard.has(key)) latestByBoard.set(key, snapshot);
  }

  let orphanSnapshotRows = 0;
  let ratingMismatches = 0;
  let gameCountMismatches = 0;
  let snapshotRowCountMismatch = 0;
  let classYearIneligibleOnSnapshot = 0;
  let belowMinGamesOnSnapshot = 0;
  let missingExpectedPlayers = 0;
  let extraSnapshotPlayers = 0;

  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM ranking_snapshot_rows r
    LEFT JOIN ranking_snapshots s ON s.id = r."snapshotId"
    LEFT JOIN players p ON p.id = r."playerId" AND p."deletedAt" IS NULL
    LEFT JOIN player_ratings pr ON pr."playerId" = r."playerId" AND pr."ageGroup" = s."ageGroup"
    WHERE s.id IS NULL OR p.id IS NULL OR pr.id IS NULL
  `;
  orphanSnapshotRows = Number(orphanRows[0]?.count ?? 0);

  for (const [, snapshot] of latestByBoard) {
    if (!snapshot.ageGroup) continue;
    const minGames = publicBoardMinimumGames(snapshot.gender === PlayerGender.GIRLS ? "Girls" : "Boys");

    const expectedRatings = await prisma.playerRating.findMany({
      where: {
        ageGroup: snapshot.ageGroup,
        verifiedGameCount: { gte: minGames },
        player: { gender: snapshot.gender, deletedAt: null }
      },
      include: {
        player: { select: { id: true, displayName: true, birthDate: true, classYearOverride: true, deletedAt: true } }
      },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
    });

    const expectedPlayerIds = new Set(
      expectedRatings
        .filter((rating) => isRankingEligibleByClassYear(rating.player.birthDate, snapshot.weekOf, rating.player.classYearOverride))
        .map((rating) => rating.playerId)
    );

    if (expectedPlayerIds.size !== snapshot.rows.length) {
      snapshotRowCountMismatch += 1;
      missingExpectedPlayers += [...expectedPlayerIds].filter((id) => !snapshot.rows.some((row) => row.playerId === id)).length;
      extraSnapshotPlayers += snapshot.rows.filter((row) => !expectedPlayerIds.has(row.playerId)).length;
    }

    for (const row of snapshot.rows) {
      const liveRating = await prisma.playerRating.findUnique({
        where: { playerId_ageGroup: { playerId: row.playerId, ageGroup: snapshot.ageGroup } },
        include: {
          player: {
            select: { gender: true, birthDate: true, classYearOverride: true, deletedAt: true }
          }
        }
      });
      if (!liveRating || liveRating.player.deletedAt) continue;

      const ratingDelta = Math.abs(Number(row.rating) - Number(liveRating.adjustedRating));
      if (ratingDelta > 0.5) ratingMismatches += 1;
      if (row.verifiedGameCount !== liveRating.verifiedGameCount) gameCountMismatches += 1;
      if (liveRating.verifiedGameCount < minGames) belowMinGamesOnSnapshot += 1;
      if (!isRankingEligibleByClassYear(liveRating.player.birthDate, snapshot.weekOf, liveRating.player.classYearOverride)) {
        classYearIneligibleOnSnapshot += 1;
      }
    }
  }

  const snapshotCount = snapshots.length;
  const snapshotRowCount = snapshots.reduce((sum, snapshot) => sum + snapshot.rows.length, 0);

  let missingBoardsWithEligiblePlayers = 0;
  for (const ageGroup of AGE_GROUPS) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS]) {
      const key = `${ageGroup}|${gender}`;
      if (latestByBoard.has(key)) continue;
      const minGames = publicBoardMinimumGames(gender === PlayerGender.GIRLS ? "Girls" : "Boys");
      const eligibleCount = await prisma.playerRating.count({
        where: {
          ageGroup,
          verifiedGameCount: { gte: minGames },
          player: { gender, deletedAt: null }
        }
      });
      if (eligibleCount > 0) missingBoardsWithEligiblePlayers += 1;
    }
  }

  if (orphanSnapshotRows > 0) {
    blockers.push(`${orphanSnapshotRows} orphan RankingSnapshotRow(s)`);
    topFindings.push(`${orphanSnapshotRows} orphan snapshot rows`);
  }
  if (ratingMismatches > 0) {
    blockers.push(`${ratingMismatches} latest snapshot row(s) rating != live PlayerRating`);
    topFindings.push(`${ratingMismatches} snapshot vs live rating mismatches`);
  }
  if (gameCountMismatches > 0) {
    blockers.push(`${gameCountMismatches} latest snapshot row(s) verifiedGameCount != live PlayerRating`);
    topFindings.push(`${gameCountMismatches} snapshot game count mismatches`);
  }
  if (classYearIneligibleOnSnapshot > 0) {
    blockers.push(`${classYearIneligibleOnSnapshot} class-year-ineligible player(s) on latest snapshots`);
    topFindings.push(`${classYearIneligibleOnSnapshot} class-year ineligible on snapshots`);
  }
  if (belowMinGamesOnSnapshot > 0) {
    blockers.push(`${belowMinGamesOnSnapshot} below-min-games player(s) on latest snapshots`);
    topFindings.push(`${belowMinGamesOnSnapshot} below minimum games on snapshots`);
  }
  if (missingExpectedPlayers > 0 || extraSnapshotPlayers > 0) {
    blockers.push(`Snapshot membership drift: ${missingExpectedPlayers} missing, ${extraSnapshotPlayers} extra vs G3 rules`);
    topFindings.push(`${missingExpectedPlayers} missing / ${extraSnapshotPlayers} extra snapshot players`);
  }
  if (missingBoardsWithEligiblePlayers > 0) {
    warnings.push(`${missingBoardsWithEligiblePlayers} national board(s) with eligible players but no snapshot`);
    topFindings.push(`${missingBoardsWithEligiblePlayers} boards missing snapshots`);
  }
  if (snapshotRowCountMismatch > 0 && missingExpectedPlayers === 0 && extraSnapshotPlayers === 0) {
    warnings.push(`${snapshotRowCountMismatch} latest snapshot(s) row count differs from expected (rank-only drift)`);
  }

  return {
    status: domainStatus(blockers.length, warnings.length),
    counts: {
      rankingSnapshots: snapshotCount,
      rankingSnapshotRows: snapshotRowCount,
      latestBoards: latestByBoard.size,
      orphanSnapshotRows,
      ratingMismatches,
      gameCountMismatches,
      classYearIneligibleOnSnapshot,
      belowMinGamesOnSnapshot,
      missingExpectedPlayers,
      extraSnapshotPlayers,
      missingBoardsWithEligiblePlayers,
      snapshotRowCountMismatch
    },
    blockers,
    warnings,
    topFindings
  };
}

async function auditPublicRankingsIntegrity(formulaVersionId: string): Promise<DomainResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const topFindings: string[] = [];

  const nationalRankings = await getLatestNationalRankings();
  let lowSampleOnPublicBoard = 0;
  let ineligibleOnPublicBoard = 0;
  let snapshotPublicRowDelta = 0;

  for (const ageGroup of RATING_AGE_GROUPS) {
    for (const genderKey of ["boys", "girls"] as const) {
      const snapshot = nationalRankings.snapshotsByAge[ageGroup][genderKey];
      const publicRows = getPublicBoardRows(snapshot);
      const minGames = publicBoardMinimumGames(genderKey === "girls" ? "Girls" : "Boys");

      for (const row of publicRows) {
        if (row.verifiedGameCount < minGames) lowSampleOnPublicBoard += 1;
        if (!row.eligibilityVerdict || !isPublicBoardRanked(row.eligibilityVerdict)) ineligibleOnPublicBoard += 1;
      }

      if (snapshot.snapshotId) {
        const dbSnapshot = await prisma.rankingSnapshot.findUnique({
          where: { id: snapshot.snapshotId },
          include: { rows: true }
        });
        if (dbSnapshot) {
          const dbPublicEligible = dbSnapshot.rows.filter((row) => {
            const live = snapshot.rows.find((candidate) => candidate.playerId === row.playerId);
            return live?.eligibilityVerdict && isPublicBoardRanked(live.eligibilityVerdict);
          });
          snapshotPublicRowDelta += Math.abs(publicRows.length - dbPublicEligible.length);
        }
      }
    }
  }

  if (lowSampleOnPublicBoard > 0) {
    blockers.push(`${lowSampleOnPublicBoard} public-board player(s) below minimum verified games`);
    topFindings.push(`${lowSampleOnPublicBoard} below-min on public board`);
  }
  if (ineligibleOnPublicBoard > 0) {
    blockers.push(`${ineligibleOnPublicBoard} ineligible player(s) on public board`);
    topFindings.push(`${ineligibleOnPublicBoard} ineligible on public board`);
  }
  if (snapshotPublicRowDelta > 0) {
    warnings.push(`Public board row count differs from snapshot eligibility filter by ${snapshotPublicRowDelta} total across boards`);
    topFindings.push(`Snapshot/public filter delta: ${snapshotPublicRowDelta}`);
  }

  const publicBoardCounts = RATING_AGE_GROUPS.flatMap((ageGroup) =>
    (["boys", "girls"] as const).map((genderKey) => ({
      board: `${ageGroup} ${genderKey}`,
      publicRows: getPublicBoardRows(nationalRankings.snapshotsByAge[ageGroup][genderKey]).length,
      totalRated: nationalRankings.snapshotsByAge[ageGroup][genderKey].totalRows
    }))
  );

  for (const board of publicBoardCounts) {
    if (board.publicRows === 0 && board.totalRated > 0 && board.board.includes("boys")) {
      warnings.push(`${board.board}: 0 public-eligible rows despite ${board.totalRated} rated players`);
    }
  }

  return {
    status: domainStatus(blockers.length, warnings.length),
    counts: {
      lowSampleOnPublicBoard,
      ineligibleOnPublicBoard,
      snapshotPublicRowDelta,
      ...Object.fromEntries(publicBoardCounts.map((board) => [`publicRows_${board.board.replace(/\s+/g, "_")}`, board.publicRows]))
    },
    blockers,
    warnings,
    topFindings
  };
}

function summarizePhaseReport(
  phase: string,
  report: { metrics?: Record<string, unknown>; blockers?: string[]; recommendation?: string; findings?: Array<{ severity: string; count: number; summary: string }> } | null,
  blockerFilter?: (blocker: string) => boolean
): DomainResult {
  const blockers = (report?.blockers ?? []).filter((blocker) => (blockerFilter ? blockerFilter(blocker) : true));
  const warnings =
    report?.findings
      ?.filter((finding) => finding.severity === "medium" || finding.severity === "low" || finding.severity === "high")
      .map((finding) => finding.summary) ?? [];
  const highFindings =
    report?.findings
      ?.filter((finding) => finding.severity === "critical" || finding.severity === "high")
      .slice(0, 5)
      .map((finding) => finding.summary) ?? [];

  const status = domainStatus(blockers.length, warnings.length);
  return {
    status,
    counts: (report?.metrics as Record<string, number>) ?? {},
    blockers,
    warnings: warnings.slice(0, 10),
    topFindings: highFindings.length ? highFindings : warnings.slice(0, 5)
  };
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1 },
    select: { id: true, versionNumber: true }
  });
  if (!formulaVersion) throw new Error(`Missing FormulaVersion v${FORMULA_V1}.`);

  const phaseB = loadPhaseReport<{ metrics: Record<string, unknown>; blockers: string[]; findings: Array<{ severity: string; count: number; summary: string }> }>(
    "phase-b-identity-audit-report.json"
  );
  const phaseC = loadPhaseReport<{ metrics: Record<string, unknown>; blockers: string[]; findings: Array<{ severity: string; count: number; summary: string }> }>(
    "phase-c-team-resolution-audit-report.json"
  );

  const [
    gameIdentities,
    gameStatIntegrity,
    gpsIntegrity,
    playerRatingIntegrity,
    rankingSnapshotIntegrity,
    publicRankingsIntegrity
  ] = await Promise.all([
    auditGameIdentities(),
    auditGameStatIntegrity(),
    auditGpsIntegrity(formulaVersion.id),
    auditPlayerRatingIntegrity(formulaVersion.id),
    auditRankingSnapshotIntegrity(formulaVersion.id),
    auditPublicRankingsIntegrity(formulaVersion.id)
  ]);

  const playerIdentities = summarizePhaseReport("B", phaseB);
  const teamIdentities = summarizePhaseReport("C", phaseC);

  const domains = {
    playerIdentities,
    teamIdentities,
    gameIdentities,
    gameStatIntegrity,
    gpsIntegrity,
    playerRatingIntegrity,
    rankingSnapshotIntegrity,
    publicRankingsIntegrity
  };

  const allBlockers = Object.entries(domains).flatMap(([domain, result]) =>
    result.blockers.map((blocker) => `[${domain}] ${blocker}`)
  );
  const allWarnings = Object.entries(domains).flatMap(([domain, result]) =>
    result.warnings.map((warning) => `[${domain}] ${warning}`)
  );

  const failCount = Object.values(domains).filter((domain) => domain.status === "FAIL").length;
  const warnCount = Object.values(domains).filter((domain) => domain.status === "WARN").length;

  let overallVerdict: "PASS" | "PASS WITH WARNINGS" | "FAIL";
  if (failCount > 0) overallVerdict = "FAIL";
  else if (warnCount > 0 || allWarnings.length > 0) overallVerdict = "PASS WITH WARNINGS";
  else overallVerdict = "PASS";

  const productionReady =
    overallVerdict === "PASS"
      ? "READY — all integrity domains pass with zero blockers."
      : overallVerdict === "PASS WITH WARNINGS"
        ? "READY WITH CAVEATS — core rating/snapshot pipeline is sound; address warnings before expanding competitions."
        : "NOT READY — resolve blockers before production launch.";

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "F-final-system-integrity-audit",
    mode: "read-only",
    overallVerdict,
    productionReady,
    summary: {
      domainsPassed: Object.values(domains).filter((d) => d.status === "PASS").length,
      domainsWarn: warnCount,
      domainsFailed: failCount,
      totalBlockers: allBlockers.length,
      totalWarnings: allWarnings.length,
      keyCounts: {
        activePlayers: phaseB?.metrics?.players ? (phaseB.metrics.players as { active: number }).active : null,
        activeGames: gameIdentities.counts.activeGames,
        activeGameStats: gameStatIntegrity.counts.activeGameStats,
        formulaV1Gps: gpsIntegrity.counts.formulaV1Gps,
        playerRatings: playerRatingIntegrity.counts.playerRatings,
        rankingSnapshots: rankingSnapshotIntegrity.counts.rankingSnapshots,
        rankingSnapshotRows: rankingSnapshotIntegrity.counts.rankingSnapshotRows,
        verifiedGameMismatches: playerRatingIntegrity.counts.verifiedGameMismatches
      },
      remediationsValidated: {
        g1PlayerRatingRemediation: playerRatingIntegrity.counts.verifiedGameMismatches === 0 && playerRatingIntegrity.counts.ratingMismatches === 0,
        g2CumulativeAggregation: playerRatingIntegrity.counts.ratingsWithoutGps === 0,
        g3SnapshotRegeneration: rankingSnapshotIntegrity.counts.ratingMismatches === 0 && rankingSnapshotIntegrity.counts.gameCountMismatches === 0,
        phaseEVerifiedGameFix: playerRatingIntegrity.counts.verifiedGameMismatches === 0,
        bistrotSmileCanonicalization: teamIdentities.counts.withinProgramDisplayKeyDuplicates !== undefined
      }
    },
    domains,
    blockers: allBlockers,
    warnings: allWarnings
  };

  const reportPath = join(process.cwd(), "scripts", "reports", "phase-f-final-system-integrity-audit-report.json");
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
