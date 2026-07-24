import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgeGroup, PlayerGender } from "@prisma/client";

import {
  inferTeamAgeGroupFromName,
  teamNameHasCompetitionContext,
  teamNameMatchesCompetitionContext,
} from "@/lib/team-import-context";

describe("team import competition context", () => {
  it("maps source competition labels into platform age groups", () => {
    assert.equal(inferTeamAgeGroupFromName("Smile 360 Bullies 13U"), AgeGroup.U13);
    assert.equal(inferTeamAgeGroupFromName("Smile 360 Bullies 15U"), AgeGroup.U16);
    assert.equal(inferTeamAgeGroupFromName("UST Tiger Cubs U19 Boys"), AgeGroup.U19);
  });

  it("rejects cross-age and cross-gender Team reuse", () => {
    assert.equal(
      teamNameMatchesCompetitionContext("Smile 360 Bullies 13U", AgeGroup.U16, PlayerGender.BOYS),
      false,
    );
    assert.equal(
      teamNameMatchesCompetitionContext("UST Junior Tigresses U19", AgeGroup.U19, PlayerGender.BOYS),
      false,
    );
  });

  it("recognizes explicit age or gender context", () => {
    assert.equal(teamNameHasCompetitionContext("Smile 360 Bullies 15U"), true);
    assert.equal(teamNameHasCompetitionContext("UST Junior Tigresses"), true);
    assert.equal(teamNameHasCompetitionContext("Smile 360 Bullies"), false);
  });
});