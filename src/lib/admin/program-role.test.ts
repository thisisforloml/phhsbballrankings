import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProgramRole } from "@prisma/client";

import {
  assertImportProgramReusable,
  assertOperationalProgramRole,
  readProgramRoleFromForm,
  validateProgramCreateInput,
} from "@/lib/admin/program-role";

describe("program-role", () => {
  it("reads operational role from form data", () => {
    const formData = new FormData();
    formData.set("programRole", "OPERATIONAL");
    assert.equal(readProgramRoleFromForm(formData), ProgramRole.OPERATIONAL);
  });

  it("reads group role from form data", () => {
    const formData = new FormData();
    formData.set("programRole", "GROUP");
    assert.equal(readProgramRoleFromForm(formData), ProgramRole.GROUP);
  });

  it("rejects invalid program role on create form", () => {
    const formData = new FormData();
    formData.set("programRole", "INVALID");
    assert.throws(() => readProgramRoleFromForm(formData), /operational or group/i);
  });

  it("rejects group programs for team assignment", () => {
    assert.throws(
      () => assertOperationalProgramRole({ fullName: "De La Salle Philippines", programRole: ProgramRole.GROUP }, "team assignment"),
      /cannot own teams/i,
    );
  });

  it("rejects group programs for player assignment", () => {
    assert.throws(
      () => assertOperationalProgramRole({ fullName: "National University", programRole: ProgramRole.GROUP }, "player assignment"),
      /cannot be assigned to players/i,
    );
  });

  it("rejects group programs for import reuse", () => {
    assert.throws(
      () => assertImportProgramReusable({ fullName: "Far Eastern University", programRole: ProgramRole.GROUP }),
      /cannot be used for imports/i,
    );
  });

  it("rejects group create with parent, teams, or players", () => {
    assert.throws(
      () => validateProgramCreateInput({ programRole: ProgramRole.GROUP, parentProgramId: "parent-id" }),
      /cannot belong to another organization/i,
    );
    assert.throws(
      () => validateProgramCreateInput({ programRole: ProgramRole.GROUP, teamCount: 1 }),
      /cannot own teams/i,
    );
    assert.throws(
      () => validateProgramCreateInput({ programRole: ProgramRole.GROUP, playerCount: 1 }),
      /cannot own players/i,
    );
    assert.doesNotThrow(() => validateProgramCreateInput({ programRole: ProgramRole.GROUP }));
  });
});
