import assert from "node:assert/strict";
import { test } from "node:test";

import { AgeGroup, PlayerGender } from "@prisma/client";

import { buildCompetitionStrengthProfile } from "../ratings/competition-strength-v1";
import { computeTeamTpiV2, type TeamTpiV2GameInput } from "./team-tpi-v2";

function profile(tier = 1) {
  return buildCompetitionStrengthProfile({
    poolKey: "pool",
    leagueId: "league",
    seasonId: "season",
    label: "League",
    tier,
    qualityScore: 0,
    gameCount: 20,
    teamCount: 6,
    playerCount: 70,
    crossoverPlayerCount: 8,
    independentPlayerRatings: [45, 50, 55, 60, 70],
    teamPerformanceRatings: [45, 50, 55, 60, 65],
    crossoverDeltas: [0]
  });
}

function game(overrides: Partial<TeamTpiV2GameInput> = {}): TeamTpiV2GameInput {
  return {
    gameId: "g1",
    gameDate: new Date("2026-01-01T00:00:00Z"),
    poolKey: "pool",
    ageGroup: AgeGroup.U19,
    gender: PlayerGender.BOYS,
    homeTeamId: "a",
    awayTeamId: "b",
    homeTeamName: "A",
    awayTeamName: "B",
    homeScore: 80,
    awayScore: 70,
    homePossessions: 70,
    awayPossessions: 70,
    homeRosterStrength: 65,
    awayRosterStrength: 50,
    ...overrides
  };
}

test("winner rates above loser while actual team identities remain separate", () => {
  const rows = computeTeamTpiV2([game()], new Map([["pool", profile()]]), new Date("2026-02-01T00:00:00Z"));
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.teamId === "a")!.rating > rows.find((row) => row.teamId === "b")!.rating, true);
});

test("stronger competition rewards the same result more than weaker competition", () => {
  const strong = computeTeamTpiV2([game()], new Map([["pool", profile(1)]]), new Date("2026-02-01T00:00:00Z"));
  const weak = computeTeamTpiV2([game()], new Map([["pool", profile(4)]]), new Date("2026-02-01T00:00:00Z"));
  assert.equal(strong.find((row) => row.teamId === "a")!.rating > weak.find((row) => row.teamId === "a")!.rating, true);
});

test("configured iteration count affects opponent-adjusted propagation", () => {
  const games = [
    game(),
    game({ gameId: "g2", homeTeamId: "b", awayTeamId: "c", homeTeamName: "B", awayTeamName: "C", homeScore: 80, awayScore: 60 })
  ];
  const one = computeTeamTpiV2(games, new Map([["pool", profile()]]), new Date("2026-02-01T00:00:00Z"), {
    iterations: 1,
    halfLifeDays: 180,
    recencyFloor: 0.45,
    shrinkageGames: 6,
    rosterWeightMax: 0.2,
    marginScale: 3.5,
    marginCap: 18,
    opponentAdjustmentMax: 8,
    competitionAdjustmentMax: 6
  });
  const six = computeTeamTpiV2(games, new Map([["pool", profile()]]), new Date("2026-02-01T00:00:00Z"));
  assert.notEqual(one.find((row) => row.teamId === "a")!.observedRating, six.find((row) => row.teamId === "a")!.observedRating);
});
