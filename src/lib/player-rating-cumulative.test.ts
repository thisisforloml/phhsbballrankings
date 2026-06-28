import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgeGroup } from "@prisma/client";
import {
  buildCumulativePlayerRatingTarget,
  roundRating,
  starFromAdjustedRating
} from "@/lib/player-rating-cumulative";

describe("player-rating-cumulative", () => {
  it("maps Formula v1 star bands from adjusted rating", () => {
    assert.equal(starFromAdjustedRating(59.9), 1);
    assert.equal(starFromAdjustedRating(60), 2);
    assert.equal(starFromAdjustedRating(79.9), 3);
    assert.equal(starFromAdjustedRating(89.9), 4);
    assert.equal(starFromAdjustedRating(90), 5);
  });

  it("builds cumulative targets from age-group GPS aggregates", () => {
    const target = buildCumulativePlayerRatingTarget({
      playerId: "player-1",
      ageGroup: AgeGroup.U19,
      gpsCount: 12,
      avgFinalScore: 72.3456
    });

    assert.equal(target.playerId, "player-1");
    assert.equal(target.ageGroup, AgeGroup.U19);
    assert.equal(target.observedRating, 72.35);
    assert.equal(target.adjustedRating, 72.35);
    assert.equal(target.verifiedGameCount, 12);
    assert.equal(target.starRating, 3);
  });

  it("uses cumulative game count rather than season count", () => {
    const seasonOnly = buildCumulativePlayerRatingTarget({
      playerId: "player-2",
      ageGroup: AgeGroup.U19,
      gpsCount: 3,
      avgFinalScore: 85
    });
    const cumulative = buildCumulativePlayerRatingTarget({
      playerId: "player-2",
      ageGroup: AgeGroup.U19,
      gpsCount: 25,
      avgFinalScore: 67.72
    });

    assert.equal(seasonOnly.verifiedGameCount, 3);
    assert.equal(cumulative.verifiedGameCount, 25);
    assert.notEqual(seasonOnly.adjustedRating, cumulative.adjustedRating);
  });

  it("rounds ratings to two decimal places", () => {
    assert.equal(roundRating(40.567), 40.57);
    assert.equal(roundRating(40.564), 40.56);
  });
});
