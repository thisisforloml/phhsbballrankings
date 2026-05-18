"use server";

import { SubmissionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { importApprovedSubmissionOfficialData } from "@/lib/submission-official-import";

const allowedTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"],
  IMPORTED: []
};

function parseStatus(value: FormDataEntryValue | null): SubmissionStatus | null {
  if (typeof value !== "string") return null;
  return Object.values(SubmissionStatus).includes(value as SubmissionStatus) ? (value as SubmissionStatus) : null;
}

function cleanAdminNotes(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, 2000);
}

function reviewRedirectUrl(submissionId: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/admin/submissions/${submissionId}?${searchParams.toString()}`;
}

export async function updateSubmissionReviewStatus(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  const targetStatus = parseStatus(formData.get("targetStatus"));
  const adminNotes = cleanAdminNotes(formData.get("adminNotes"));

  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  if (!targetStatus || targetStatus === "IMPORTED") {
    redirect(reviewRedirectUrl(submissionId, {
      reviewError: "That submission status change is not available yet."
    }));
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true }
  });

  if (!submission) {
    throw new Error("Submission not found.");
  }

  const allowedTargets = allowedTransitions[submission.status] ?? [];
  if (!allowedTargets.includes(targetStatus)) {
    redirect(reviewRedirectUrl(submission.id, {
      reviewError: `Cannot change submission from ${submission.status} to ${targetStatus}. Mark Under Review first if needed.`
    }));
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: targetStatus,
      adminNotes
    },
    select: { id: true }
  });

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submission.id}`);

  redirect(reviewRedirectUrl(submission.id, {
    reviewSuccess: `Submission status updated to ${targetStatus}.`
  }));
}

export async function importSubmissionOfficialData(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  try {
    const summary = await importApprovedSubmissionOfficialData(submissionId);
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${submissionId}`);

    redirect(reviewRedirectUrl(submissionId, {
      reviewSuccess: summary.alreadyImported
        ? "Submission was already imported. No duplicate records were created."
        : "Official import completed. Ratings and rankings were not recomputed."
    }));
  } catch (error) {
    redirect(reviewRedirectUrl(submissionId, {
      reviewError: error instanceof Error ? error.message : "Official import failed."
    }));
  }
}