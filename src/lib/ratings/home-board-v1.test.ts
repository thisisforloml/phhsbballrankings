import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AgeGroup } from "@prisma/client";
import { buildProjectedV1HomeTarget, isPlayingUp } from "@/lib/ratings/home-board-v1";
import { selectPublicPlayerRating } from "@/lib/ratings/resolve-public-player-rating";
import { FORMULA_V1_POLICY_ID } from "@/lib/ratings/formula-constants";

describe("home-board v1", () => {
  it("detects playing up from calendar home bracket", () => {
    assert.equal(isPlayingUp("U16", AgeGroup.U19), true);
    assert.equal(isPlayingUp("U19", AgeGroup.U19), false);
    assert.equal(isPlayingUp(null, AgeGroup.U19), false);
  });

  it("projects v1 cumulative ratings without uplift", () => {
    const target = buildProjectedV1HomeTarget({
      playerId: "player-1",
      homeBracket: AgeGroup.U16,
      gpsCount: 15,
      avgFinalScore: 84.13
    });
    assert.equal(target.ageGroup, AgeGroup.U16);
    assert.equal(target.adjustedRating, 84.13);
    assert.equal(target.starRating, 4);
  });

  it("prefers home-board production rating when DOB is known", () => {
    const selected = selectPublicPlayerRating({
      birthDate: new Date(Date.UTC(2009, 5, 23)),
      classYearOverride: null,
      currentRatings: [
        {
          ageGroup: AgeGroup.U19,
          adjustedRating: 84.13 as never,
          verifiedGameCount: 15,
          policyVersionId: FORMULA_V1_POLICY_ID,
          ratingBasis: "DIRECT",
          observedRating: 84.13 as never,
          starRating: 4
        },
        {
          ageGroup: AgeGroup.U16,
          adjustedRating: 84.13 as never,
          verifiedGameCount: 15,
          policyVersionId: FORMULA_V1_POLICY_ID,
          ratingBasis: "PROJECTED_V1",
          observedRating: 84.13 as never,
          starRating: 4
        }
      ],
      gameStats: [{ game: { season: { league: { ageGroup: AgeGroup.U19 } } } }]
    });
    assert.equal(selected?.ageGroup, AgeGroup.U16);
  });
});
