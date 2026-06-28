export type PublicCoverageAgeGroup = "U13" | "U16" | "U19";

export const PUBLIC_AGE_GROUPS: PublicCoverageAgeGroup[] = ["U13", "U16", "U19"];

export function isPlannedPublicAgeGroup(age: PublicCoverageAgeGroup): boolean {
  return age === "U13" || age === "U16";
}

export const publicRankingsCoverageCopy = {
  launchLabel: "Current national board coverage is U19 Boys and U19 Girls.",
  plannedLabel: "U13 and U16 boards are planned and will open as verified game volume grows.",
  plannedBoardTitle(ageGroup: PublicCoverageAgeGroup) {
    return `${ageGroup} National Board — Coming Soon`;
  },
  plannedBoardDescription:
    "We are building verified game coverage for this age group. National boards launch when enough official games and eligibility records are in the system.",
  verifiedLabel: "Rankings are built from verified official games.",
  sparseBoard(ageGroup: PublicCoverageAgeGroup, gender: string, count: number) {
    return `${ageGroup} ${gender} national board has ${count} publicly ranked player${count === 1 ? "" : "s"} so far. The board grows as more verified official games and player eligibility records are added.`;
  },
  emptyBoardTitle: "No publicly ranked players on this board yet",
  emptyBoardDescription:
    "Players appear here once they meet verified-game thresholds and public eligibility requirements for this age group and gender.",
  recruitingHelper:
    "Recruiting view filters the U19 national board by graduation class. Rank order and rank numbers reflect the full U19 national board, not rank within class.",
  recruitingClassFilterActive:
    "U19 National Rank shows where each player ranks on the complete U19 board.",
  recruitingUnknownClass:
    "Players without a class year on file are excluded from class filters unless you include them."
} as const;

export const RECRUITING_CLASS_FILTER_ENABLED =
  process.env.NEXT_PUBLIC_RECRUITING_CLASS_FILTER_ENABLED === "true" ||
  process.env.NODE_ENV === "development";

export type PublicTrustMeta = {
  lastUpdated: string | null;
};
