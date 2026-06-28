import type { NationalTeamRatingRow } from "./get-national-team-rankings";

export type NationalSortKey = "rank" | "program" | "rating" | "games" | "opponents";
export type SortDirection = "asc" | "desc";

export type NationalRowWithVisibleRank = NationalTeamRatingRow & { visibleRank: number };

function canonicalBoardOrder(left: NationalTeamRatingRow, right: NationalTeamRatingRow) {
  return (
    right.rating - left.rating
    || right.verifiedGameCount - left.verifiedGameCount
    || left.programName.localeCompare(right.programName)
  );
}

/** Canonical national-board rank for the full scope (matches player rankings `boardRankByPlayerId`). */
export function buildNationalBoardRankByProgramId(rows: NationalTeamRatingRow[]): Record<string, number> {
  const ordered = [...rows].sort(canonicalBoardOrder);
  return Object.fromEntries(ordered.map((row, index) => [row.programId, index + 1]));
}

export function sortNationalBoardRows(
  rows: NationalTeamRatingRow[],
  boardRankByProgramId: Record<string, number>,
  sortKey: NationalSortKey,
  sortDirection: SortDirection
): NationalRowWithVisibleRank[] {
  const boardRank = (row: NationalTeamRatingRow) => boardRankByProgramId[row.programId] ?? row.rank;
  const direction = sortDirection === "asc" ? 1 : -1;

  return rows
    .slice()
    .sort((left, right) => {
      if (sortKey === "rank") return (boardRank(left) - boardRank(right)) * direction;
      if (sortKey === "program") {
        return left.programName.localeCompare(right.programName) * direction || boardRank(left) - boardRank(right);
      }
      if (sortKey === "rating") {
        return (left.rating - right.rating) * direction || boardRank(left) - boardRank(right);
      }
      if (sortKey === "games") {
        return (left.verifiedGameCount - right.verifiedGameCount) * direction || boardRank(left) - boardRank(right);
      }
      return (left.verifiedOpponentCount - right.verifiedOpponentCount) * direction || boardRank(left) - boardRank(right);
    })
    .map((row, index) => ({
      ...row,
      visibleRank: boardRankByProgramId[row.programId] ?? index + 1
    }));
}
