"use client";

import { useState } from "react";
import type { SubmissionStatus } from "@prisma/client";
import { deleteSubmissionDraft } from "@/app/admin/submissions/actions";
import { submissionRequiresDeleteReviewWarning } from "@/lib/submission-lifecycle";

type SubmissionDeleteDraftFormProps = {
  submissionId: string;
  submissionTitle: string;
  submissionStatus: SubmissionStatus;
  redirectTo?: string;
  compact?: boolean;
};

export function SubmissionDeleteDraftForm({
  submissionId,
  submissionTitle,
  submissionStatus,
  redirectTo,
  compact = false
}: SubmissionDeleteDraftFormProps) {
  const [confirmText, setConfirmText] = useState("");
  const [reviewWarningAcknowledged, setReviewWarningAcknowledged] = useState(false);
  const requiresReviewWarning = submissionRequiresDeleteReviewWarning(submissionStatus);
  const canDelete = confirmText === "DELETE" && (!requiresReviewWarning || reviewWarningAcknowledged);

  return (
    <form action={deleteSubmissionDraft} className={compact ? "grid gap-3" : "grid gap-4"}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="submissionStatus" value={submissionStatus} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <div className="grid gap-2 text-sm text-red-900">
        <p>
          This soft-deletes <strong className="font-semibold text-red-950">{submissionTitle}</strong>. The submission record, raw JSON, and admin notes are preserved for audit but hidden from review queues.
        </p>
        <p className="text-red-800">This action cannot be undone from the admin UI.</p>
      </div>

      {requiresReviewWarning ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong className="block">This submission is {submissionStatus === "APPROVED" ? "approved" : "under review"}.</strong>
          <p className="mt-1">
            Deleting it will remove it from the admin review queue even though review work may already be in progress. Official data is only protected after import or publish.
          </p>
          <label className="mt-3 flex items-start gap-2 font-semibold">
            <input
              type="checkbox"
              name="confirmReviewDelete"
              value="yes"
              checked={reviewWarningAcknowledged}
              onChange={(event) => setReviewWarningAcknowledged(event.target.checked)}
              className="mt-0.5"
            />
            <span>I understand this submission is {submissionStatus === "APPROVED" ? "approved" : "under review"} and still want to delete it.</span>
          </label>
        </div>
      ) : null}

      <label className="grid gap-1.5 text-xs font-semibold text-red-950">
        Type DELETE to confirm
        <input
          name="confirmText"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          className="min-h-10 border border-red-300 bg-white px-3 py-2 font-mono text-sm text-ink-900 outline-none focus:border-red-500"
          placeholder="DELETE"
        />
      </label>

      <button
        type="submit"
        disabled={!canDelete}
        className="w-fit bg-red-700 px-4 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
      >
        Delete Submission
      </button>
    </form>
  );
}
