"use server";

import { OrganizerSubmissionType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { inferSubmissionType, parseSubmissionPayload, readSubmissionMetadata } from "@/lib/submission-utils";
import { initialSubmissionStatusForCreate } from "@/lib/submission-lifecycle";

export async function createOrganizerSubmission(formData: FormData) {
  const user = await requireOrganizerUser();
    const returnTo = String(formData.get("returnTo") ?? "/organizer/submissions").trim();
    const safeReturnTo = returnTo.startsWith("/admin/tools/submissions") && user.role === UserRole.ADMIN ? "/admin/tools/submissions" : "/organizer/submissions";
    const adminDraft = safeReturnTo.startsWith("/admin/tools/submissions");

  try {
    const type = inferSubmissionType(formData);
    if (user.role !== UserRole.ADMIN && (type === OrganizerSubmissionType.PASTE_JSON || type === OrganizerSubmissionType.UPLOAD_JSON)) {
      throw new Error("JSON submissions are handled by admins.");
    }
    const metadata = readSubmissionMetadata(formData);
    const payload = await parseSubmissionPayload(type, formData);

    await prisma.submission.create({
      data: {
        submittedByUserId: user.id,
        type,
        status: initialSubmissionStatusForCreate({ adminDraft }),
        title: metadata.title,
        leagueName: metadata.leagueName,
        gameDate: metadata.gameDate,
        originalFilename: payload.originalFilename,
        mimeType: payload.mimeType,
        fileSizeBytes: payload.fileSizeBytes,
        storedFilePath: payload.storedFilePath,
        rawText: payload.rawText,
        parsedPreview: payload.parsedPreview === null ? undefined : payload.parsedPreview,
        validationSummary: payload.validationSummary,
        adminNotes: null
      }
    });
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "Submission could not be created.");
    redirect(`${safeReturnTo}?error=${message}`);
  }

  revalidatePath("/organizer/submissions");
  revalidatePath("/admin/tools/submissions");
  revalidatePath("/admin/submissions");
  redirect(`${safeReturnTo}?created=1`);
}
