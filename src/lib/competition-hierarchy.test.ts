import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getCompetitionBracketLabel, getLeagueFamilyName, rankingAgeGroupForBracket } from "@/lib/competition-hierarchy";

describe("competition hierarchy labels", () => {
  it("groups known competition variants under one league family", () => {
    assert.equal(getLeagueFamilyName("Junior MPBL Season 4 - 18U"), "Junior MPBL");
    assert.equal(getLeagueFamilyName("Philippine Youth Basketball Championship - 15U"), "Philippine Youth Basketball Championship");
  });

  it("derives a clean family for other season and bracket names", () => {
    assert.equal(getLeagueFamilyName("Metro Youth League Season 2 - U15 Boys"), "Metro Youth League");
  });

  it("preserves exact competition brackets while mapping to public ranking boards", () => {
    assert.equal(getCompetitionBracketLabel("Junior MPBL Season 4 - 18U Boys", "U19"), "U18 Boys");
    assert.equal(rankingAgeGroupForBracket("U15 BOYS"), "U16");
    assert.equal(rankingAgeGroupForBracket("U18 GIRLS"), "U19");
  });
});
