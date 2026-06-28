import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPendingEligibilityExpired,
  PENDING_POLICY_EFFECTIVE_DATE,
  satisfiesPendingPublicPath
} from "@/lib/eligibility/pending-public-policy";
import { buildEligibilityInput } from "@/lib/eligibility";

describe("pending-public-policy", () => {
  it("uses policy effective date when firstRankingEligibilityAt is missing", () => {
    const evaluationDate = new Date(PENDING_POLICY_EFFECTIVE_DATE);
    evaluationDate.setUTCDate(evaluationDate.getUTCDate() + 366);

    assert.equal(isPendingEligibilityExpired(null, evaluationDate), true);
  });

  it("allows pending path when threshold and board alignment are satisfied", () => {
    const input = buildEligibilityInput({
      playerId: "player-1",
      gender: "Boys",
      birthDate: null,
      firstRankingEligibilityAt: new Date(Date.UTC(2026, 0, 1)),
      ratingAgeGroup: "U19",
      verifiedGameCount: 10,
      evaluatedBoard: "U19"
    });

    assert.equal(
      satisfiesPendingPublicPath(input, new Date(Date.UTC(2026, 5, 1)), 10, "launch-v1"),
      true
    );
  });
});
