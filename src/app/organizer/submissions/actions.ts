"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { inferSubmissionType, parseSubmissionPayload, readSubmissionMetadata } from "@/lib/submission-utils";

export async function createOrganizerSubmission(formData: FormData) {
  const user = await requireOrganizerUser();

  try {
    const type = inferSubmissionType(formData);
    const metadata = readSubmissionMetadata(formData);
    const payload = await parseSubmissionPayload(type, formData);

    await prisma.submission.create({
      data: {
        submittedByUserId: user.id,
        type,
        status: "SUBMITTED",
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
    redirect(`/organizer/submissions?error=${message}`);
  }

  revalidatePath("/organizer/submissions");
  revalidatePath("/admin/submissions");
  redirect("/organizer/submissions?created=1");
}