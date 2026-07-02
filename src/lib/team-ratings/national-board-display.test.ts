import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgeGroup, PlayerGender } from "@prisma/client";

import type { NationalTeamRatingRow } from "@/lib/team-ratings/get-national-team-rankings";
import {
  buildNationalBoardRankByProgramId,
  sortNationalBoardRows
} from "@/lib/team-ratings/national-board-display";

function row(overrides: Partial<NationalTeamRatingRow> & Pick<NationalTeamRatingRow, "programId" | "programName" | "rating">): NationalTeamRatingRow {
  return {
    programAbbreviation: null,
    city: "Manila",
    region: "NCR",
    teamId: null,
    ageGroup: AgeGroup.U16,
    gender: PlayerGender.BOYS,
    genderLabel: "Boys",
    verifiedGameCount: 10,
    verifiedOpponentCount: 5,
    rank: 1,
    publicBoardEligible: true,
    formulaVersion: "TPI-v1",
    computedAt: "2026-06-17T00:00:00.000Z",
    ...overrides,
    id: overrides.id ?? overrides.programId,
    programId: overrides.programId,
    programName: overrides.programName,
    rating: overrides.rating
  };
}

describe("national board display ranks", () => {
  const scope = [
    row({ programId: "a", programName: "Alpha", rating: 90, rank: 1 }),
    row({ programId: "b", programName: "Beta", rating: 80, rank: 2 }),
    row({ programId: "c", programName: "Gamma", rating: 70, rank: 3 })
  ];

  it("keeps canonical board rank after search filter", () => {
    const boardRankByProgramId = buildNationalBoardRankByProgramId(scope);
    const filtered = scope.filter((item) => item.programId !== "b");
    const visible = sortNationalBoardRows(filtered, boardRankByProgramId, "rank", "asc");

    assert.deepEqual(
      visible.map((item) => ({ programId: item.programId, visibleRank: item.visibleRank })),
      [{ programId: "a", visibleRank: 1 }, { programId: "c", visibleRank: 3 }]
    );
  });

  it("keeps canonical board rank when sorting by rating", () => {
    const boardRankByProgramId = buildNationalBoardRankByProgramId(scope);
    const visible = sortNationalBoardRows(scope, boardRankByProgramId, "rating", "desc");

    assert.deepEqual(visible.map((item) => item.visibleRank), [1, 2, 3]);
  });

  it("sorts by rating without renumbering canonical ranks", () => {
    const boardRankByProgramId = buildNationalBoardRankByProgramId(scope);
    const visible = sortNationalBoardRows(scope, boardRankByProgramId, "rating", "asc");

    assert.deepEqual(
      visible.map((item) => ({ programId: item.programId, visibleRank: item.visibleRank })),
      [{ programId: "c", visibleRank: 3 }, { programId: "b", visibleRank: 2 }, { programId: "a", visibleRank: 1 }]
    );
  });
});
