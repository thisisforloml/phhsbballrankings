import "server-only";

import { AgeGroup } from "@prisma/client";

import { buildEligibilityInput, evaluateEligibility } from "@/lib/eligibility";
import { resolveFormulaV1VersionId } from "@/lib/formula-v1/compute-game-performance-scores";
import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { resolvePrimaryRankingAffiliation } from "@/lib/player-display-affiliation";
import type { HomeLeaderboardRow } from "@/lib/public-site-data";
import { getCurrentRankingAgeBracket, getEffectiveClassYear } from "@/lib/ranking-eligibility";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";

const MANILA_TZ = "Asia/Manila";
/** Minimum verified games in a week before it qualifies for best-performer selection. */
const MIN_WEEK_GAMES = 4;

const WEEKDAY_OFFSET_FROM_MONDAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function formatManilaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysToManilaYmd(ymd: string, deltaDays: number): string {
  const anchor = new Date(`${ymd}T12:00:00+08:00`);
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return formatManilaYmd(anchor);
}

function manilaWeekRange(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date();
  const todayYmd = formatManilaYmd(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: MANILA_TZ, weekday: "short" }).format(now);
  const daysFromMonday = WEEKDAY_OFFSET_FROM_MONDAY[weekday] ?? 0;
  const mondayYmd = addDaysToManilaYmd(todayYmd, -daysFromMonday - weeksAgo * 7);
  const start = new Date(`${mondayYmd}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

async function findBestPerformerPlayerIdForRange(range: { start: Date; end: Date }): Promise<string | null> {
  const formulaVersionId = await resolveFormulaV1VersionId();

  const weekGameCount = await prisma.game.count({
    where: {
      deletedAt: null,
      gameDate: { gte: range.start, lt: range.end },
      season: { deletedAt: null, league: { deletedAt: null } },
    },
  });

  if (weekGameCount < MIN_WEEK_GAMES) return null;

  const scores = await prisma.gamePerformanceScore.findMany({
    where: {
      deletedAt: null,
      formulaVersionId,
      finalPerformanceScore: { not: null },
      game: {
        deletedAt: null,
        gameDate: { gte: range.start, lt: range.end },
        season: { deletedAt: null, league: { deletedAt: null } },
      },
    },
    select: {
      playerId: true,
      finalPerformanceScore: true,
    },
  });

  if (!scores.length) return null;

  const byPlayer = new Map<string, { total: number; games: number; peak: number }>();
  for (const row of scores) {
    const value = Number(row.finalPerformanceScore);
    const current = byPlayer.get(row.playerId) ?? { total: 0, games: 0, peak: 0 };
    current.total += value;
    current.games += 1;
    current.peak = Math.max(current.peak, value);
    byPlayer.set(row.playerId, current);
  }

  let bestPlayerId: string | null = null;
  let bestAverage = -1;
  let bestPeak = -1;

  for (const [playerId, stats] of byPlayer.entries()) {
    const average = stats.total / stats.games;
    if (average > bestAverage || (average === bestAverage && stats.peak > bestPeak)) {
      bestPlayerId = playerId;
      bestAverage = average;
      bestPeak = stats.peak;
    }
  }

  return bestPlayerId;
}

async function buildLeaderboardRowFromPlayerId(playerId: string): Promise<HomeLeaderboardRow | null> {
  const policyVersionId = getActivePolicyVersionId();
  const formulaVersionId = await resolveFormulaV1VersionId();
  const rating = await prisma.playerRating.findFirst({
    where: {
      playerId,
      ageGroup: AgeGroup.U19,
      policyVersionId,
      player: { deletedAt: null },
    },
    orderBy: { adjustedRating: "desc" },
    include: {
      player: {
        include: {
          currentProgram: true,
          gameStats: {
            where: { deletedAt: null },
            take: 1,
            include: { team: { include: { program: true } } },
          },
        },
      },
    },
  });

  if (!rating) return null;

  const birthDate = rating.player.birthDate;
  const birthYear = birthDate ? birthDate.getUTCFullYear() : null;
  const today = new Date();
  let age: number | null = null;
  if (birthDate) {
    age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
      age -= 1;
    }
  }

  const effectiveClassYear = getEffectiveClassYear(birthDate, rating.player.classYearOverride);
  const eligibilityVerdict = evaluateEligibility(
    buildEligibilityInput({
      playerId: rating.playerId,
      gender: rating.player.gender,
      birthDate,
      firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
      classYearOverride: rating.player.classYearOverride,
      ageGroupOverride: rating.player.ageGroupOverride,
      ratingAgeGroup: "U19",
      verifiedGameCount: rating.verifiedGameCount,
      evaluatedBoard: "U19",
      formulaVersionId,
    })
  );

  return {
    rank: 0,
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    slug: slugify(rating.player.displayName),
    city: rating.player.city,
    region: rating.player.region,
    position: rating.player.position,
    heightCm: rating.player.heightCm,
    birthYear,
    age,
    currentTeam: resolvePrimaryRankingAffiliation({
      schoolOverride: rating.player.schoolOverride,
      currentProgram: rating.player.currentProgram,
      gameStats: rating.player.gameStats,
    }),
    photoUrl: rating.player.photoUrl,
    gender: rating.player.gender === "GIRLS" ? "Girls" : "Boys",
    ageGroup: "U19",
    computedAgeBracket: getCurrentRankingAgeBracket(
      birthDate,
      today,
      rating.player.classYearOverride,
      "U19"
    ),
    effectiveClassYear,
    classYearLabel: effectiveClassYear ? `Class of ${effectiveClassYear}` : null,
    eligibilityVerdict,
    rating: Number(rating.adjustedRating),
    starRating: rating.starRating,
    verifiedGameCount: rating.verifiedGameCount,
    primaryCompetition: null,
  };
}

export async function resolveWeeklyBestPerformer(
  boardRows: HomeLeaderboardRow[],
  fallback: HomeLeaderboardRow | null
): Promise<HomeLeaderboardRow | null> {
  for (const weeksAgo of [0, 1] as const) {
    const range = manilaWeekRange(weeksAgo);
    const playerId = await findBestPerformerPlayerIdForRange(range);
    if (!playerId) continue;

    const fromBoard = boardRows.find((row) => row.playerId === playerId);
    if (fromBoard) return fromBoard;

    const built = await buildLeaderboardRowFromPlayerId(playerId);
    if (built) return built;
  }

  return fallback;
}
