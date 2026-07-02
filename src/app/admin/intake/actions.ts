"use server";

import { revalidatePath } from "next/cache";

import {
  approveOrganizerApplication,
  approvePlayerProfileSubmission,
  type IntakeReviewAction,
  organizerApprovalMessage,
  rejectOrganizerApplication,
  rejectPlayerProfileSubmission,
} from "@/lib/admin/intake-review";
import { writeAuditLog } from "@/lib/admin/log-admin-action";
import { requireAdminUser } from "@/lib/portal-auth";

export type IntakeActionState = { ok: boolean; message: string };

const initialFailure = (message: string): IntakeActionState => ({ ok: false, message });

function parseReviewAction(value: FormDataEntryValue | null): IntakeReviewAction | null {
  const action = String(value ?? "").trim();
  if (action === "APPROVE" || action === "REJECT") return action;
  return null;
}

export async function reviewPlayerProfileSubmission(
  _previous: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  try {
    const user = await requireAdminUser();
    const submissionId = String(formData.get("submissionId") ?? "").trim();
    const action = parseReviewAction(formData.get("action"));
    const adminNotes = String(formData.get("adminNotes") ?? "").trim() || null;

    if (!submissionId || !action) {
      throw new Error("Submission id and review action are required.");
    }

    if (action === "REJECT") {
      const submission = await rejectPlayerProfileSubmission(submissionId);
      await writeAuditLog({
        userId: user.id,
        entityType: "PLAYER_PROFILE_SUBMISSION",
        entityId: submissionId,
        action: "REJECT",
        reason: adminNotes ?? "Player profile submission rejected",
        previousData: { status: submission.status },
        newData: { status: "REJECTED" },
      });
      revalidatePath("/admin/intake");
      return { ok: true, message: "Player submission rejected." };
    }

    const submission = await approvePlayerProfileSubmission(submissionId);
    await writeAuditLog({
      userId: user.id,
      entityType: "PLAYER_PROFILE_SUBMISSION",
      entityId: submissionId,
      action: "APPROVE",
      reason: adminNotes ?? "Player profile submission approved",
      previousData: { status: submission.status, playerId: submission.playerId },
      newData: { status: "APPROVED" },
    });
    revalidatePath("/admin/intake");
    revalidatePath("/admin/players");
    return { ok: true, message: "Player profile submission approved." };
  } catch (error) {
    return initialFailure(error instanceof Error ? error.message : "Could not review player submission.");
  }
}

export async function reviewOrganizerApplication(
  _previous: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  try {
    const user = await requireAdminUser();
    const applicationId = String(formData.get("applicationId") ?? "").trim();
    const action = parseReviewAction(formData.get("action"));
    const adminNotes = String(formData.get("adminNotes") ?? "").trim() || null;

    if (!applicationId || !action) {
      throw new Error("Application id and review action are required.");
    }

    if (action === "REJECT") {
      const application = await rejectOrganizerApplication(applicationId);
      await writeAuditLog({
        userId: user.id,
        entityType: "ORGANIZER_APPLICATION",
        entityId: applicationId,
        action: "REJECT",
        reason: adminNotes ?? "Organizer application rejected",
        previousData: { status: application.status },
        newData: { status: "REJECTED" },
      });
      revalidatePath("/admin/intake");
      return { ok: true, message: "Organizer application rejected." };
    }

    const result = await approveOrganizerApplication(applicationId);
    await writeAuditLog({
      userId: user.id,
      entityType: "ORGANIZER_APPLICATION",
      entityId: applicationId,
      action: "APPROVE",
      reason: adminNotes ?? "Organizer application approved",
      previousData: { status: result.application.status },
      newData: {
        status: "APPROVED",
        organizerUsername: result.organizerUsername,
      },
    });
    revalidatePath("/admin/intake");
    return { ok: true, message: organizerApprovalMessage(result) };
  } catch (error) {
    return initialFailure(error instanceof Error ? error.message : "Could not review organizer application.");
  }
}
