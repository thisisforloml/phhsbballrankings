import assert from "node:assert/strict";
import { test } from "node:test";

import { AgeGroup, PlayerGender } from "@prisma/client";

import {
  buildFormulaV3Ratings,
  competitionEvidenceWeight,
  computeAgeContextAdjustment,
  translateCompetitionScore
} from "./engine";
import { DEFAULT_FORMULA_V3_PARAMS } from "./params";
import { scoreIndependentGames } from "./scoring";
import type { FormulaV3IndependentGameScore, FormulaV3StatLine } from "./types";

function stat(overrides: Partial<FormulaV3StatLine> = {}): FormulaV3StatLine {
  return {
    gameStatId: "gs-1",
    gameId: "g-1",
    gameDate: new Date("2026-01-01T00:00:00Z"),
    seasonId: "season-1",
    leagueId: "league-1",
    leagueName: "UAAP U19 Boys",
    leagueTier: 1,
    leagueQualityScore: 100,
    competitionAgeLabel: "U19",
    competitionAgeGroup: AgeGroup.U19,
    ratingAgeGroup: AgeGroup.U19,
    playerAgeAtGame: 18,
    gender: PlayerGender.BOYS,
    playerId: "p-1",
    displayName: "Player One",
    teamId: "team-a",
    opponentTeamId: "team-b",
    minutes: 30,
    points: 15,
    fieldGoalsMade: 6,
    fieldGoalsAttempt: 12,
    threeMade: 1,
    threeAttempt: 3,
    freeThrowsMade: 2,
    freeThrowsAttempt: 2,
    offensiveRebounds: 1,
    defensiveRebounds: 4,
    rebounds: 5,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
    foulsDrawn: null,
    ...overrides
  };
}

function scored(overrides: Partial<FormulaV3IndependentGameScore>): FormulaV3IndependentGameScore {
  return {
    ...stat(overrides),
    rawGameValue: 0,
    baseScore: 50,
    advancedScore: 50,
    independentScore: 50,
    rateScore: 50,
    rateReliability: 1,
    stabilizedIndependentScore: overrides.stabilizedIndependentScore ?? overrides.independentScore ?? 50,
    ...overrides
  };
}

test("independent scoring stays valid when optional shooting inputs are absent", () => {
  const result = scoreIndependentGames([
    stat({ fieldGoalsMade: null, fieldGoalsAttempt: null, threeMade: null, threeAttempt: null, freeThrowsMade: null, freeThrowsAttempt: null })
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].advancedScore !== null, true);
  assert.equal(Number.isFinite(result.rows[0].independentScore), true);
  assert.equal(result.rows[0].independentScore >= 1 && result.rows[0].independentScore <= 100, true);
});

test("competition translation preserves tier 1 and limits weak-league ceilings", () => {
  assert.equal(translateCompetitionScore(90, 1), 90);
  assert.equal(translateCompetitionScore(100, 2), 96);
  assert.equal(translateCompetitionScore(100, 3), 87);
  assert.equal(translateCompetitionScore(100, 4), 77);
});

test("weaker competitions contribute less effective evidence", () => {
  assert.equal(competitionEvidenceWeight(1), 1);
  assert.equal(competitionEvidenceWeight(4), 0.4);
});

test("play-up context is reported without adding direct age bonus points", () => {
  const early = computeAgeContextAdjustment(16, "U19", 0);
  const connected = computeAgeContextAdjustment(16, "U19", 1);
  assert.deepEqual(early, { playingUpYears: 3, adjustment: 0 });
  assert.deepEqual(connected, { playingUpYears: 3, adjustment: 0 });
  assert.deepEqual(computeAgeContextAdjustment(17, "U18", 0), {
    playingUpYears: 0,
    adjustment: 0
  });
});

test("very low minutes do not activate per-minute percentile scoring", () => {
  const result = scoreIndependentGames([
    stat({ playerId: "short", minutes: 5, points: 10 }),
    stat({ playerId: "full", gameStatId: "gs-2", minutes: 30, points: 10 })
  ]);
  assert.equal(result.rows.find((row) => row.playerId === "short")?.rateScore, null);
  assert.equal(result.rows.find((row) => row.playerId === "short")?.rateReliability, 0);
});

test("first game uses neutral context and cannot leak same-game performance", () => {
  const rows = [
    scored({ playerId: "a1", gameStatId: "a1-g1", teamId: "a", opponentTeamId: "b", independentScore: 95 }),
    scored({ playerId: "a2", gameStatId: "a2-g1", teamId: "a", opponentTeamId: "b", independentScore: 80 }),
    scored({ playerId: "b1", gameStatId: "b1-g1", teamId: "b", opponentTeamId: "a", independentScore: 20 }),
    scored({ playerId: "b2", gameStatId: "b2-g1", teamId: "b", opponentTeamId: "a", independentScore: 30 })
  ];
  const result = buildFormulaV3Ratings(rows, new Date("2026-02-01T00:00:00Z"));
  for (const game of result.games) {
    assert.equal(game.opponentLineupRating, 50);
    assert.equal(game.opponentTeamRating, 50);
    assert.equal(game.teammateLineupRating, 50);
    assert.equal(game.ownTeamRating, 50);
    assert.equal(game.totalContextAdjustment, 0);
  }
});

test("pregame opponent and teammate strength move later games in the intended direction", () => {
  const first = [
    scored({ playerId: "a1", gameStatId: "a1-g1", teamId: "a", opponentTeamId: "b", independentScore: 95 }),
    scored({ playerId: "a2", gameStatId: "a2-g1", teamId: "a", opponentTeamId: "b", independentScore: 85 }),
    scored({ playerId: "b1", gameStatId: "b1-g1", teamId: "b", opponentTeamId: "a", independentScore: 20 }),
    scored({ playerId: "b2", gameStatId: "b2-g1", teamId: "b", opponentTeamId: "a", independentScore: 30 })
  ];
  const secondDate = new Date("2026-01-10T00:00:00Z");
  const second = [
    scored({ gameId: "g-2", gameDate: secondDate, playerId: "a1", gameStatId: "a1-g2", teamId: "a", opponentTeamId: "b" }),
    scored({ gameId: "g-2", gameDate: secondDate, playerId: "a2", gameStatId: "a2-g2", teamId: "a", opponentTeamId: "b" }),
    scored({ gameId: "g-2", gameDate: secondDate, playerId: "b1", gameStatId: "b1-g2", teamId: "b", opponentTeamId: "a" }),
    scored({ gameId: "g-2", gameDate: secondDate, playerId: "b2", gameStatId: "b2-g2", teamId: "b", opponentTeamId: "a" })
  ];
  const result = buildFormulaV3Ratings([...first, ...second], new Date("2026-02-01T00:00:00Z"));
  const strongTeamPlayer = result.games.find((row) => row.gameId === "g-2" && row.playerId === "a1")!;
  const weakTeamPlayer = result.games.find((row) => row.gameId === "g-2" && row.playerId === "b1")!;
  assert.equal(strongTeamPlayer.totalContextAdjustment < 0, true);
  assert.equal(weakTeamPlayer.totalContextAdjustment > 0, true);
});

test("displayed Formula v3 rating uses recency weighting without Bayesian shrinkage", () => {
  const result = buildFormulaV3Ratings([
    scored({ independentScore: 80 }),
    scored({ gameId: "g-2", gameStatId: "gs-2", gameDate: new Date("2026-01-20T00:00:00Z"), independentScore: 90 })
  ], new Date("2026-02-01T00:00:00Z"));
  assert.equal(result.ratings.length, 1);
  assert.equal(result.ratings[0].verifiedGameCount, 2);
  assert.equal(result.ratings[0].adjustedRating > 80, true);
  assert.equal(result.ratings[0].confidence, "PROVISIONAL");
});

test("strong ratings remain continuous and are reduced by measured uncertainty, not a hard cap", () => {
  const rows = Array.from({ length: 10 }, (_, index) =>
    scored({
      gameStatId: "continuous-stat-" + index,
      gameId: "continuous-game-" + index,
      gameDate: new Date("2026-01-" + String(index + 1).padStart(2, "0") + "T00:00:00.000Z"),
      independentScore: 98,
      stabilizedIndependentScore: 98
    })
  );
  const rating = buildFormulaV3Ratings(
    rows,
    new Date("2026-02-01T00:00:00.000Z"),
    { ...DEFAULT_FORMULA_V3_PARAMS, uncertaintyPenaltyFactor: 0.5 }
  ).ratings[0];
  assert.equal(rating.estimatedRating > rating.adjustedRating, true);
  assert.equal(rating.adjustedRating > 90, true);
  assert.notEqual(rating.adjustedRating, 89.99);
  assert.equal(rating.starRating, 5);
});
