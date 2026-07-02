import { type Submission,SubmissionStatus } from "@prisma/client";

export const activeSubmissionWhere = { deletedAt: null } as const;

export const submissionStatusTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: [SubmissionStatus.SUBMITTED],
  SUBMITTED: [SubmissionStatus.UNDER_REVIEW],
  UNDER_REVIEW: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED],
  APPROVED: [SubmissionStatus.UNDER_REVIEW],
  REJECTED: [SubmissionStatus.UNDER_REVIEW],
  IMPORTED: [],
};

export function canTransitionSubmissionStatus(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return submissionStatusTransitions[from]?.includes(to) ?? false;
}

export function publishLifecycleSteps(): string[] {
  return ["submitted", "under review", "approved", "imported", "scores", "ratings, team-ratings, rankings", "validation", "published"];
}

type SubmissionDeleteEligibility = Pick<Submission, "publishedAt" | "importedAt" | "deletedAt">;

export function isSubmissionDeleted(submission: Pick<Submission, "deletedAt">) {
  return submission.deletedAt !== null;
}

export function canDeleteDraftSubmission(submission: SubmissionDeleteEligibility) {
  if (submission.deletedAt) return false;
  if (submission.publishedAt) return false;
  if (submission.importedAt) return false;
  return true;
}

export function submissionRequiresDeleteReviewWarning(status: SubmissionStatus) {
  return status === SubmissionStatus.UNDER_REVIEW || status === SubmissionStatus.APPROVED;
}

export function draftDeleteIneligibilityReason(submission: SubmissionDeleteEligibility) {
  if (submission.deletedAt) return "This submission has already been deleted.";
  if (submission.importedAt) return "Imported submissions cannot be deleted.";
  if (submission.publishedAt) return "Published submissions cannot be deleted.";
  return null;
}

export function assertSubmissionReviewable(submission: Pick<Submission, "deletedAt">) {
  if (isSubmissionDeleted(submission)) {
    throw new Error("Deleted submissions cannot be reviewed or modified.");
  }
}

export function initialSubmissionStatusForCreate(options: { adminDraft: boolean }) {
  return options.adminDraft ? SubmissionStatus.DRAFT : SubmissionStatus.SUBMITTED;
}
