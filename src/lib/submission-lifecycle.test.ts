import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SubmissionStatus } from "@prisma/client";

import {
  canDeleteDraftSubmission,
  canTransitionSubmissionStatus,
  draftDeleteIneligibilityReason,
  initialSubmissionStatusForCreate,
  submissionRequiresDeleteReviewWarning,
  submissionStatusTransitions,
} from "@/lib/submission-lifecycle";

describe("submission-lifecycle", () => {
  it("defines publish workflow transitions", () => {
    assert.deepEqual(submissionStatusTransitions.DRAFT, [SubmissionStatus.SUBMITTED]);
    assert.equal(
      canTransitionSubmissionStatus(SubmissionStatus.DRAFT, SubmissionStatus.SUBMITTED),
      true,
    );
    assert.equal(
      canTransitionSubmissionStatus(SubmissionStatus.IMPORTED, SubmissionStatus.APPROVED),
      false,
    );
    assert.equal(
      canTransitionSubmissionStatus(SubmissionStatus.UNDER_REVIEW, SubmissionStatus.APPROVED),
      true,
    );
  });

  it("creates organizer submissions as submitted and admin drafts as draft", () => {
    assert.equal(initialSubmissionStatusForCreate({ adminDraft: false }), SubmissionStatus.SUBMITTED);
    assert.equal(initialSubmissionStatusForCreate({ adminDraft: true }), SubmissionStatus.DRAFT);
  });

  it("blocks draft delete when published or imported", () => {
    assert.equal(
      canDeleteDraftSubmission({ publishedAt: null, importedAt: null, deletedAt: null }),
      true,
    );
    assert.equal(
      canDeleteDraftSubmission({ publishedAt: new Date(), importedAt: null, deletedAt: null }),
      false,
    );
    assert.match(
      draftDeleteIneligibilityReason({
        publishedAt: new Date(),
        importedAt: null,
        deletedAt: null,
      }) ?? "",
      /published/i,
    );
    assert.equal(submissionRequiresDeleteReviewWarning(SubmissionStatus.APPROVED), true);
    assert.equal(submissionRequiresDeleteReviewWarning(SubmissionStatus.DRAFT), false);
  });
});
