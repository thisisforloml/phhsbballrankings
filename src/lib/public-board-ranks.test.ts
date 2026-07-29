import assert from "node:assert/strict";
import test from "node:test";

import { sortPublicRankingRows } from "./public-board-ranks";
import type { NationalRankingRow } from "./rankings";

function row(playerId: string, displayName: string, rank: number, rating: number): NationalRankingRow {
  return {
    rank, playerId, displayName, slug: playerId, city: "", region: "", position: null, heightCm: null,
    birthYear: null, age: null, currentTeam: "", photoUrl: null, gender: "Boys", ageGroup: "U19",
    computedAgeBracket: "U19", effectiveClassYear: null, classYearLabel: null, eligibilityVerdict: {} as NationalRankingRow["eligibilityVerdict"],
    rating, starRating: 3, verifiedGameCount: 10, primaryCompetition: null,
  };
}

test("keeps public rank bands ordered and alphabetizes each band", () => {
  const rows = [
    row("p201", "Zane Two Hundred", 201, 62), row("p102", "Zara One Hundred", 102, 68),
    row("p101", "Aaron One Hundred", 101, 69), row("p151", "Mika One Hundred", 151, 65),
    row("p152", "Adam One Hundred", 152, 64),
  ];
  const ranks = Object.fromEntries(rows.map((item) => [item.playerId, item.rank]));
  assert.deepEqual(sortPublicRankingRows(rows, ranks, "rank", "asc").map((item) => item.playerId), ["p101", "p102", "p152", "p151", "p201"]);
});

test("does not use hidden numeric ratings to order banded rows", () => {
  const rows = [row("p102", "Zara", 102, 99), row("p101", "Aaron", 101, 10)];
  const ranks = Object.fromEntries(rows.map((item) => [item.playerId, item.rank]));
  assert.deepEqual(sortPublicRankingRows(rows, ranks, "rating", "desc").map((item) => item.playerId), ["p101", "p102"]);
});