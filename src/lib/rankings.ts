import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { cache } from "react";
import { slugify } from "./format";
import { resolvePrimaryRankingAffiliation, type GameStatAffiliationRef } from "./player-display-affiliation";
import { buildEligibilityInput, evaluateEligibility, type EligibilityVerdict } from "./eligibility";
import { getCurrentRankingAgeBracket, getEffectiveClassYear } from "./ranking-eligibility";
import { prisma } from "./prisma";
import { getPublicBoardRows, normalizePublicBoardPosition } from "./public-board-ranks";
import { resolveActivePlayerRatingFilter } from "./ratings/player-rating-query";
import {
  affiliationGameStatsFromBoardStats,
  buildParticipationMapFromBoardStats,
  loadRankingBoardGameStatsByPlayerIds,
  primaryCompetitionFromSummary,
  type PrimaryCompetition,
} from "./player-competition-context";
import {
  isPostPrismaProfileEnabled,
  postPrismaCount,
  postPrismaMark,
} from "./post-prisma-profile";
import { runWithConcurrency } from "./run-with-concurrency";

const defaultAgeGroup = AgeGroup.U19;
const HOME_BOARD_DISPLAY_LIMIT = 10;
/** Max independent boards loaded at once (each board uses several sequential Prisma calls). */
const RANKINGS_BOARD_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.RANKINGS_BOARD_CONCURRENCY ?? "3", 10) || 3
);

export const rankingAgeGroups = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const;

export const rankingPlayerSelect = {
  id: true,
  displayName: true,
  city: true,
  region: true,
  position: true,
  heightCm: true,
  birthDate: true,
  firstRankingEligibilityAt: true,
  classYearOverride: true,
  photoUrl: true,
  gender: true,
  schoolOverride: true,
  ageGroupOverride: true,
  currentProgram: { select: { fullName: true, abbreviation: true, type: true } },
} as const;

const playerRatingPlayerSelect = rankingPlayerSelect;

const playerAffiliationGameStatsSelect = {
  team: {
    select: {
      name: true,
      program: { select: { fullName: true, abbreviation: true, type: true } },
    },
  },
  game: { select: { gameDate: true } },
} as const;

const playerRatingPlayerSelectForHomePreview = {
  ...playerRatingPlayerSelect,
  gameStats: {
    where: { deletedAt: null },
    select: playerAffiliationGameStatsSelect,
    orderBy: { game: { gameDate: "desc" } },
    take: 40,
  },
} as const;

export type RankingGender = "Boys" | "Girls";
export type RankingAgeGroup = "U13" | "U16" | "U19";

export type NationalRankingRow = {
  rank: number;
  playerId: string;
  displayName: string;
  slug: string;
  city: string;
  region: string;
  position: string | null;
  heightCm: number | null;
  birthYear: number | null;
  age: number | null;
  currentTeam: string;
  photoUrl: string | null;
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  computedAgeBracket: RankingAgeGroup | "OUT_OF_RANGE" | null;
  effectiveClassYear: number | null;
  classYearLabel: string | null;
  eligibilityVerdict: EligibilityVerdict;
  rating: number;
  starRating: number;
  verifiedGameCount: number;
  primaryCompetition: PrimaryCompetition | null;
};

export type NationalRankingSnapshot = {
  snapshotId: string | null;
  gender: RankingGender;
  ageGroup: RankingAgeGroup;
  weekOf: string | null;
  formulaVersionId: string | null;
  totalRows: number;
  rows: NationalRankingRow[];
};

export type LatestNationalRankings = {
  formulaVersionId: string | null;
  snapshots: {
    boys: NationalRankingSnapshot;
    girls: NationalRankingSnapshot;
  };
  snapshotsByAge: Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
};

export type PublicBoardRankLookup = {
  nationalRank: number | null;
  regionRank: number | null;
  positionRank: number | null;
  snapshotWeekOf: string | null;
  snapshotRank: number | null;
  row: NationalRankingRow | null;
};

function toDisplayGender(gender: PlayerGender): RankingGender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function genderKey(gender: PlayerGender | RankingGender) {
  return gender === PlayerGender.GIRLS || gender === "Girls" ? "girls" : "boys";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function emptySnapshot(gender: PlayerGender, formulaVersionId: string | null, ageGroup: RankingAgeGroup): NationalRankingSnapshot {
  return { snapshotId: null, gender: toDisplayGender(gender), ageGroup, weekOf: null, formulaVersionId, totalRows: 0, rows: [] };
}

type ActiveRatingFilter = Awaited<ReturnType<typeof resolveActivePlayerRatingFilter>>;

type PlayerRatingWithPlayer = Awaited<
  ReturnType<
    typeof prisma.playerRating.findMany<{
      include: { player: { select: typeof playerRatingPlayerSelect } };
    }>
  >
>[number] & {
  player: Awaited<
    ReturnType<
      typeof prisma.playerRating.findMany<{
        include: { player: { select: typeof playerRatingPlayerSelect } };
      }>
    >
  >[number]["player"] & {
    gameStats?: GameStatAffiliationRef[] | null;
  };
};

export function rankingBoardPlayerRatingWhere(
  gender: PlayerGender,
  ageGroup: RankingAgeGroup,
  ratingFilter: ActiveRatingFilter,
  formulaVersionId: string
) {
  return {
    ageGroup: ageGroup as AgeGroup,
    formulaVersionId,
    policyVersionId: ratingFilter.policyVersionId,
    player: { gender, deletedAt: null },
  };
}

const playerRatingBoardWhere = rankingBoardPlayerRatingWhere;

function mapNationalRankingRow(
  rating: PlayerRatingWithPlayer,
  index: number,
  ageGroup: RankingAgeGroup,
  activeFormulaVersionId: string,
  primaryCompetition: PrimaryCompetition | null
): NationalRankingRow {
  const eligibilityVerdict = evaluateEligibility(
    buildEligibilityInput({
      playerId: rating.playerId,
      gender: rating.player.gender,
      birthDate: rating.player.birthDate,
      firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
      classYearOverride: rating.player.classYearOverride,
      ageGroupOverride: rating.player.ageGroupOverride,
      ratingAgeGroup: rating.ageGroup as RankingAgeGroup,
      verifiedGameCount: rating.verifiedGameCount,
      evaluatedBoard: ageGroup,
      formulaVersionId: activeFormulaVersionId,
    })
  );

  const effectiveClassYear = getEffectiveClassYear(rating.player.birthDate, rating.player.classYearOverride);

  return {
    rank: index + 1,
    playerId: rating.playerId,
    displayName: rating.player.displayName,
    slug: slugify(rating.player.displayName),
    city: rating.player.city,
    region: rating.player.region,
    position: rating.player.position,
    heightCm: rating.player.heightCm,
    birthYear: rating.player.birthDate ? rating.player.birthDate.getUTCFullYear() : null,
    age: calculateAge(rating.player.birthDate),
    currentTeam: resolvePrimaryRankingAffiliation({
      schoolOverride: rating.player.schoolOverride,
      currentProgram: rating.player.currentProgram,
      gameStats: rating.player.gameStats,
    }),
    photoUrl: rating.player.photoUrl,
    gender: toDisplayGender(rating.player.gender),
    ageGroup: (rating.player.ageGroupOverride || ageGroup) as RankingAgeGroup,
    computedAgeBracket: getCurrentRankingAgeBracket(
      rating.player.birthDate,
      new Date(),
      rating.player.classYearOverride,
      ageGroup
    ),
    effectiveClassYear,
    classYearLabel: effectiveClassYear ? `Class of ${effectiveClassYear}` : null,
    eligibilityVerdict,
    rating: Number(rating.adjustedRating),
    starRating: rating.starRating,
    verifiedGameCount: rating.verifiedGameCount,
    primaryCompetition,
  };
}

async function getLatestSnapshot(
  gender: PlayerGender,
  formulaVersionId: string | null,
  ageGroup: RankingAgeGroup,
  ratingFilter: ActiveRatingFilter
): Promise<NationalRankingSnapshot> {
  const activeFormulaVersionId = ratingFilter.formulaVersionId ?? formulaVersionId;
  if (!activeFormulaVersionId) return emptySnapshot(gender, null, ageGroup);

  const [latestSnapshot, ratings] = await Promise.all([
    prisma.rankingSnapshot.findFirst({
      where: {
        scope: RankingScope.NATIONAL,
        ageGroup: ageGroup as AgeGroup,
        gender,
        formulaVersionId: activeFormulaVersionId,
        city: null,
        region: null,
      },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    }),
    prisma.playerRating.findMany({
      where: playerRatingBoardWhere(gender, ageGroup, ratingFilter, activeFormulaVersionId),
      include: {
        player: {
          select: playerRatingPlayerSelect,
        },
      },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
    }),
  ]);

  const playerIds = ratings.map((rating) => rating.playerId);
  const statsByPlayer = await loadRankingBoardGameStatsByPlayerIds(playerIds);
  postPrismaMark(`prisma.finished.${ageGroup}.${gender}`, {
    ratings: ratings.length,
    gameStatPlayers: statsByPlayer.size,
  });

  const participationByPlayer = buildParticipationMapFromBoardStats(playerIds, statsByPlayer);
  if (isPostPrismaProfileEnabled()) {
    postPrismaCount("participationMapPlayers", playerIds.length);
    postPrismaMark(`transform.participationMap.${ageGroup}.${gender}`, {
      players: playerIds.length,
    });
  }

  let mapNationalRankingRowMs = 0;
  const rows = ratings.map((rating, index) => {
    const boardStats = statsByPlayer.get(rating.playerId) ?? [];
    const mapStart = isPostPrismaProfileEnabled() ? performance.now() : 0;
    if (isPostPrismaProfileEnabled()) {
      postPrismaCount("affiliationTransforms");
      postPrismaCount("affiliationSortOps", boardStats.length > 1 ? boardStats.length * Math.log2(boardStats.length) : 0);
      postPrismaCount("ratingSpreadCopies");
      postPrismaCount("mapNationalRankingRowCalls");
    }
    const row = mapNationalRankingRow(
      {
        ...rating,
        player: {
          ...rating.player,
          gameStats: affiliationGameStatsFromBoardStats(boardStats),
        },
      },
      index,
      ageGroup,
      activeFormulaVersionId,
      primaryCompetitionFromSummary(
        participationByPlayer.get(rating.playerId) ?? {
          primary: null,
          totalVerifiedGames: 0,
          competitionCount: 0,
          competitions: [],
        }
      )
    );
    if (isPostPrismaProfileEnabled()) {
      mapNationalRankingRowMs += performance.now() - mapStart;
    }
    return row;
  });

  if (isPostPrismaProfileEnabled()) {
    postPrismaMark(`transform.mapNationalRankingRow.${ageGroup}.${gender}`, {
      rows: rows.length,
      totalMs: mapNationalRankingRowMs,
      avgMsPerRow: rows.length ? mapNationalRankingRowMs / rows.length : 0,
    });
  }

  return {
    snapshotId: latestSnapshot?.id ?? null,
    gender: toDisplayGender(gender),
    ageGroup,
    weekOf: latestSnapshot?.weekOf.toISOString() ?? null,
    formulaVersionId: activeFormulaVersionId,
    totalRows: ratings.length,
    rows,
  };
}

export async function buildLatestNationalRankingsLive(
  ageGroups: readonly RankingAgeGroup[] = rankingAgeGroups
): Promise<LatestNationalRankings> {
  postPrismaMark("loader.buildLatestNationalRankings.start", {
    ageGroups: [...ageGroups],
    boardConcurrency: RANKINGS_BOARD_CONCURRENCY,
  });
  const ratingFilter = await resolveActivePlayerRatingFilter();
  const formulaVersionId = ratingFilter.formulaVersionId;

  const boardJobs = ageGroups.flatMap((ageGroup) => [
    { ageGroup, gender: PlayerGender.BOYS },
    { ageGroup, gender: PlayerGender.GIRLS },
  ]);

  const loadedBoards = await runWithConcurrency(
    boardJobs,
    RANKINGS_BOARD_CONCURRENCY,
    async ({ ageGroup, gender }) => {
      const snapshot = await getLatestSnapshot(gender, formulaVersionId, ageGroup, ratingFilter);
      return { ageGroup, gender, snapshot };
    }
  );

  const boardByKey = new Map(
    loadedBoards.map((board) => [`${board.ageGroup}:${board.gender}`, board.snapshot] as const)
  );

  const snapshotsByAge = {} as Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
  for (const ageGroup of ageGroups) {
    const boys = boardByKey.get(`${ageGroup}:${PlayerGender.BOYS}`)!;
    const girls = boardByKey.get(`${ageGroup}:${PlayerGender.GIRLS}`)!;
    snapshotsByAge[ageGroup] = { boys, girls };
    postPrismaMark(`loader.boardPair.done.${ageGroup}`, {
      boysRows: boys.rows.length,
      girlsRows: girls.rows.length,
    });
  }

  postPrismaMark("loader.buildLatestNationalRankings.done");
  return {
    formulaVersionId,
    snapshots: snapshotsByAge[defaultAgeGroup as RankingAgeGroup],
    snapshotsByAge,
  };
}

async function getLatestNationalRankingsWithFallback(): Promise<LatestNationalRankings> {
  if (process.env.RANKINGS_READ_FROM_SNAPSHOTS === "1") {
    try {
      const { buildLatestNationalRankingsFromSnapshots } = await import("./rankings-snapshot-read");
      return await buildLatestNationalRankingsFromSnapshots(rankingAgeGroups);
    } catch (error) {
      postPrismaMark("loader.snapshotRead.fallback", {
        reason: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return buildLatestNationalRankingsLive(rankingAgeGroups);
}

export const getLatestNationalRankings = cache(async () => getLatestNationalRankingsWithFallback());

export { getLatestNationalRankingsFromSnapshots } from "./rankings-snapshot-read";

export const getHomeNationalRankings = cache(async () =>
  buildLatestNationalRankingsLive([defaultAgeGroup as RankingAgeGroup])
);

export type HomeNationalBoardPreview = {
  formulaVersionId: string | null;
  snapshots: {
    boys: NationalRankingSnapshot;
    girls: NationalRankingSnapshot;
  };
};

async function fetchHomeGenderBoard(
  gender: PlayerGender,
  ageGroup: RankingAgeGroup,
  ratingFilter: ActiveRatingFilter,
  formulaVersionId: string
): Promise<NationalRankingSnapshot> {
  const [totalRows, latestSnapshot, ratings] = await Promise.all([
    prisma.playerRating.count({
      where: playerRatingBoardWhere(gender, ageGroup, ratingFilter, formulaVersionId),
    }),
    prisma.rankingSnapshot.findFirst({
      where: {
        scope: RankingScope.NATIONAL,
        ageGroup: ageGroup as AgeGroup,
        gender,
        formulaVersionId,
        city: null,
        region: null,
      },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    }),
    prisma.playerRating.findMany({
      where: playerRatingBoardWhere(gender, ageGroup, ratingFilter, formulaVersionId),
      include: {
        player: {
          select: playerRatingPlayerSelectForHomePreview,
        },
      },
      orderBy: [{ adjustedRating: "desc" }, { verifiedGameCount: "desc" }, { player: { displayName: "asc" } }],
      take: HOME_BOARD_DISPLAY_LIMIT,
    }),
  ]);

  return {
    snapshotId: latestSnapshot?.id ?? null,
    gender: toDisplayGender(gender),
    ageGroup,
    weekOf: latestSnapshot?.weekOf.toISOString() ?? null,
    formulaVersionId,
    totalRows,
    rows: ratings.map((rating, index) =>
      mapNationalRankingRow(rating, index, ageGroup, formulaVersionId, null)
    ),
  };
}

export const getHomeNationalBoardPreview = cache(async (): Promise<HomeNationalBoardPreview> => {
  const ratingFilter = await resolveActivePlayerRatingFilter();
  const formulaVersionId = ratingFilter.formulaVersionId;
  const ageGroup = defaultAgeGroup as RankingAgeGroup;

  if (!formulaVersionId) {
    return {
      formulaVersionId: null,
      snapshots: {
        boys: emptySnapshot(PlayerGender.BOYS, null, ageGroup),
        girls: emptySnapshot(PlayerGender.GIRLS, null, ageGroup),
      },
    };
  }

  const [boys, girls] = await Promise.all([
    fetchHomeGenderBoard(PlayerGender.BOYS, ageGroup, ratingFilter, formulaVersionId),
    fetchHomeGenderBoard(PlayerGender.GIRLS, ageGroup, ratingFilter, formulaVersionId),
  ]);

  return { formulaVersionId, snapshots: { boys, girls } };
});

export async function getCurrentPublicBoardRankForPlayer(playerId: string, gender: PlayerGender, ageGroup: AgeGroup): Promise<PublicBoardRankLookup> {
  const rankings = await getLatestNationalRankings();
  const snapshot = rankings.snapshotsByAge[ageGroup as RankingAgeGroup]?.[genderKey(gender)];
  if (!snapshot) return { nationalRank: null, regionRank: null, positionRank: null, snapshotWeekOf: null, snapshotRank: null, row: null };

  const rows = getPublicBoardRows(snapshot);
  const rowIndex = rows.findIndex((row) => row.playerId === playerId);
  if (rowIndex < 0) return { nationalRank: null, regionRank: null, positionRank: null, snapshotWeekOf: snapshot.weekOf, snapshotRank: null, row: null };

  const row = rows[rowIndex];
  const region = row.region?.trim().toLowerCase();
  const position = normalizePublicBoardPosition(row.position);
  const regionRows = region ? rows.filter((candidate) => candidate.region?.trim().toLowerCase() === region) : [];
  const positionRows = position ? rows.filter((candidate) => normalizePublicBoardPosition(candidate.position) === position) : [];
  const regionIndex = regionRows.findIndex((candidate) => candidate.playerId === playerId);
  const positionIndex = positionRows.findIndex((candidate) => candidate.playerId === playerId);

  return {
    nationalRank: rowIndex + 1,
    regionRank: regionIndex >= 0 ? regionIndex + 1 : null,
    positionRank: positionIndex >= 0 ? positionIndex + 1 : null,
    snapshotWeekOf: snapshot.weekOf,
    snapshotRank: row.rank,
    row
  };
}
