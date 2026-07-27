import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifySubmissionTeamResolution } from "./submission-import-preflight";

describe("classifySubmissionTeamResolution", () => {
  it("creates a clear context-specific Team when its Program exists and no match exists", () => {
    assert.equal(classifySubmissionTeamResolution({
      programExists: true,
      hasMixedContextMatch: false,
      matchCount: 0,
    }), "create");
  });

  it("reuses one safe existing Team", () => {
    assert.equal(classifySubmissionTeamResolution({
      programExists: true,
      hasMixedContextMatch: false,
      matchCount: 1,
    }), "reuse");
  });

  it("requires review for missing Programs, mixed contexts, or ambiguous matches", () => {
    assert.equal(classifySubmissionTeamResolution({
      programExists: false,
      hasMixedContextMatch: false,
      matchCount: 0,
    }), "manual_review");
    assert.equal(classifySubmissionTeamResolution({
      programExists: true,
      hasMixedContextMatch: true,
      matchCount: 1,
    }), "manual_review");
    assert.equal(classifySubmissionTeamResolution({
      programExists: true,
      hasMixedContextMatch: false,
      matchCount: 2,
    }), "manual_review");
  });
});