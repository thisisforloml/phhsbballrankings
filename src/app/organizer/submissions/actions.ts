"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizerSubmissionType } from "@prisma/client";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { parseSubmissionPayload, readSubmissionMetadata } from "@/lib/submission-utils";

function readType(formData: FormData) {
  const rawType = String(formData.get("type") ?? "").trim();
  if (!Object.values(OrganizerSubmissionType).includes(rawType as OrganizerSubmissionType)) {
    throw new Error("Unsupported submission type.");
  }
  return rawType as OrganizerSubmissionType;
}

export async function createOrganizerSubmission(formData: FormData) {
  const user = await requireOrganizerUser();

  try {
    const type = readType(formData);
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