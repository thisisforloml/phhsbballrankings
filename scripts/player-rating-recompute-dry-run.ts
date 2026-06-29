/**
 * Read-only dry-run for cumulative Formula v1 PlayerRating recompute.
 * Usage: npx tsx scripts/player-rating-recompute-dry-run.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getCurrentRankingAgeBracket } from "../src/lib/ranking-eligibility";
import { publicBoardMinimumGames } from "../src/lib/public-board-ranks";
import type { RankingAgeGroup } from "../src/lib/rankings";

const FORMULA_V1 = 1;
const RATING_TOLERANCE = 0.01;
const AGE_GROUPS: AgeGroup[] = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19];
const RATING_AGE_GROUPS: RankingAgeGroup[] = ["U13", "U16", "U19"];

type ChangeType = "create" | "update" | "delete" | "unchanged";

type RatingValues = {
  observedRating: number;
  adjustedRating: number;
  verifiedGameCount: number;
  starRating: number;
};

type PlayerDiff = {
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  ageGroup: AgeGroup;
  board: string;
  changeType: ChangeType;
  current: RatingValues | null;
  recomputed: RatingValues | null;
  ratingDelta: number | null;
  verifiedGameCountDelta: number | null;
  currentPublicRank: number | null;
  recomputedPublicRank: number | null;
  publicRankDelta: number | null;
  computedAgeBracket: ReturnType<typeof getCurrentRankingAgeBracket>;
  dominantLeagues: string[];
};

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

function boardKey(ageGroup: AgeGroup, gender: PlayerGender) {
  return `${ageGroup} ${genderLabel(gender)}`;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function ratingValues(observed: number, verifiedGameCount: number): RatingValues {
  const adjustedRating = observed;
  return {
    observedRating: round(observed),
    adjustedRating: round(adjustedRating),
    verifiedGameCount,
    starRating: starFromAdjustedRating(adjustedRating)
  };
}

function ratingsEqual(left: RatingValues | null, right: RatingValues | null) {
  if (!left || !right) return false;
  return (
    Math.abs(left.observedRating - right.observedRating) <= RATING_TOLERANCE &&
    Math.abs(left.adjustedRating - right.adjustedRating) <= RATING_TOLERANCE &&
    left.verifiedGameCount === right.verifiedGameCount &&
    left.starRating === right.starRating
  );
}

type BoardRow = {
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  ageGroup: AgeGroup;
  rating: number;
  verifiedGameCount: number;
  starRating: number;
  computedAgeBracket: ReturnType<typeof getCurrentRankingAgeBracket>;
};

function sortBoardRows(rows: BoardRow[]) {
  return rows
    .slice()
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        right.verifiedGameCount - left.verifiedGameCount ||
        left.displayName.localeCompare(right.displayName)
    );
}

function isPublicEligible(row: BoardRow, ageGroup: AgeGroup) {
  const minGames = publicBoardMinimumGames(genderLabel(row.gender));
  if (row.verifiedGameCount < minGames) return false;
  if (row.computedAgeBracket !== null && row.computedAgeBracket !== ageGroup && row.computedAgeBracket !== "OUT_OF_RANGE") {
    return false;
  }
  if (row.computedAgeBracket === "OUT_OF_RANGE") return false;
  return true;
}

function buildPublicRanks(rows: BoardRow[], ageGroup: AgeGroup) {
  const rankByPlayer = new Map<string, number>();
  const publicRows = sortBoardRows(rows).filter((row) => isPublicEligible(row, ageGroup));
  publicRows.forEach((row, index) => rankByPlayer.set(row.playerId, index + 1));
  return rankByPlayer;
}

async function main() {
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1 },
    select: { id: true, versionNumber: true }
  });

  const [playerRatings, gpsByPlayerAge, playersWithGpsOnly] = await Promise.all([
    prisma.playerRating.findMany({
      include: {
        player: {
          select: {
            id: true,
            displayName: true,
            gender: true,
            birthDate: true,
            classYearOverride: true,
            deletedAt: true
          }
        }
      }
    }),
    prisma.$queryRaw<
      Array<{
        player_id: string;
        age_group: AgeGroup;
        gps_count: number;
        avg_final_score: number;
        league_names: string[];
      }>
    >`
      SELECT
        gps."playerId" AS player_id,
        l."ageGroup" AS age_group,
        COUNT(*)::int AS gps_count,
        AVG(gps."finalPerformanceScore")::float AS avg_final_score,
        array_agg(DISTINCT l.name ORDER BY l.name) AS league_names
      FROM game_performance_scores gps
      JOIN games g ON g.id = gps."gameId" AND g."deletedAt" IS NULL
      JOIN seasons s ON s.id = g."seasonId" AND s."deletedAt" IS NULL
      JOIN leagues l ON l.id = s."leagueId" AND l."deletedAt" IS NULL
      JOIN formula_versions fv ON fv.id = gps."formulaVersionId"
      JOIN players p ON p.id = gps."playerId" AND p."deletedAt" IS NULL
      WHERE gps."deletedAt" IS NULL
        AND fv."versionNumber" = ${FORMULA_V1}
        AND gps."finalPerformanceScore" IS NOT NULL
      GROUP BY gps."playerId", l."ageGroup"
    `,
    prisma.player.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        displayName: true,
        gender: true,
        birthDate: true,
        classYearOverride: true
      }
    })
  ]);

  const playerById = new Map(playersWithGpsOnly.map((player) => [player.id, player]));
  const gpsMap = new Map(gpsByPlayerAge.map((row) => [`${row.player_id}|${row.age_group}`, row]));
  const storedByKey = new Map<string, (typeof playerRatings)[number]>();

  for (const rating of playerRatings) {
    if (rating.player.deletedAt) continue;
    storedByKey.set(`${rating.playerId}|${rating.ageGroup}`, rating);
  }

  const allKeys = new Set<string>([...storedByKey.keys(), ...gpsMap.keys()]);
  const playerDiffs: PlayerDiff[] = [];

  for (const key of allKeys) {
    const [playerId, ageGroupRaw] = key.split("|");
    const ageGroup = ageGroupRaw as AgeGroup;
    const stored = storedByKey.get(key);
    const gps = gpsMap.get(key);
    const player =
      stored?.player ??
      playerById.get(playerId) ??
      null;

    if (!player || ("deletedAt" in player && player.deletedAt)) continue;

    const computedAgeBracket = getCurrentRankingAgeBracket(
      player.birthDate,
      new Date(),
      "classYearOverride" in player ? player.classYearOverride : null,
      ageGroup
    );

    const current = stored
      ? ratingValues(Number(stored.observedRating), stored.verifiedGameCount)
      : null;
    const recomputed = gps
      ? ratingValues(gps.avg_final_score, gps.gps_count)
      : null;

    let changeType: ChangeType = "unchanged";
    if (!stored && recomputed) changeType = "create";
    else if (stored && !recomputed) changeType = "delete";
    else if (stored && recomputed && !ratingsEqual(current, recomputed)) changeType = "update";

    const ratingDelta =
      current && recomputed ? round(recomputed.adjustedRating - current.adjustedRating) : null;
    const verifiedGameCountDelta =
      current && recomputed ? recomputed.verifiedGameCount - current.verifiedGameCount : null;

    playerDiffs.push({
      playerId,
      displayName: player.displayName,
      gender: player.gender,
      ageGroup,
      board: boardKey(ageGroup, player.gender),
      changeType,
      current: current
        ? { ...current, starRating: stored!.starRating }
        : null,
      recomputed,
      ratingDelta,
      verifiedGameCountDelta,
      currentPublicRank: null,
      recomputedPublicRank: null,
      publicRankDelta: null,
      computedAgeBracket,
      dominantLeagues: gps?.league_names ?? []
    });
  }

  const currentBoardRows = new Map<string, BoardRow[]>();
  const recomputedBoardRows = new Map<string, BoardRow[]>();

  for (const diff of playerDiffs) {
    const key = diff.board;
    if (diff.current) {
      const rows = currentBoardRows.get(key) ?? [];
      rows.push({
        playerId: diff.playerId,
        displayName: diff.displayName,
        gender: diff.gender,
        ageGroup: diff.ageGroup,
        rating: diff.current.adjustedRating,
        verifiedGameCount: diff.current.verifiedGameCount,
        starRating: diff.current.starRating,
        computedAgeBracket: diff.computedAgeBracket
      });
      currentBoardRows.set(key, rows);
    }
    if (diff.recomputed) {
      const rows = recomputedBoardRows.get(key) ?? [];
      rows.push({
        playerId: diff.playerId,
        displayName: diff.displayName,
        gender: diff.gender,
        ageGroup: diff.ageGroup,
        rating: diff.recomputed.adjustedRating,
        verifiedGameCount: diff.recomputed.verifiedGameCount,
        starRating: diff.recomputed.starRating,
        computedAgeBracket: diff.computedAgeBracket
      });
      recomputedBoardRows.set(key, rows);
    }
  }

  for (const diff of playerDiffs) {
    const currentRanks = buildPublicRanks(currentBoardRows.get(diff.board) ?? [], diff.ageGroup);
    const recomputedRanks = buildPublicRanks(recomputedBoardRows.get(diff.board) ?? [], diff.ageGroup);
    diff.currentPublicRank = currentRanks.get(diff.playerId) ?? null;
    diff.recomputedPublicRank = recomputedRanks.get(diff.playerId) ?? null;
    if (diff.currentPublicRank !== null && diff.recomputedPublicRank !== null) {
      diff.publicRankDelta = diff.currentPublicRank - diff.recomputedPublicRank;
    } else if (diff.currentPublicRank === null && diff.recomputedPublicRank !== null) {
      diff.publicRankDelta = null;
    } else if (diff.currentPublicRank !== null && diff.recomputedPublicRank === null) {
      diff.publicRankDelta = null;
    }
  }

  const changeCounts = {
    creates: playerDiffs.filter((row) => row.changeType === "create").length,
    updates: playerDiffs.filter((row) => row.changeType === "update").length,
    deletes: playerDiffs.filter((row) => row.changeType === "delete").length,
    unchanged: playerDiffs.filter((row) => row.changeType === "unchanged").length,
    total: playerDiffs.length
  };

  const top50MoversByBoard: Record<string, unknown[]> = {};
  const boardSummaries: unknown[] = [];
  const publicTop25Comparison: unknown[] = [];
  const publicEligibilityChanges: unknown[] = [];

  for (const ageGroup of RATING_AGE_GROUPS) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      const board = boardKey(ageGroup as AgeGroup, gender);
      const minGames = publicBoardMinimumGames(genderLabel(gender));
      const currentRows = sortBoardRows(currentBoardRows.get(board) ?? []);
      const recomputedRows = sortBoardRows(recomputedBoardRows.get(board) ?? []);
      const currentPublic = currentRows.filter((row) => isPublicEligible(row, ageGroup as AgeGroup));
      const recomputedPublic = recomputedRows.filter((row) => isPublicEligible(row, ageGroup as AgeGroup));

      const boardDiffs = playerDiffs.filter((row) => row.board === board);
      const movers = boardDiffs
        .filter((row) => row.publicRankDelta !== null && row.publicRankDelta !== 0)
        .sort((left, right) => Math.abs(right.publicRankDelta!) - Math.abs(left.publicRankDelta!))
        .slice(0, 50)
        .map((row) => ({
          playerId: row.playerId,
          displayName: row.displayName,
          currentPublicRank: row.currentPublicRank,
          recomputedPublicRank: row.recomputedPublicRank,
          publicRankDelta: row.publicRankDelta,
          ratingDelta: row.ratingDelta,
          verifiedGameCountDelta: row.verifiedGameCountDelta,
          changeType: row.changeType
        }));

      top50MoversByBoard[board] = movers;

      boardSummaries.push({
        board,
        minimumGames: minGames,
        current: {
          ratedPlayers: currentRows.length,
          publicEligible: currentPublic.length,
          meanRating: currentRows.length
            ? round(currentRows.reduce((sum, row) => sum + row.rating, 0) / currentRows.length)
            : null
        },
        recomputed: {
          ratedPlayers: recomputedRows.length,
          publicEligible: recomputedPublic.length,
          meanRating: recomputedRows.length
            ? round(recomputedRows.reduce((sum, row) => sum + row.rating, 0) / recomputedRows.length)
            : null
        },
        changeCounts: {
          creates: boardDiffs.filter((row) => row.changeType === "create").length,
          updates: boardDiffs.filter((row) => row.changeType === "update").length,
          deletes: boardDiffs.filter((row) => row.changeType === "delete").length,
          unchanged: boardDiffs.filter((row) => row.changeType === "unchanged").length
        },
        publicEligibilityDelta: recomputedPublic.length - currentPublic.length,
        publicMovers: movers.length
      });

      const beforeTop25 = currentPublic.slice(0, 25).map((row, index) => ({
        rank: index + 1,
        playerId: row.playerId,
        displayName: row.displayName,
        rating: row.rating,
        verifiedGameCount: row.verifiedGameCount
      }));
      const afterTop25 = recomputedPublic.slice(0, 25).map((row, index) => ({
        rank: index + 1,
        playerId: row.playerId,
        displayName: row.displayName,
        rating: row.rating,
        verifiedGameCount: row.verifiedGameCount
      }));

      const beforeIds = new Set(beforeTop25.map((row) => row.playerId));
      const afterIds = new Set(afterTop25.map((row) => row.playerId));
      const droppedFromTop25 = beforeTop25.filter((row) => !afterIds.has(row.playerId));
      const addedToTop25 = afterTop25.filter((row) => !beforeIds.has(row.playerId));

      publicTop25Comparison.push({
        board,
        before: beforeTop25,
        after: afterTop25,
        droppedFromTop25,
        addedToTop25,
        sameOrder: beforeTop25.every(
          (row, index) => afterTop25[index]?.playerId === row.playerId && afterTop25[index]?.rank === row.rank
        )
      });

      for (const diff of boardDiffs) {
        const wasPublic =
          diff.current !== null &&
          isPublicEligible(
            {
              playerId: diff.playerId,
              displayName: diff.displayName,
              gender: diff.gender,
              ageGroup: diff.ageGroup,
              rating: diff.current.adjustedRating,
              verifiedGameCount: diff.current.verifiedGameCount,
              starRating: diff.current.starRating,
              computedAgeBracket: diff.computedAgeBracket
            },
            ageGroup as AgeGroup
          );
        const willBePublic =
          diff.recomputed !== null &&
          isPublicEligible(
            {
              playerId: diff.playerId,
              displayName: diff.displayName,
              gender: diff.gender,
              ageGroup: diff.ageGroup,
              rating: diff.recomputed.adjustedRating,
              verifiedGameCount: diff.recomputed.verifiedGameCount,
              starRating: diff.recomputed.starRating,
              computedAgeBracket: diff.computedAgeBracket
            },
            ageGroup as AgeGroup
          );

        if (wasPublic !== willBePublic) {
          publicEligibilityChanges.push({
            playerId: diff.playerId,
            displayName: diff.displayName,
            board,
            wasPublic,
            willBePublic,
            reason:
              willBePublic && !wasPublic
                ? "gains_public_eligibility"
                : "loses_public_eligibility",
            current: diff.current,
            recomputed: diff.recomputed,
            computedAgeBracket: diff.computedAgeBracket,
            minimumGames: minGames
          });
        }
      }
    }
  }

  const findings = [
    {
      id: "rating-updates-required",
      severity: changeCounts.updates > 0 ? "high" : "info",
      summary: `${changeCounts.updates} PlayerRating row(s) would change on recompute.`,
      count: changeCounts.updates
    },
    {
      id: "rating-creates-required",
      severity: changeCounts.creates > 0 ? "medium" : "info",
      summary: `${changeCounts.creates} PlayerRating row(s) would be created from GPS evidence.`,
      count: changeCounts.creates
    },
    {
      id: "rating-deletes-required",
      severity: changeCounts.deletes > 0 ? "medium" : "info",
      summary: `${changeCounts.deletes} PlayerRating row(s) would be deleted (no backing GPS).`,
      count: changeCounts.deletes
    },
    {
      id: "public-eligibility-changes",
      severity: publicEligibilityChanges.length > 0 ? "medium" : "info",
      summary: `${publicEligibilityChanges.length} player(s) would change public-board eligibility.`,
      count: publicEligibilityChanges.length
    },
    {
      id: "public-top25-changes",
      severity: publicTop25Comparison.some((entry) => !(entry as { sameOrder: boolean }).sameOrder) ? "high" : "info",
      summary: `${publicTop25Comparison.filter((entry) => !(entry as { sameOrder: boolean }).sameOrder).length} board(s) would reshuffle public top 25.`,
      count: publicTop25Comparison.filter((entry) => !(entry as { sameOrder: boolean }).sameOrder).length
    }
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "player-rating-recompute-dry-run",
    mode: "read-only",
    aggregationScope: "all Formula v1 GPS grouped by league.ageGroup",
    formulaVersion: formulaVersion?.versionNumber ?? null,
    ratingTolerance: RATING_TOLERANCE,
    changeCounts,
    findings,
    boardSummaries,
    publicTop25Comparison,
    publicEligibilityChanges,
    top50MoversByBoard,
    playerDiffs: playerDiffs.sort(
      (left, right) =>
        Math.abs(right.ratingDelta ?? 0) - Math.abs(left.ratingDelta ?? 0) ||
        left.board.localeCompare(right.board) ||
        left.displayName.localeCompare(right.displayName)
    )
  };

  const outputPath = join(process.cwd(), "scripts", "reports", "player-rating-recompute-dry-run.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ outputPath, changeCounts, findings }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
