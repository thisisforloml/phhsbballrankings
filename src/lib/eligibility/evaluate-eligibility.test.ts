import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEligibilityInput,
  type EligibilityInput,
  evaluateEligibility,
  isPublicBoardRanked,
  isPublicBoardVisible,
  LAUNCH_POLICY_V1_ID,
  shouldShowAgeUnverifiedBadge} from "@/lib/eligibility";

function baseInput(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    playerId: "player-1",
    gender: "Boys",
    birthDate: new Date(Date.UTC(2008, 8, 15)),
    ratingAgeGroup: "U19",
    verifiedGameCount: 10,
    hasTargetBoardRating: true,
    evaluatedBoard: "U19",
    policyVersionId: LAUNCH_POLICY_V1_ID,
    ...overrides
  };
}

describe("evaluateEligibility", () => {
  it("T-P7-01: boys below launch threshold are provisional", () => {
    const verdict = evaluateEligibility(baseInput({ verifiedGameCount: 9, gamesQualified: 9 }));

    assert.equal(verdict.verdict, "PROVISIONAL");
    assert.equal(verdict.provisionalReason, "BELOW_THRESHOLD");
    assert.equal(verdict.publicRankAllowed, false);
    assert.equal(verdict.precedenceRule, "P7");
  });

  it("T-P7-02: girls below launch threshold are provisional", () => {
    const verdict = evaluateEligibility(
      baseInput({ gender: "Girls", verifiedGameCount: 4, gamesQualified: 4 })
    );

    assert.equal(verdict.verdict, "PROVISIONAL");
    assert.equal(verdict.provisionalReason, "BELOW_THRESHOLD");
    assert.equal(verdict.publicRankAllowed, false);
  });

  it("T-P9-01: boys at launch threshold are ranked on the public board", () => {
    const verdict = evaluateEligibility(baseInput({ verifiedGameCount: 10, gamesQualified: 10 }));

    assert.equal(verdict.verdict, "RANKED");
    assert.equal(verdict.ageVerificationStatus, "VERIFIED");
    assert.equal(verdict.publicRankAllowed, true);
    assert.equal(verdict.snapshotEligible, true);
    assert.equal(verdict.precedenceRule, "P9");
    assert.equal(verdict.matureEligible, false);
  });

  it("T-P10-01: players at mature threshold are ranked with matureEligible", () => {
    const verdict = evaluateEligibility(baseInput({ verifiedGameCount: 15, gamesQualified: 15 }));

    assert.equal(verdict.verdict, "RANKED");
    assert.equal(verdict.publicRankAllowed, true);
    assert.equal(verdict.matureEligible, true);
    assert.equal(verdict.precedenceRule, "P10");
  });

  it("P1: administratively inactive players are hidden", () => {
    const verdict = evaluateEligibility(baseInput({ rankingInactive: true }));

    assert.equal(verdict.verdict, "HIDDEN");
    assert.equal(verdict.exclusionReason, "RANKING_INACTIVE");
    assert.equal(verdict.precedenceRule, "P1");
  });

  it("P5: frozen former verdict stays former", () => {
    const verdict = evaluateEligibility(baseInput({ frozenVerdict: "FORMER" }));

    assert.equal(verdict.verdict, "FORMER");
    assert.equal(verdict.exclusionReason, "GRADUATED");
    assert.equal(verdict.precedenceRule, "P5");
  });

  it("P2: graduated U19 class year players are former", () => {
    const verdict = evaluateEligibility(
      baseInput({
        classYearOverride: 2024,
        evaluationDate: new Date(Date.UTC(2024, 5, 15))
      })
    );

    assert.equal(verdict.verdict, "FORMER");
    assert.equal(verdict.classYearStatus, "GRADUATED");
    assert.equal(verdict.precedenceRule, "P2");
  });

  it("P3 calendar-age: bracket follows birthday, not March 31 season lock", () => {
    const dayBefore17 = evaluateEligibility(
      baseInput({
        birthDate: new Date(Date.UTC(2009, 5, 23)),
        evaluationDate: new Date(Date.UTC(2026, 5, 22)),
        evaluatedBoard: "U19",
        ratingAgeGroup: "U19",
        verifiedGameCount: 15,
        gamesQualified: 15
      })
    );

    assert.equal(dayBefore17.verdict, "HIDDEN");
    assert.equal(dayBefore17.exclusionReason, "OUT_OF_BRACKET");
    assert.equal(dayBefore17.competitionAgeGroup, "U16");

    const on17thBirthday = evaluateEligibility(
      baseInput({
        birthDate: new Date(Date.UTC(2009, 5, 23)),
        evaluationDate: new Date(Date.UTC(2026, 5, 23)),
        evaluatedBoard: "U19",
        ratingAgeGroup: "U19",
        verifiedGameCount: 15,
        gamesQualified: 15
      })
    );

    assert.equal(on17thBirthday.verdict, "RANKED");
    assert.equal(on17thBirthday.competitionAgeGroup, "U19");
    assert.equal(on17thBirthday.publicRankAllowed, true);
  });

  it("P3: out-of-bracket players are hidden", () => {
    const verdict = evaluateEligibility(
      baseInput({
        birthDate: new Date(Date.UTC(2015, 0, 1)),
        evaluationDate: new Date(Date.UTC(2026, 0, 1))
      })
    );

    assert.equal(verdict.verdict, "HIDDEN");
    assert.equal(verdict.exclusionReason, "OUT_OF_BRACKET");
    assert.equal(verdict.precedenceRule, "P3");
  });

  it("P6: zero verified games are hidden", () => {
    const verdict = evaluateEligibility(baseInput({ verifiedGameCount: 0, gamesQualified: 0 }));

    assert.equal(verdict.verdict, "HIDDEN");
    assert.equal(verdict.exclusionReason, "ZERO_GAMES");
    assert.equal(verdict.precedenceRule, "P6");
  });

  it("P8: missing target-board rating basis is hidden", () => {
    const verdict = evaluateEligibility(baseInput({ hasTargetBoardRating: false }));

    assert.equal(verdict.verdict, "HIDDEN");
    assert.equal(verdict.exclusionReason, "NO_RATING_BASIS");
    assert.equal(verdict.precedenceRule, "P8");
  });

  it("T-P11-01: unknown DOB with untrusted competition is hidden", () => {
    const verdict = evaluateEligibility(
      baseInput({
        birthDate: null,
        competitionTrustLevel: "UNTRUSTED",
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(verdict.verdict, "HIDDEN");
    assert.equal(verdict.exclusionReason, "UNTRUSTED_UNKNOWN_DOB");
    assert.equal(verdict.precedenceRule, "P11");
  });

  it("T-P13-01: escalated unknown DOB stays hidden", () => {
    const verdict = evaluateEligibility(
      baseInput({
        birthDate: null,
        dobEscalationTier: 2,
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(verdict.verdict, "HIDDEN");
    assert.equal(verdict.exclusionReason, "UNTRUSTED_UNKNOWN_DOB");
    assert.equal(verdict.precedenceRule, "P13");
  });

  it("T-P12-01: unknown DOB at threshold is pending on live board and snapshot-visible", () => {
    const verdict = evaluateEligibility(
      baseInput({
        birthDate: null,
        firstRankingEligibilityAt: new Date(Date.UTC(2026, 0, 1)),
        evaluatedBoard: "U16",
        ratingAgeGroup: "U16",
        verifiedGameCount: 10,
        gamesQualified: 10,
        competitionTrustLevel: "STANDARD"
      })
    );

    assert.equal(verdict.verdict, "PROVISIONAL");
    assert.equal(verdict.provisionalReason, "UNKNOWN_DOB");
    assert.equal(verdict.ageVerificationStatus, "PENDING");
    assert.equal(verdict.publicRankAllowed, true);
    assert.equal(verdict.snapshotEligible, true);
    assert.equal(verdict.precedenceRule, "P12");
    assert.equal(shouldShowAgeUnverifiedBadge(verdict), true);
  });

  it("T-P12-02: pending eligibility expires after 365 days", () => {
    const verdict = evaluateEligibility(
      baseInput({
        birthDate: null,
        firstRankingEligibilityAt: new Date(Date.UTC(2024, 0, 1)),
        evaluationDate: new Date(Date.UTC(2026, 0, 2)),
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(verdict.verdict, "PROVISIONAL");
    assert.equal(verdict.publicRankAllowed, false);
    assert.equal(verdict.snapshotEligible, false);
  });

  it("T-P12-03: pending restores when DOB is supplied", () => {
    const verdict = evaluateEligibility(
      baseInput({
        birthDate: new Date(Date.UTC(2008, 8, 15)),
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(verdict.verdict, "RANKED");
    assert.equal(verdict.ageVerificationStatus, "VERIFIED");
    assert.equal(verdict.publicRankAllowed, true);
    assert.equal(verdict.snapshotEligible, true);
    assert.equal(shouldShowAgeUnverifiedBadge(verdict), false);
  });

  it("T-P14-01: override cross-bracket without aligned basis is provisional", () => {
    const verdict = evaluateEligibility(
      baseInput({
        ageGroupOverride: "U19",
        ratingAgeGroup: "U16",
        evaluatedBoard: "U19",
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(verdict.verdict, "PROVISIONAL");
    assert.equal(verdict.provisionalReason, "OVERRIDE_CROSS_BRACKET");
    assert.equal(verdict.publicRankAllowed, false);
    assert.equal(verdict.precedenceRule, "P14");
  });

  it("includes launch-v1 policy metadata on every verdict", () => {
    const verdict = evaluateEligibility(baseInput());

    assert.equal(verdict.policyVersionId, LAUNCH_POLICY_V1_ID);
    assert.equal(verdict.evaluatedBoard, "U19");
    assert.equal(verdict.ratingAgeGroup, "U19");
    assert.equal(verdict.verifiedGameCount, 10);
    assert.equal(verdict.gamesQualified, 10);
    assert.match(verdict.evaluationDate, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isPublicBoardRanked", () => {
  it("returns true only for ranked verdicts with publicRankAllowed", () => {
    const ranked = evaluateEligibility(baseInput());
    const provisional = evaluateEligibility(baseInput({ verifiedGameCount: 2, gamesQualified: 2 }));
    const pending = evaluateEligibility(
      baseInput({
        birthDate: null,
        firstRankingEligibilityAt: new Date(Date.UTC(2026, 0, 1)),
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(isPublicBoardRanked(ranked), true);
    assert.equal(isPublicBoardRanked(provisional), false);
    assert.equal(isPublicBoardRanked(pending), false);
  });
});

describe("isPublicBoardVisible", () => {
  it("includes pending P12 players with publicRankAllowed", () => {
    const pending = evaluateEligibility(
      baseInput({
        birthDate: null,
        firstRankingEligibilityAt: new Date(Date.UTC(2026, 0, 1)),
        verifiedGameCount: 12,
        gamesQualified: 12
      })
    );

    assert.equal(isPublicBoardVisible(pending), true);
  });
});

describe("buildEligibilityInput", () => {
  it("normalizes prisma gender enums and defaults hasTargetBoardRating", () => {
    const input = buildEligibilityInput({
      playerId: "player-2",
      gender: "GIRLS",
      birthDate: null,
      ratingAgeGroup: "U19",
      verifiedGameCount: 6,
      evaluatedBoard: "U19"
    });

    assert.equal(input.gender, "Girls");
    assert.equal(input.hasTargetBoardRating, true);
    assert.equal(input.policyVersionId, LAUNCH_POLICY_V1_ID);
  });
});
