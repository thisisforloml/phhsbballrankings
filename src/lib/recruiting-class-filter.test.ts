import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LAUNCH_POLICY_V1_ID } from "@/lib/eligibility";
import {
  applyClassYearFilter,
  getRecruitingClassYearOptions,
  parseClassYearParam,
  recruitingRankColumnLabel,
  shouldShowRecruitingSortBanner
} from "@/lib/recruiting-class-filter";
import type { NationalRankingRow } from "@/lib/rankings";

function row(overrides: Partial<NationalRankingRow> & Pick<NationalRankingRow, "playerId">): NationalRankingRow {
  return {
    rank: 1,
    displayName: "Player",
    slug: "player",
    city: "Manila",
    region: "NCR",
    position: "G",
    heightCm: 180,
    birthYear: 2008,
    age: 17,
    currentTeam: "School",
    photoUrl: null,
    gender: "Boys",
    ageGroup: "U19",
    computedAgeBracket: "U19",
    effectiveClassYear: 2027,
    classYearLabel: "Class of 2027",
    eligibilityVerdict: {
      verdict: "RANKED",
      provisionalReason: null,
      exclusionReason: null,
      ageVerificationStatus: "VERIFIED",
      publicRankAllowed: true,
      snapshotEligible: true,
      matureEligible: false,
      ratingAgeGroup: "U19",
      evaluatedBoard: "U19",
      evaluationDate: "2026-06-17",
      formulaVersionId: null,
      policyVersionId: LAUNCH_POLICY_V1_ID,
      competitionAgeGroup: "U19",
      competitionTrustLevel: "STANDARD",
      classYearStatus: "ELIGIBLE",
      gamesQualified: 10,
      verifiedGameCount: 10,
      precedenceRule: "P9"
    },
    rating: 80,
    starRating: 4,
    verifiedGameCount: 10,
    primaryCompetition: null,
    ...overrides
  };
}

describe("recruiting-class-filter", () => {
  it("V-AG4-2: filters rows by effective class year", () => {
    const rows = [
      row({ playerId: "a", effectiveClassYear: 2027, classYearLabel: "Class of 2027" }),
      row({ playerId: "b", effectiveClassYear: 2028, classYearLabel: "Class of 2028" })
    ];

    const filtered = applyClassYearFilter(rows, { classYear: 2027 });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.playerId, "a");
  });

  it("V-AG4-1: preserves full-board order in filtered subset", () => {
    const rows = [
      row({ playerId: "a", rank: 1, effectiveClassYear: 2027 }),
      row({ playerId: "b", rank: 2, effectiveClassYear: 2028 }),
      row({ playerId: "c", rank: 3, effectiveClassYear: 2027 })
    ];

    const filtered = applyClassYearFilter(rows, { classYear: 2027 });
    assert.deepEqual(filtered.map((entry) => entry.playerId), ["a", "c"]);
  });

  it("V-AG4-7: includeUnknownClass adds null-effective rows only", () => {
    const rows = [
      row({ playerId: "a", effectiveClassYear: 2027, classYearLabel: "Class of 2027" }),
      row({ playerId: "b", effectiveClassYear: null, classYearLabel: null })
    ];

    const strict = applyClassYearFilter(rows, { classYear: 2027, includeUnknownClass: false });
    const inclusive = applyClassYearFilter(rows, { classYear: 2027, includeUnknownClass: true });

    assert.deepEqual(strict.map((entry) => entry.playerId), ["a"]);
    assert.deepEqual(inclusive.map((entry) => entry.playerId), ["a", "b"]);
  });

  it("builds chip options with All first", () => {
    const options = getRecruitingClassYearOptions([
      row({ playerId: "a", effectiveClassYear: 2027 }),
      row({ playerId: "b", effectiveClassYear: 2027 }),
      row({ playerId: "c", effectiveClassYear: 2027 }),
      row({ playerId: "d", effectiveClassYear: 2028 })
    ], { minCount: 3 });

    assert.equal(options[0]?.year, "all");
    assert.equal(options[1]?.year, 2027);
    assert.equal(options[1]?.count, 3);
    assert.equal(options.length, 2);
  });

  it("parses class year params safely", () => {
    assert.equal(parseClassYearParam(null), "all");
    assert.equal(parseClassYearParam("2027"), 2027);
    assert.equal(parseClassYearParam("abc"), "all");
  });

  it("V-AG4-9: switches rank column label when class filter active", () => {
    assert.equal(recruitingRankColumnLabel("Boys", "all"), "Rank");
    assert.equal(recruitingRankColumnLabel("Girls", 2027), "U19 Girls National Rank");
  });

  it("V-AG4-8: sort banner only when class filter and non-rank sort", () => {
    assert.equal(shouldShowRecruitingSortBanner("all", "rating"), false);
    assert.equal(shouldShowRecruitingSortBanner(2027, "rank"), false);
    assert.equal(shouldShowRecruitingSortBanner(2027, "rating"), true);
  });

  it("V-AG4-10: pending players with unknown class year stay visible when includeUnknownClass is enabled", () => {
    const baseVerdict = row({ playerId: "base" }).eligibilityVerdict;
    const rows = [
      row({
        playerId: "pending-1",
        effectiveClassYear: null,
        classYearLabel: null,
        eligibilityVerdict: {
          ...baseVerdict,
          verdict: "PROVISIONAL",
          provisionalReason: "UNKNOWN_DOB",
          ageVerificationStatus: "PENDING",
          publicRankAllowed: true,
          snapshotEligible: false
        }
      }),
      row({ playerId: "verified-1", effectiveClassYear: 2027 })
    ];

    const filtered = applyClassYearFilter(rows, { classYear: 2027, includeUnknownClass: true });
    assert.equal(filtered.length, 2);
    assert.equal(filtered.some((item) => item.playerId === "pending-1"), true);
  });
});
