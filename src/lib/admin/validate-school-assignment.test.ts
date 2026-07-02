import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProgramType } from "@prisma/client";

import {
  resolveCurrentSchoolId,
  validateSchoolAssignmentInput,
} from "@/lib/admin/validate-school-assignment";

describe("validate-school-assignment", () => {
  it("resolves current school from program type", () => {
    assert.equal(resolveCurrentSchoolId("school-1", ProgramType.SCHOOL), "school-1");
    assert.equal(resolveCurrentSchoolId("club-1", ProgramType.CLUB), null);
    assert.equal(resolveCurrentSchoolId(null, null), null);
  });

  it("requires no current school for assign", () => {
    assert.equal(
      validateSchoolAssignmentInput({
        mode: "ASSIGN",
        currentSchoolId: null,
        nextProgramId: "school-b",
      }),
      null,
    );
    assert.match(
      validateSchoolAssignmentInput({
        mode: "ASSIGN",
        currentSchoolId: "school-a",
        nextProgramId: "school-b",
      }) ?? "",
      /Transfer/i,
    );
  });

  it("validates transfer origin and target", () => {
    assert.match(
      validateSchoolAssignmentInput({
        mode: "TRANSFER",
        currentSchoolId: null,
        nextProgramId: "school-b",
      }) ?? "",
      /Assign/i,
    );
    assert.match(
      validateSchoolAssignmentInput({
        mode: "TRANSFER",
        currentSchoolId: "school-a",
        nextProgramId: "school-a",
      }) ?? "",
      /different/i,
    );
    assert.match(
      validateSchoolAssignmentInput({
        mode: "TRANSFER",
        currentSchoolId: "school-a",
        nextProgramId: "school-b",
        expectedFromProgramId: "school-x",
      }) ?? "",
      /no longer matches/i,
    );
    assert.equal(
      validateSchoolAssignmentInput({
        mode: "TRANSFER",
        currentSchoolId: "school-a",
        nextProgramId: "school-b",
        expectedFromProgramId: "school-a",
      }),
      null,
    );
  });
});
