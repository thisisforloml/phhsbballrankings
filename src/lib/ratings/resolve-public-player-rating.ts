import type { AgeGroup, PlayerRating } from "@prisma/client";
import { getActivePolicyVersionId } from "@/lib/ratings/player-rating-query";
import { getCurrentRankingAgeBracket } from "@/lib/ranking-eligibility";

type RatedPlayer = {
  birthDate: Date | null;
  classYearOverride?: number | null;
  currentRatings: Array<
    Pick<PlayerRating, "ageGroup" | "adjustedRating" | "verifiedGameCount" | "policyVersionId" | "ratingBasis" | "observedRating" | "starRating">
  >;
  gameStats?: Array<{ game?: { season?: { league?: { ageGroup?: AgeGroup } } } }>;
};

export function filterProductionV1Ratings<T extends { policyVersionId: string }>(ratings: T[]): T[] {
  return ratings.filter((rating) => rating.policyVersionId === getActivePolicyVersionId());
}

/**
 * Unknown DOB: keep competition-board placement (highest verified v1 rating).
 * Known DOB: prefer calendar home-board v1 production rating when present.
 */
export function selectPublicPlayerRating(
  player: RatedPlayer,
  evaluationDate: Date = new Date()
): RatedPlayer["currentRatings"][number] | null {
  const productionRatings = filterProductionV1Ratings(player.currentRatings);
  if (!productionRatings.length) return null;

  if (player.birthDate) {
    const latestCompetition = player.gameStats?.[0]?.game?.season?.league?.ageGroup ?? null;
    const homeBracket = getCurrentRankingAgeBracket(
      player.birthDate,
      evaluationDate,
      player.classYearOverride ?? null,
      latestCompetition ?? undefined
    );
    if (homeBracket && homeBracket !== "OUT_OF_RANGE") {
      const homeRating = productionRatings.find((rating) => rating.ageGroup === homeBracket);
      if (homeRating) return homeRating;
    }
  }

  const latestStatAgeGroup = player.gameStats?.[0]?.game?.season?.league?.ageGroup ?? null;
  if (latestStatAgeGroup) {
    const matching = productionRatings.find((rating) => rating.ageGroup === latestStatAgeGroup);
    if (matching) return matching;
  }

  return productionRatings
    .slice()
    .sort(
      (left, right) =>
        right.verifiedGameCount - left.verifiedGameCount ||
        Number(right.adjustedRating) - Number(left.adjustedRating)
    )[0];
}
