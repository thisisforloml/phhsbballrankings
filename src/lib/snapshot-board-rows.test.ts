import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEligibilityInput,
  evaluateEligibility,
  isPublicBoardVisible
} from "@/lib/eligibility";
import { isSnapshotBoardVisible } from "@/lib/snapshot-board-rows";

describe("snapshot-board-rows contract", () => {
  it("uses publicRankAllowed as the snapshot visibility gate", () => {
    const pending = evaluateEligibility(
      buildEligibilityInput({
        playerId: "player-1",
        gender: "Girls",
        birthDate: null,
        firstRankingEligibilityAt: new Date(Date.UTC(2026, 0, 1)),
        ratingAgeGroup: "U19",
        verifiedGameCount: 5,
        evaluatedBoard: "U19"
      })
    );

    assert.equal(isSnapshotBoardVisible(pending), isPublicBoardVisible(pending));
    assert.equal(isSnapshotBoardVisible(pending), true);
    assert.equal(pending.ageVerificationStatus, "PENDING");
  });

  it("excludes hidden players from snapshot visibility", () => {
    const hidden = evaluateEligibility(
      buildEligibilityInput({
        playerId: "player-2",
        gender: "Boys",
        birthDate: null,
        dobEscalationTier: 2,
        ratingAgeGroup: "U19",
        verifiedGameCount: 12,
        evaluatedBoard: "U19"
      })
    );

    assert.equal(isSnapshotBoardVisible(hidden), false);
  });
});
