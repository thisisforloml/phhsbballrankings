import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { slugify } from "./format";
import { resolvePrimaryRankingAffiliation } from "./player-display-affiliation";
import {
  affiliationGameStatsFromBoardStats,
  buildCompetitionParticipationFromStats,
  loadRankingBoardGameStatsByPlayerIds,
  primaryCompetitionFromSummary,
  type RankingBoardGameStat,
} from "./player-competition-context";
import { buildEligibilityInput, evaluateEligibility } from "./eligibility";
import { getCurrentRankingAgeBracket, getEffectiveClassYear } from "./ranking-eligibility";
import { prisma } from "./prisma";
import { resolveActivePlayerRatingFilter } from "./ratings/player-rating-query";
import { runWithConcurrency } from "./run-with-concurrency";
import type {
  LatestNationalRankings,
  NationalRankingRow,
  NationalRankingSnapshot,
  RankingAgeGroup,
  RankingGender,
} from "./rankings";
import { rankingAgeGroups, rankingBoardPlayerRatingWhere, rankingPlayerSelect } from "./rankings";

const defaultAgeGroup = AgeGroup.U19;
const RANKINGS_BOARD_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.RANKINGS_BOARD_CONCURRENCY ?? "3", 10) || 3
);

export class SnapshotReadIncompleteError extends Error {
  constructor(public readonly missingBoards: string[]) {
    super(`Incomplete ranking snapshots for boards: ${missingBoards.join(", ")}`);
    this.name = "SnapshotReadIncompleteError";
  }
}

type SnapshotRowRecord = {
  playerId: string;
  rank: number;
  rating: { toString(): string } | number;
  starRating: number;
  verifiedGameCount: number;
};

type PlayerForRankingRow = Awaited<
  ReturnType<
    typeof prisma.player.findMany<{
      select: typeof rankingPlayerSelect;
    }>
  >
>[number];

function toDisplayGender(gender: PlayerGender): RankingGender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
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

export function mapSnapshotRowToNationalRankingRow(
  snapshotRow: SnapshotRowRecord,
  player: PlayerForRankingRow,
  ageGroup: RankingAgeGroup,
  activeFormulaVersionId: string,
  boardStats: RankingBoardGameStat[] = []
): NationalRankingRow {
  const eligibilityVerdict = evaluateEligibility(
    buildEligibilityInput({
      playerId: snapshotRow.playerId,
      gender: player.gender,
      birthDate: player.birthDate,
      firstRankingEligibilityAt: player.firstRankingEligibilityAt,
      classYearOverride: player.classYearOverride,
      ageGroupOverride: player.ageGroupOverride,
      ratingAgeGroup: ageGroup,
      verifiedGameCount: snapshotRow.verifiedGameCount,
      evaluatedBoard: ageGroup,
      formulaVersionId: activeFormulaVersionId,
    })
  );

  const effectiveClassYear = getEffectiveClassYear(player.birthDate, player.classYearOverride);
  const affiliationStats = affiliationGameStatsFromBoardStats(boardStats);
  const primaryCompetition = primaryCompetitionFromSummary(
    buildCompetitionParticipationFromStats(boardStats.map((stat) => ({ game: stat.game })))
  );

  return {
    rank: snapshotRow.rank,
    playerId: snapshotRow.playerId,
    displayName: player.displayName,
    slug: slugify(player.displayName),
    city: player.city,
    region: player.region,
    position: player.position,
    heightCm: player.heightCm,
    birthYear: player.birthDate ? player.birthDate.getUTCFullYear() : null,
    age: calculateAge(player.birthDate),
    currentTeam: resolvePrimaryRankingAffiliation({
      schoolOverride: player.schoolOverride,
      currentProgram: player.currentProgram,
      gameStats: affiliationStats,
    }),
    photoUrl: player.photoUrl,
    gender: toDisplayGender(player.gender),
    ageGroup: (player.ageGroupOverride || ageGroup) as RankingAgeGroup,
    computedAgeBracket: getCurrentRankingAgeBracket(player.birthDate, new Date(), player.classYearOverride, ageGroup),
    effectiveClassYear,
    classYearLabel: effectiveClassYear ? `Class of ${effectiveClassYear}` : null,
    eligibilityVerdict,
    rating: Number(snapshotRow.rating),
    starRating: snapshotRow.starRating,
    verifiedGameCount: snapshotRow.verifiedGameCount,
    primaryCompetition,
  };
}

type LoadedSnapshotBoard = {
  ageGroup: RankingAgeGroup;
  gender: PlayerGender;
  snapshot: {
    id: string;
    weekOf: Date;
    rows: SnapshotRowRecord[];
  } | null;
  totalRows: number;
};

async function loadSnapshotBoard(
  gender: PlayerGender,
  ageGroup: RankingAgeGroup,
  formulaVersionId: string,
  ratingFilter: Awaited<ReturnType<typeof resolveActivePlayerRatingFilter>>
): Promise<LoadedSnapshotBoard> {
  const [snapshot, totalRows] = await Promise.all([
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
      select: {
        id: true,
        weekOf: true,
        rows: {
          orderBy: { rank: "asc" },
          select: {
            playerId: true,
            rank: true,
            rating: true,
            starRating: true,
            verifiedGameCount: true,
          },
        },
      },
    }),
    prisma.playerRating.count({
      where: rankingBoardPlayerRatingWhere(gender, ageGroup, ratingFilter, formulaVersionId),
    }),
  ]);

  return { ageGroup, gender, snapshot, totalRows };
}

function buildNationalSnapshotFromLoadedBoard(
  board: LoadedSnapshotBoard,
  formulaVersionId: string,
  playerById: Map<string, PlayerForRankingRow>,
  statsByPlayer: Map<string, RankingBoardGameStat[]>
): NationalRankingSnapshot {
  const snapshot = board.snapshot;
  if (!snapshot || snapshot.rows.length === 0) {
    return emptySnapshot(board.gender, formulaVersionId, board.ageGroup);
  }

  const rows: NationalRankingRow[] = [];
  for (const snapshotRow of snapshot.rows) {
    const player = playerById.get(snapshotRow.playerId);
    if (!player) continue;
    rows.push(
      mapSnapshotRowToNationalRankingRow(
        snapshotRow,
        player,
        board.ageGroup,
        formulaVersionId,
        statsByPlayer.get(snapshotRow.playerId) ?? []
      )
    );
  }

  return {
    snapshotId: snapshot.id,
    gender: toDisplayGender(board.gender),
    ageGroup: board.ageGroup,
    weekOf: snapshot.weekOf.toISOString(),
    formulaVersionId,
    totalRows: board.totalRows,
    rows,
  };
}

export async function buildLatestNationalRankingsFromSnapshots(
  ageGroups: readonly RankingAgeGroup[] = rankingAgeGroups
): Promise<LatestNationalRankings> {
  const ratingFilter = await resolveActivePlayerRatingFilter();
  const formulaVersionId = ratingFilter.formulaVersionId;
  if (!formulaVersionId) {
    return {
      formulaVersionId: null,
      snapshots: {
        boys: emptySnapshot(PlayerGender.BOYS, null, defaultAgeGroup as RankingAgeGroup),
        girls: emptySnapshot(PlayerGender.GIRLS, null, defaultAgeGroup as RankingAgeGroup),
      },
      snapshotsByAge: {} as LatestNationalRankings["snapshotsByAge"],
    };
  }

  const boardJobs = ageGroups.flatMap((ageGroup) => [
    { ageGroup, gender: PlayerGender.BOYS },
    { ageGroup, gender: PlayerGender.GIRLS },
  ]);

  const loadedBoards = await runWithConcurrency(boardJobs, RANKINGS_BOARD_CONCURRENCY, async (job) =>
    loadSnapshotBoard(job.gender, job.ageGroup, formulaVersionId, ratingFilter)
  );

  const missingBoards = loadedBoards
    .filter((board) => {
      if (board.totalRows === 0) return false;
      return !board.snapshot || board.snapshot.rows.length === 0;
    })
    .map((board) => `${board.ageGroup}:${board.gender}`);
  if (missingBoards.length > 0) {
    throw new SnapshotReadIncompleteError(missingBoards);
  }

  const allPlayerIds = [
    ...new Set(loadedBoards.flatMap((board) => board.snapshot?.rows.map((row) => row.playerId) ?? [])),
  ];

  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    select: rankingPlayerSelect,
  });
  const playerById = new Map(players.map((player) => [player.id, player]));
  const statsByPlayer = await loadRankingBoardGameStatsByPlayerIds(allPlayerIds);

  const boardByKey = new Map(
    loadedBoards.map((board) => [
      `${board.ageGroup}:${board.gender}`,
      buildNationalSnapshotFromLoadedBoard(board, formulaVersionId, playerById, statsByPlayer),
    ] as const)
  );

  const snapshotsByAge = {} as Record<RankingAgeGroup, { boys: NationalRankingSnapshot; girls: NationalRankingSnapshot }>;
  for (const ageGroup of ageGroups) {
    snapshotsByAge[ageGroup] = {
      boys: boardByKey.get(`${ageGroup}:${PlayerGender.BOYS}`)!,
      girls: boardByKey.get(`${ageGroup}:${PlayerGender.GIRLS}`)!,
    };
  }

  return {
    formulaVersionId,
    snapshots: snapshotsByAge[defaultAgeGroup as RankingAgeGroup],
    snapshotsByAge,
  };
}

export async function getLatestNationalRankingsFromSnapshots(): Promise<LatestNationalRankings> {
  return buildLatestNationalRankingsFromSnapshots(rankingAgeGroups);
}
