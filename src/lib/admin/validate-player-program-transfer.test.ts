import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProgramRole } from "@prisma/client";

import { validatePlayerProgramTransfer } from "@/lib/admin/validate-player-program-transfer";

describe("validate-player-program-transfer", () => {
  it("requires a current program", () => {
    assert.match(
      validatePlayerProgramTransfer({
        currentProgramId: null,
        destinationProgramId: "dest-1",
        destinationExists: true,
        destinationArchived: false,
        destinationProgramRole: ProgramRole.OPERATIONAL,
      }) ?? "",
      /Assign instead/i,
    );
  });

  it("rejects same destination program", () => {
    assert.match(
      validatePlayerProgramTransfer({
        currentProgramId: "prog-a",
        destinationProgramId: "prog-a",
        destinationExists: true,
        destinationArchived: false,
        destinationProgramRole: ProgramRole.OPERATIONAL,
      }) ?? "",
      /different/i,
    );
  });

  it("rejects group destination programs", () => {
    assert.match(
      validatePlayerProgramTransfer({
        currentProgramId: "prog-a",
        destinationProgramId: "group-1",
        destinationExists: true,
        destinationArchived: false,
        destinationProgramRole: ProgramRole.GROUP,
      }) ?? "",
      /operational/i,
    );
  });

  it("rejects archived destination programs", () => {
    assert.match(
      validatePlayerProgramTransfer({
        currentProgramId: "prog-a",
        destinationProgramId: "archived-1",
        destinationExists: false,
        destinationArchived: true,
        destinationProgramRole: ProgramRole.OPERATIONAL,
      }) ?? "",
      /archived/i,
    );
  });

  it("accepts valid operational transfers", () => {
    assert.equal(
      validatePlayerProgramTransfer({
        currentProgramId: "prog-a",
        destinationProgramId: "prog-b",
        destinationExists: true,
        destinationArchived: false,
        destinationProgramRole: ProgramRole.OPERATIONAL,
      }),
      null,
    );
  });
});
