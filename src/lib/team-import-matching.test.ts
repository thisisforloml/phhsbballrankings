import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgeGroup, PlayerGender } from "@prisma/client";

import { inferTeamCreationPreview, matchExternalTeam, teamMatchesImportContext } from "@/lib/team-import-matching";

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


describe("matchExternalTeam competition brackets", () => {
  it("prefers the exact U15 Team over the broad U16 ranking group", () => {
    const program = {
      id: "program-smile",
      fullName: "Smile 360 Bullies",
      abbreviation: null,
      aliases: [],
      teams: [
        { id: "team-u15", name: "Smile 360 Bullies U15 Boys" },
        { id: "team-u16", name: "Smile 360 Bullies U16 Boys" },
      ],
    };
    const teamProgram = {
      id: program.id,
      fullName: program.fullName,
      abbreviation: null,
      aliases: [],
    };
    const result = matchExternalTeam({
      externalLabel: "Smile 360 Bullies",
      leagueName: "Philippine Youth Basketball Championship - 15U",
      ageGroup: AgeGroup.U16,
      gender: PlayerGender.BOYS,
      provider: "statshub-v1",
    }, {
      programs: [program],
      teams: [
        { id: "team-u15", name: "Smile 360 Bullies U15 Boys", programId: program.id, program: teamProgram, homeGames: [], awayGames: [] },
        { id: "team-u16", name: "Smile 360 Bullies U16 Boys", programId: program.id, program: teamProgram, homeGames: [], awayGames: [] },
      ],
      externalAliases: new Map(),
    });

    assert.equal(result.suggestedTeam?.teamId, "team-u15");
    assert.equal(result.ambiguous, false);
  });
});
describe("inferTeamCreationPreview", () => {
  it("creates a context-specific U15 Team while keeping the Program identity clean", () => {
    const preview = inferTeamCreationPreview({
      externalLabel: "Smile 360 Bullies",
      matchingInput: "Smile 360 Bullies",
      leagueName: "Philippine Youth Basketball Championship - 15U",
      ageGroup: AgeGroup.U16,
      gender: PlayerGender.BOYS,
    });

    assert.equal(preview.suggestedProgramName, "Smile 360 Bullies");
    assert.equal(preview.suggestedTeamName, "Smile 360 Bullies U15 Boys");
  });

  it("uses the competition bracket instead of the broad ranking age group", () => {
    const preview = inferTeamCreationPreview({
      externalLabel: "San Pedro Spartans",
      matchingInput: "San Pedro Spartans",
      leagueName: "Junior MPBL Season 4 - 18U",
      ageGroup: AgeGroup.U19,
      gender: PlayerGender.BOYS,
    });

    assert.equal(preview.suggestedTeamName, "San Pedro Spartans U18 Boys");
  });
});
describe("team import hierarchy safeguards", () => {
  it("does not reuse a generic Team for an exact U15 submission", () => {
    const program = {
      id: "program-spartans",
      fullName: "San Pedro Spartans",
      abbreviation: null,
      aliases: [],
      teams: [{ id: "team-generic", name: "San Pedro Spartans" }],
    };
    const result = matchExternalTeam({
      externalLabel: "San Pedro Spartans",
      leagueName: "Philippine Youth Basketball Championship - 15U",
      ageGroup: AgeGroup.U16,
      gender: PlayerGender.BOYS,
      provider: "statshub-v1",
    }, {
      programs: [program],
      teams: [{
        id: "team-generic",
        name: "San Pedro Spartans",
        programId: program.id,
        program: { id: program.id, fullName: program.fullName, abbreviation: null, aliases: [] },
        homeGames: [],
        awayGames: [],
      }],
      externalAliases: new Map(),
    });

    assert.equal(result.suggestedTeam, null);
    assert.equal(result.confidenceBand, "Unmatched");
  });

  it("keeps boys and girls Teams separate under one Program", () => {
    assert.equal(teamMatchesImportContext({
      name: "Program U19 Girls",
      competitionContexts: [],
    }, AgeGroup.U19, PlayerGender.BOYS), false);
    assert.equal(teamMatchesImportContext({
      name: "Program U19 Boys",
      competitionContexts: [],
    }, AgeGroup.U19, PlayerGender.BOYS), true);
  });
});
