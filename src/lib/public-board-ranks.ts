import { isPublicBoardVisible } from "@/lib/eligibility";

import type { NationalRankingRow, NationalRankingSnapshot } from "./rankings";

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
