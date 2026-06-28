import type { TeamStandingsAgeGroup, TeamStandingsGender } from "@/lib/team-rankings";

export const nationalTeamBoardCoverageCopy = {
  sparseBoard(count: number, ageGroup: TeamStandingsAgeGroup, gender: TeamStandingsGender) {
    return `${ageGroup} ${gender} national board has ${count} public-eligible program${count === 1 ? "" : "s"} so far. Rankings expand as more verified official games are imported.`;
  },
  emptyBoard(ageGroup: TeamStandingsAgeGroup, gender: TeamStandingsGender) {
    if (gender === "Girls" && (ageGroup === "U13" || ageGroup === "U16")) {
      return {
        title: `${ageGroup} Girls national board is not live yet`,
        description:
          "Girls national team rankings for U13 and U16 will appear here once verified official games and eligibility thresholds are met. Try Competition view or another age group."
      };
    }

    if (gender === "Girls" && ageGroup === "U19") {
      return {
        title: "Limited U19 Girls national coverage",
        description:
          "Only a small set of programs currently meets the public eligibility threshold. Rankings will grow as more verified games are added."
      };
    }

    return {
      title: "No national team rankings for this board",
      description:
        "No programs on this board meet the public eligibility threshold yet. Switch age group, try Competition view, or check back after more verified games are imported."
    };
  }
} as const;
