import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProgramRole } from "@prisma/client";

import { assertOperationalProgramRole } from "@/lib/admin/program-role";

describe("player program assignment validation", () => {
  it("rejects group programs for player assignment", () => {
    assert.throws(
      () =>
        assertOperationalProgramRole(
          { fullName: "De La Salle Philippines", programRole: ProgramRole.GROUP },
          "player assignment",
        ),
      /group container and cannot be assigned to players/i,
    );
  });

  it("allows operational programs for player assignment", () => {
    assert.doesNotThrow(() =>
      assertOperationalProgramRole(
        { fullName: "La Salle Green Hills", programRole: ProgramRole.OPERATIONAL },
        "player assignment",
      ),
    );
  });

  it("rejects archived programs", () => {
    assert.throws(() => assertOperationalProgramRole(null, "player assignment"), /does not exist or has been archived/i);
  });
});
