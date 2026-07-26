import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgeGroup, PlayerGender } from "@prisma/client";

import { teamMatchesImportContext } from "@/lib/team-import-matching";

describe("teamMatchesImportContext", () => {
  it("rejects a saved alias whose official evidence belongs to another age group", () => {
    assert.equal(teamMatchesImportContext({
      name: "San Pedro Spartans",
      competitionContexts: [{ ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS }]
    }, AgeGroup.U19, PlayerGender.BOYS), false);
  });

  it("accepts a team whose official evidence matches the requested board", () => {
    assert.equal(teamMatchesImportContext({
      name: "San Pedro Spartans 18u",
      competitionContexts: [{ ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS }]
    }, AgeGroup.U19, PlayerGender.BOYS), true);
  });

  it("rejects cross-gender matches even without game evidence", () => {
    assert.equal(teamMatchesImportContext({
      name: "Mapua Lady Cardinals U19",
      competitionContexts: []
    }, AgeGroup.U19, PlayerGender.BOYS), false);
  });

  it("allows a new context-specific team with no games yet", () => {
    assert.equal(teamMatchesImportContext({
      name: "1118 Autospa Dragons 18u",
      competitionContexts: []
    }, AgeGroup.U19, PlayerGender.BOYS), true);
  });
});
