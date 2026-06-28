import type { AgeGroup, PlayerGender } from "@prisma/client";
import {
  buildEligibilityInput,
  evaluateEligibility,
  isPublicBoardVisible,
  publicBoardMinimumGames,
  type AgeVerificationStatus,
  type EligibilityBoard,
  type EligibilityVerdict
} from "@/lib/eligibility";
import { prisma } from "@/lib/prisma";
import { resolveActivePlayerRatingFilter } from "@/lib/ratings/player-rating-query";

/**
 * Snapshot Policy Rev 2 — visibility contract.
 * Snapshots mirror the public board at `evaluationDate` (snapshot `weekOf`).
 * Use `publicRankAllowed`, not `snapshotEligible`.
 */
export function isSnapshotBoardVisible(verdict: EligibilityVerdict): boolean {
  return isPublicBoardVisible(verdict);
}

export type SnapshotBoardRowInput = {
  playerId: string;
  rank: number;
  rating: number;
  starRating: number;
  verifiedGameCount: number;
  movement: number;
  ageVerificationStatus: AgeVerificationStatus;
};

export type BuildSnapshotBoardRowsParams = {
  ageGroup: AgeGroup;
  gender: PlayerGender;
  evaluationDate: Date;
  formulaVersionId: string;
  city?: string | null;
  region?: string | null;
};

export type BuildSnapshotBoardRowsResult = {
  rows: SnapshotBoardRowInput[];
  poolAtThreshold: number;
  excludedByVisibility: number;
  verifiedCount: number;
  pendingCount: number;
};

export async function buildSnapshotBoardRows(params: BuildSnapshotBoardRowsParams): Promise<BuildSnapshotBoardRowsResult> {
  const minimumGames = publicBoardMinimumGames(params.gender === "GIRLS" ? "Girls" : "Boys");
  const board = params.ageGroup as EligibilityBoard;
  const ratingFilter = await resolveActivePlayerRatingFilter();

  const ratings = await prisma.playerRating.findMany({
    where: {
      ageGroup: params.ageGroup,
      formulaVersionId: ratingFilter.formulaVersionId ?? params.formulaVersionId,
      policyVersionId: ratingFilter.policyVersionId,
      verifiedGameCount: { gte: minimumGames },
      player: {
        gender: params.gender,
        deletedAt: null,
        ...(params.city ? { city: params.city } : {}),
        ...(params.region ? { region: params.region } : {})
      }
    },
    include: {
      player: {
        select: {
          id: true,
          gender: true,
          birthDate: true,
          firstRankingEligibilityAt: true,
          classYearOverride: true,
          ageGroupOverride: true
        }
      }
    },
    orderBy: [
      { adjustedRating: "desc" },
      { verifiedGameCount: "desc" },
      { player: { displayName: "asc" } }
    ]
  });

  const visible: Array<{ rating: (typeof ratings)[number]; verdict: EligibilityVerdict }> = [];

  for (const rating of ratings) {
    const verdict = evaluateEligibility(
      buildEligibilityInput({
        playerId: rating.playerId,
        gender: rating.player.gender,
        birthDate: rating.player.birthDate,
        firstRankingEligibilityAt: rating.player.firstRankingEligibilityAt,
        classYearOverride: rating.player.classYearOverride,
        ageGroupOverride: rating.player.ageGroupOverride,
        ratingAgeGroup: rating.ageGroup as EligibilityBoard,
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: board,
        formulaVersionId: params.formulaVersionId,
        evaluationDate: params.evaluationDate
      })
    );

    if (isSnapshotBoardVisible(verdict)) {
      visible.push({ rating, verdict });
    }
  }

  const rows = visible.map(({ rating, verdict }, index) => ({
    playerId: rating.playerId,
    rank: index + 1,
    rating: Number(rating.adjustedRating),
    starRating: rating.starRating,
    verifiedGameCount: rating.verifiedGameCount,
    movement: 0,
    ageVerificationStatus: verdict.ageVerificationStatus
  }));

  return {
    rows,
    poolAtThreshold: ratings.length,
    excludedByVisibility: ratings.length - visible.length,
    verifiedCount: rows.filter((row) => row.ageVerificationStatus === "VERIFIED").length,
    pendingCount: rows.filter((row) => row.ageVerificationStatus === "PENDING").length
  };
}
