import type { HomeData, HomeLeaderboardRow, PublicAgeGroup } from "@/lib/public-site-data";
import type { LatestNationalRankings } from "@/lib/rankings";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];

/** Highest-rated players across every public board (deduped by player, best rating kept). */
export function collectGlobalRatedProspects(
  rankings: LatestNationalRankings,
  limit: number
): HomeLeaderboardRow[] {
  const byPlayer = new Map<string, HomeLeaderboardRow>();

  for (const ageGroup of ageGroups) {
    const boards = rankings.snapshotsByAge[ageGroup];
    for (const row of [...boards.boys.rows, ...boards.girls.rows]) {
      const candidate = row as HomeLeaderboardRow;
      const existing = byPlayer.get(row.playerId);
      if (!existing || row.rating > existing.rating) {
        byPlayer.set(row.playerId, candidate);
      }
    }
  }

  return [...byPlayer.values()]
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        right.verifiedGameCount - left.verifiedGameCount ||
        left.displayName.localeCompare(right.displayName)
    )
    .slice(0, limit);
}

/** Next highest-rated prospects after the homepage hero, excluding the hero player. */
export function buildCrossBoardFeaturedProspects(data: HomeData, limit = 4): HomeLeaderboardRow[] {
  const heroId = data.globalTopProspects[0]?.playerId ?? null;
  return data.globalTopProspects
    .slice(1)
    .filter((row) => !heroId || row.playerId !== heroId)
    .slice(0, limit);
}
