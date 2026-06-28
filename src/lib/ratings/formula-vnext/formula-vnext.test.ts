import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjustGameScore, buildShadowRatings } from "@/lib/ratings/formula-vnext/accumulation";
import { deriveEvidenceRole, opponentFactor, ageFactor } from "@/lib/ratings/formula-vnext/context-factors";
import { DEFAULT_FORMULA_VNEXT_PARAMS } from "@/lib/ratings/formula-vnext/params";
import type { LoadedGameEvidence } from "@/lib/ratings/formula-vnext/types";
import { AgeGroup, PlayerGender } from "@prisma/client";

function baseEvidence(overrides: Partial<LoadedGameEvidence> = {}): LoadedGameEvidence {
  return {
    gameStatId: "gs-1",
    gameId: "g-1",
    gameDate: new Date(Date.UTC(2026, 5, 1)),
    playerId: "p-1",
    displayName: "Test Player",
    gender: PlayerGender.BOYS,
    birthDate: new Date(Date.UTC(2009, 5, 23)),
    classYearOverride: null,
    competitionAgeGroup: AgeGroup.U19,
    homeBracket: "U16",
    evidenceRole: "PLAYING_UP",
    baseGameScore: 84,
    leagueTier: 2,
    opponentProgramRating: 55,
    teamMateAvgBaseScore: 70,
    playerPriorRating: 80,
    effectiveFieldGoalPct: 0.52,
    trueShootingPct: 0.58,
    playerEfficiencyRating: 16,
    winShares: 0.1,
    pie: 0.12,
    ...overrides
  };
}

describe("formula-vnext context factors", () => {
  it("derives playing up when home bracket is below competition", () => {
    assert.equal(deriveEvidenceRole("U16", AgeGroup.U19), "PLAYING_UP");
    assert.equal(deriveEvidenceRole("U19", AgeGroup.U19), "HOME");
  });

  it("boosts opponent factor for stronger opponents", () => {
    const weak = opponentFactor(40, DEFAULT_FORMULA_VNEXT_PARAMS);
    const strong = opponentFactor(60, DEFAULT_FORMULA_VNEXT_PARAMS);
    assert.ok(strong > weak);
  });

  it("applies playing-up age factor above 1", () => {
    assert.ok(ageFactor("PLAYING_UP", DEFAULT_FORMULA_VNEXT_PARAMS) > 1);
    assert.equal(ageFactor("HOME", DEFAULT_FORMULA_VNEXT_PARAMS), 1);
  });
});

describe("formula-vnext accumulation", () => {
  it("adjusts playing-up games above base score", () => {
    const adjusted = adjustGameScore(baseEvidence(), DEFAULT_FORMULA_VNEXT_PARAMS, new Date());
    assert.ok(adjusted.adjustedGameScore >= adjusted.baseGameScore);
    assert.equal(adjusted.ageFactor, DEFAULT_FORMULA_VNEXT_PARAMS.playingUpPerYear + 1);
  });

  it("builds home-board ratings for playing-up evidence", () => {
    const ratings = buildShadowRatings([baseEvidence()], DEFAULT_FORMULA_VNEXT_PARAMS, new Date());
    assert.equal(ratings.length, 1);
    assert.equal(ratings[0].homeBracket, "U16");
    assert.equal(ratings[0].ratingBasis, "PROJECTED");
    assert.equal(ratings[0].verifiedGameCount, 1);
  });
});
