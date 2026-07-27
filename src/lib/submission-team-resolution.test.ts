import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeTeamRecordName,
  selectPreferredSubmissionTeamMatches,
} from "./submission-team-resolution";

describe("submission Team resolution", () => {
  it("normalizes accents for exact record matching", () => {
    assert.equal(normalizeTeamRecordName("Mapúa Red Robins"), normalizeTeamRecordName("Mapua Red Robins"));
  });

  it("prefers the exact submitted Team over a generated age-group variant", () => {
    const exact = { id: "u18", name: "San Pedro Spartans U18 Boys" };
    const generated = { id: "u19", name: "San Pedro Spartans U19" };
    assert.deepEqual(
      selectPreferredSubmissionTeamMatches(
        "San Pedro Spartans U18 Boys",
        "San Pedro Spartans U19",
        [generated, exact],
        true,
      ),
      [exact],
    );
  });

  it("falls back to the generated Team when there is no exact submitted record", () => {
    const generated = { id: "u19", name: "Mapúa Red Robins" };
    assert.deepEqual(
      selectPreferredSubmissionTeamMatches("Mapua", "Mapúa Red Robins", [generated], false),
      [generated],
    );
  });
});