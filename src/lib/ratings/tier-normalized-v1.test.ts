import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateTierNormalizedRating,
  TIER_NORMALIZED_SOFT_WEIGHTS,
  tierNormalizedGameScore} from "@/lib/ratings/tier-normalized-v1";

describe("tier-normalized-v1", () => {
  it("discounts lower-tier games without inflating tier-1 scores", () => {
    assert.equal(tierNormalizedGameScore(90, 1), 90);
    assert.equal(tierNormalizedGameScore(90, 3), 83.7);
  });

  it("aggregates tier-normalized means for mixed exposure", () => {
    const aggregate = aggregateTierNormalizedRating([
      { playerId: "a", ageGroup: "U19", leagueTier: 1, finalScore: 90 },
      { playerId: "a", ageGroup: "U19", leagueTier: 3, finalScore: 100 }
    ]);
    assert.ok(aggregate);
    assert.equal(aggregate.verifiedGameCount, 2);
    assert.equal(aggregate.observedRating, 91.5);
  });

  it("caps normalized game scores at 100", () => {
    const score = tierNormalizedGameScore(99, 1, TIER_NORMALIZED_SOFT_WEIGHTS);
    assert.equal(score, 99);
  });
});
