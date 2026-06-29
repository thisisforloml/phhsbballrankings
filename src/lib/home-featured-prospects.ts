import type { HomeData, HomeLeaderboardRow, PublicAgeGroup, PublicGender } from "@/lib/public-site-data";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];
const genders: PublicGender[] = ["Boys", "Girls"];

/** Cross-board featured picks — always up to four, excluding the hero #1. */
export function buildCrossBoardFeaturedProspects(data: HomeData, limit = 4): HomeLeaderboardRow[] {
  const heroId = data.leaderboardsByAge.U19.boys[0]?.playerId ?? null;
  const boysRest = data.leaderboardsByAge.U19.boys.slice(1);
  const girls = data.leaderboardsByAge.U19.girls;

  const allPool: HomeLeaderboardRow[] = [];
  for (const ageGroup of ageGroups) {
    for (const gender of genders) {
      const board = data.leaderboardsByAge[ageGroup];
      allPool.push(...(gender === "Girls" ? board.girls : board.boys));
    }
  }

  const seen = new Set<string>();
  const result: HomeLeaderboardRow[] = [];

  const push = (row?: HomeLeaderboardRow) => {
    if (!row || (heroId && row.playerId === heroId) || seen.has(row.playerId)) return;
    seen.add(row.playerId);
    result.push(row);
  };

  // Diversity-first: top boys (ex-#1) + top girls when available
  push(boysRest[0]);
  push(boysRest[1]);
  push(girls[0]);
  push(girls[1]);

  for (const row of boysRest) {
    if (result.length >= limit) break;
    push(row);
  }

  for (const row of allPool.sort((left, right) => right.rating - left.rating)) {
    if (result.length >= limit) break;
    push(row);
  }

  return result.slice(0, limit);
}
