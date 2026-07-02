import type { Prisma } from "@prisma/client";

import type { SubmissionListReview } from "@/lib/submission-review";
import type { SubmissionValidationSummary } from "@/lib/submission-utils";

export type SubmissionListReviewSnapshot = SubmissionListReview;

export type SubmissionValidationSummaryWithListReview = SubmissionValidationSummary & {
  listReview?: SubmissionListReviewSnapshot;
};

type ListReviewSource = {
  title: string;
  leagueName: string | null;
  validationSummary: Prisma.JsonValue | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isListReviewSnapshot(value: unknown): value is SubmissionListReviewSnapshot {
  const record = asRecord(value);
  if (!record || typeof record.importReady !== "boolean" || typeof record.readinessLabel !== "string") return false;
  const summary = asRecord(record.summary);
  return (
    summary !== null &&
    ("leagueName" in summary ? summary.leagueName === null || typeof summary.leagueName === "string" : false) &&
    typeof summary.gameCount === "number" &&
    typeof summary.totalPlayerRows === "number"
  );
}

export function readSubmissionListReviewFromSummary(
  validationSummary: Prisma.JsonValue | null | undefined,
): SubmissionListReviewSnapshot | null {
  const summary = asRecord(validationSummary);
  if (!summary) return null;
  const listReview = summary.listReview;
  return isListReviewSnapshot(listReview) ? listReview : null;
}

export function withListReviewInValidationSummary(
  validationSummary: SubmissionValidationSummary,
  listReview: SubmissionListReviewSnapshot,
): SubmissionValidationSummaryWithListReview {
  return {
    ...validationSummary,
    listReview,
  };
}

export function resolveSubmissionListReview(
  submission: ListReviewSource,
  fallback?: () => SubmissionListReviewSnapshot,
): SubmissionListReviewSnapshot {
  const stored = readSubmissionListReviewFromSummary(submission.validationSummary);
  if (stored) return stored;
  return fallback?.() ?? {
    importReady: false,
    readinessLabel: "Needs review",
    summary: {
      leagueName: submission.leagueName,
      gameCount: 0,
      totalPlayerRows: 0,
    },
  };
}

export function submissionReviewToListSnapshot(review: {
  importReady: boolean;
  readinessLabel: string;
  summary: { leagueName: string | null; gameCount: number; totalPlayerRows: number };
}): SubmissionListReviewSnapshot {
  return {
    importReady: review.importReady,
    readinessLabel: review.readinessLabel,
    summary: {
      leagueName: review.summary.leagueName,
      gameCount: review.summary.gameCount,
      totalPlayerRows: review.summary.totalPlayerRows,
    },
  };
}
