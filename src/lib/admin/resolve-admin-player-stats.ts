import { AgeGroup } from "@prisma/client";
import { getAgeBracketAsOfMarch31 } from "@/lib/ranking-eligibility";

const RANKING_AGE_GROUPS = new Set<AgeGroup>([AgeGroup.U13, AgeGroup.U16, AgeGroup.U19]);

export function resolveAdminPlayerStats(player: {
  birthDate: Date | null;
  ageGroupOverride: string | null;
  currentRatings: Array<{ ageGroup: AgeGroup; adjustedRating: unknown; verifiedGameCount: number }>;
  gameStats: Array<{ game: { id: string } }>;
}) {
  const computedBracket = getAgeBracketAsOfMarch31(player.birthDate);
  const targetBracket = player.ageGroupOverride ?? computedBracket;
  const rating =
    targetBracket && RANKING_AGE_GROUPS.has(targetBracket as AgeGroup)
      ? player.currentRatings.find((row) => row.ageGroup === targetBracket)
      : null;
  const resolvedRating = rating ?? player.currentRatings[0] ?? null;
  const statGameCount = new Set(player.gameStats.map((stat) => stat.game.id)).size;

  return {
    rating: resolvedRating ? Number(resolvedRating.adjustedRating) : null,
    verifiedGameCount: resolvedRating?.verifiedGameCount ?? (statGameCount > 0 ? statGameCount : null),
  };
}
