import { isPublicBoardVisible } from "@/lib/eligibility";

import type { NationalRankingRow, NationalRankingSnapshot } from "./rankings";
import type { RankingSortKey, SortDirection } from "./rankings-url-state";

export { publicBoardMinimumGames } from "@/lib/eligibility";

export function normalizePublicBoardPosition(position: string | null) {
  const normalized = position?.trim().toUpperCase().replace(/[^A-Z0-9/ -]/g, "").replace(/\s+/g, " ") || null;
  if (!normalized || normalized === "N/A" || normalized === "NA" || normalized === "UNKNOWN" || normalized === "NOT LISTED") return null;
  return normalized;
}

export function sortRankingRows(rows: NationalRankingRow[]) {
  return rows
    .slice()
    .sort((left, right) => left.rank - right.rank || right.rating - left.rating || right.verifiedGameCount - left.verifiedGameCount || left.displayName.localeCompare(right.displayName));
}

export function getPublicBoardRows(snapshot: NationalRankingSnapshot) {
  return sortRankingRows(
    snapshot.rows.filter((row) => row.eligibilityVerdict && isPublicBoardVisible(row.eligibilityVerdict))
  ).map((row, index) => ({
    ...row,
    rank: index + 1
  }));
}

function rankFor(row: NationalRankingRow, rankByPlayerId: Record<string, number>) {
  return rankByPlayerId[row.playerId] ?? row.rank;
}

function rankBandStart(rank: number) {
  if (rank <= 100) return rank;
  return Math.floor((rank - 101) / 50) * 50 + 101;
}

function alphabeticalBandOrder(
  left: NationalRankingRow,
  right: NationalRankingRow,
  rankByPlayerId: Record<string, number>,
  direction: 1 | -1
) {
  const leftRank = rankFor(left, rankByPlayerId);
  const rightRank = rankFor(right, rankByPlayerId);
  const bandDifference = rankBandStart(leftRank) - rankBandStart(rightRank);
  if (bandDifference !== 0) return bandDifference;

  return left.displayName.localeCompare(right.displayName) * direction || (leftRank - rightRank) * direction;
}

/** Keeps protected 101+ ratings from determining the public table order. */
export function sortPublicRankingRows(
  rows: NationalRankingRow[],
  rankByPlayerId: Record<string, number>,
  sortKey: RankingSortKey,
  sortDirection: SortDirection
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return rows.slice().sort((left, right) => {
    const leftRank = rankFor(left, rankByPlayerId);
    const rightRank = rankFor(right, rankByPlayerId);
    const leftIsBanded = leftRank > 100;
    const rightIsBanded = rightRank > 100;

    if (sortKey === "rank") {
      if (leftIsBanded && rightIsBanded) return alphabeticalBandOrder(left, right, rankByPlayerId, direction);
      if (leftIsBanded !== rightIsBanded) return (leftIsBanded ? 1 : -1) * direction;
      return (leftRank - rightRank) * direction;
    }
    if (sortKey === "rating" && (leftIsBanded || rightIsBanded)) {
      if (leftIsBanded && rightIsBanded) return alphabeticalBandOrder(left, right, rankByPlayerId, 1);
      return leftIsBanded ? 1 : -1;
    }

    if (sortKey === "athlete") return left.displayName.localeCompare(right.displayName) * direction || leftRank - rightRank;
    if (sortKey === "height") return ((left.heightCm ?? 0) - (right.heightCm ?? 0)) * direction || leftRank - rightRank;
    if (sortKey === "position") {
      const leftPosition = normalizePublicBoardPosition(left.position) ?? "NOT LISTED";
      const rightPosition = normalizePublicBoardPosition(right.position) ?? "NOT LISTED";
      return leftPosition.localeCompare(rightPosition) * direction || leftRank - rightRank;
    }

    return (left.rating - right.rating) * direction || leftRank - rightRank;
  });
}
