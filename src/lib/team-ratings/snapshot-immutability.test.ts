import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertTeamSnapshotMutable, canRewriteTeamSnapshot, TeamSnapshotImmutabilityError } from "@/lib/team-ratings/snapshot-immutability";

describe("team snapshot immutability", () => {
  it("allows DRAFT rewrite", () => {
    assert.equal(canRewriteTeamSnapshot("DRAFT"), true);
  });

  it("blocks PUBLISHED rewrite", () => {
    assert.equal(canRewriteTeamSnapshot("PUBLISHED"), false);
    assert.throws(() => assertTeamSnapshotMutable("PUBLISHED"), TeamSnapshotImmutabilityError);
  });
});
