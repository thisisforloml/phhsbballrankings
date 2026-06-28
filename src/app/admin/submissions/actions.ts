"use server";

import { OrganizerSubmissionType, SubmissionStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview } from "@/lib/submission-review";
import { buildSubmissionImportPreflight } from "@/lib/submission-import-preflight";
import { formatSubmissionJsonParseError, safeJsonParse } from "@/lib/submission-json";
import { parseSubmissionPayload, readSubmissionMetadata } from "@/lib/submission-utils";
import { importApprovedSubmissionOfficialData } from "@/lib/submission-official-import";
import {
  computeImportedSubmissionFormulaScores,
  computeImportedSubmissionPlayerRatings,
  computeImportedSubmissionTeamRatings,
  generateImportedSubmissionMonthlyRankings,
  validateImportedSubmissionRankings
} from "@/lib/submission-post-import-processing";
import {
  assertSubmissionReviewable,
  canDeleteDraftSubmission,
  draftDeleteIneligibilityReason,
  initialSubmissionStatusForCreate,
  submissionRequiresDeleteReviewWarning
} from "@/lib/submission-lifecycle";

const allowedTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"],
  IMPORTED: []
};


type JsonRecord = Record<string, unknown>;

const editableGameFields = ["gameNumber", "gameDate", "homeTeamName", "awayTeamName", "homeScore", "awayScore", "city", "region"] as const;
const editablePlayerFields = ["name", "team", "MIN", "PTS", "FGM", "FGA", "3PM", "3PA", "2PM", "2PA", "FTM", "FTA", "OREB", "DREB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "FD", "+/-"] as const;
const numericDraftFields = new Set(["homeScore", "awayScore", "PTS", "FGM", "FGA", "3PM", "3PA", "2PM", "2PA", "FTM", "FTA", "OREB", "DREB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "FD", "+/-"]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getPackagesFromParsedSubmission(value: unknown) {
  const root = asRecord(value);
  if (root) return { packages: [root], rootWasArray: false };
  return { packages: asArray(value).map(asRecord).filter((item): item is JsonRecord => item !== null), rootWasArray: true };
}

function draftValue(formData: FormData, name: string, fallback: unknown) {
  const value = formData.get(name);
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (numericDraftFields.has(name.split(".").at(-1) ?? "")) {
    if (trimmed === "") return 0;
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }
  return trimmed;
}

function rebuildEditableSubmissionJson(parsed: unknown, formData: FormData) {
  const { packages, rootWasArray } = getPackagesFromParsedSubmission(parsed);
  if (!packages.length) throw new Error("Submission JSON package was not found.");

  packages.forEach((submissionPackage, packageIndex) => {
    const games = asArray(submissionPackage.games).map(asRecord).filter((game): game is JsonRecord => game !== null);
    games.forEach((game, gameIndex) => {
      editableGameFields.forEach((field) => {
        game[field] = draftValue(formData, `game.${packageIndex}.${gameIndex}.${field}`, game[field]);
      });

      const players = asArray(game.players).map(asRecord).filter((player): player is JsonRecord => player !== null);
      players.forEach((player, playerIndex) => {
        editablePlayerFields.forEach((field) => {
          player[field] = draftValue(formData, `player.${packageIndex}.${gameIndex}.${playerIndex}.${field}`, player[field]);
        });
      });
      game.players = players;
    });
    submissionPackage.games = games;
  });

  return rootWasArray ? packages : packages[0];
}
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

function appendAdminNotes(existing: string | null, note: string) {
  return [existing, note].filter(Boolean).join("\n\n");
}

function reviewRedirectUrl(submissionId: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/admin/submissions/${submissionId}?${searchParams.toString()}`;
}


function jsonPreview(value: unknown): Prisma.InputJsonValue {
  const preview = Array.isArray(value)
    ? { kind: "array", totalItems: value.length, sample: value.slice(0, 10) }
    : value && typeof value === "object"
      ? {
          kind: "object",
          keys: Object.keys(value as Record<string, unknown>),
          sample: Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 10))
        }
      : { kind: typeof value, sample: value };

  return JSON.parse(JSON.stringify(preview)) as Prisma.InputJsonValue;
}

export async function updateSubmissionDraftJson(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }
  if (!rawText) {
    redirect(reviewRedirectUrl(submissionId, { reviewError: "Draft JSON cannot be empty." }));
  }
  if (Buffer.byteLength(rawText, "utf8") > 5 * 1024 * 1024) {
    redirect(reviewRedirectUrl(submissionId, { reviewError: "Draft JSON must be 5 MB or smaller." }));
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, deletedAt: true }
  });
  if (!submission) throw new Error("Submission not found.");
  assertSubmissionReviewable(submission);
  if (submission.status === "IMPORTED") {
    redirect(reviewRedirectUrl(submission.id, { reviewError: "Imported submissions are locked. Draft JSON can only be edited before import." }));
  }

  const parsed = safeJsonParse(rawText);
  if (!parsed.ok) {
    redirect(reviewRedirectUrl(submission.id, { reviewError: `Invalid JSON: ${formatSubmissionJsonParseError(parsed) ?? "JSON could not be parsed."}` }));
  }

  try {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        rawText,
        parsedPreview: jsonPreview(parsed.data),
        validationSummary: {
          ok: true,
          format: "json",
          messages: ["Draft JSON updated by admin. No official import was performed."],
          previewSupported: true
        }
      },
      select: { id: true }
    });
  } catch {
    redirect(reviewRedirectUrl(submission.id, { reviewError: "Draft JSON is not valid. Nothing was saved." }));
  }

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submission.id}`);
  redirect(reviewRedirectUrl(submission.id, { reviewSuccess: "Draft JSON saved and validation refreshed." }));
}


export async function updateSubmissionStructuredDraft(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, rawText: true, parsedPreview: true, deletedAt: true }
  });
  if (!submission) throw new Error("Submission not found.");
  assertSubmissionReviewable(submission);
  if (submission.status === "IMPORTED") {
    redirect(reviewRedirectUrl(submission.id, { reviewError: "Imported submissions are locked. Draft game stats can only be edited before import." }));
  }

  const parsed = safeJsonParse(submission.rawText ?? "");
  if (!parsed.ok) {
    redirect(reviewRedirectUrl(submission.id, { reviewError: `Current draft JSON is invalid: ${formatSubmissionJsonParseError(parsed) ?? "JSON could not be parsed."}` }));
  }

  try {
    const updated = rebuildEditableSubmissionJson(parsed.data, formData);
    const rawText = JSON.stringify(updated, null, 2);
    const validation = safeJsonParse(rawText);
    if (!validation.ok) throw new Error(formatSubmissionJsonParseError(validation) ?? "Updated JSON could not be parsed.");

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        rawText,
        parsedPreview: jsonPreview(updated),
        validationSummary: {
          ok: true,
          format: "json",
          messages: ["Structured game/stat edits saved to the submission draft. Official data was not changed."],
          previewSupported: true
        }
      },
      select: { id: true }
    });
  } catch (error) {
    redirect(reviewRedirectUrl(submission.id, { reviewError: error instanceof Error ? error.message : "Draft game/stat edits could not be saved." }));
  }

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submission.id}`);
  redirect(reviewRedirectUrl(submission.id, { reviewSuccess: "Draft game/stat edits saved. Review and preflight have refreshed." }));
}
export async function createAdminJsonSubmission(formData: FormData) {
  const user = await requireAdminUser();

  try {
    const rawText = String(formData.get("rawText") ?? "").trim();
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const type = rawText ? OrganizerSubmissionType.PASTE_JSON : hasFile ? OrganizerSubmissionType.UPLOAD_JSON : null;

    if (!type) throw new Error("Paste JSON or upload a JSON file.");
    if (hasFile && file instanceof File && !file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      throw new Error("Admin JSON Intake accepts JSON files only.");
    }

    const metadata = readSubmissionMetadata(formData);
    const payload = await parseSubmissionPayload(type, formData);

    await prisma.submission.create({
      data: {
        submittedByUserId: user.id,
        type,
        status: initialSubmissionStatusForCreate({ adminDraft: true }),
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
    const message = encodeURIComponent(error instanceof Error ? error.message : "Admin JSON submission could not be created.");
    redirect(`/admin/submissions?tab=json&jsonError=${message}`);
  }

  revalidatePath("/admin/submissions");
  redirect("/admin/submissions?tab=json&jsonCreated=1");
}

async function readSubmissionForPublish(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      title: true,
      leagueName: true,
      rawText: true,
      parsedPreview: true,
      adminNotes: true,
      deletedAt: true
    }
  });
  if (!submission) throw new Error("Submission not found.");
  assertSubmissionReviewable(submission);
  return submission;
}

async function setSubmissionStatusForPublish(submissionId: string, status: SubmissionStatus, note: string) {
  const current = await prisma.submission.findUnique({ where: { id: submissionId }, select: { adminNotes: true } });
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status, adminNotes: appendAdminNotes(current?.adminNotes ?? null, note) },
    select: { id: true }
  });
}

export async function publishSubmission(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  const completedSteps: string[] = [];
  let redirectParams: Record<string, string>;

  try {
    let submission = await readSubmissionForPublish(submissionId);
    if (submission.status === SubmissionStatus.REJECTED) {
      throw new Error("Cannot publish a rejected submission. Move it back under review first.");
    }

    const review = buildSubmissionReview(submission);
    if (!review.validJson) {
      throw new Error(`Invalid JSON: ${review.parseError ?? "Fix the draft JSON before publishing."}`);
    }

    if (submission.status === SubmissionStatus.DRAFT) {
      await setSubmissionStatusForPublish(submission.id, SubmissionStatus.SUBMITTED, "Publish workflow: draft submitted for review.");
      completedSteps.push("submitted");
      submission = await readSubmissionForPublish(submission.id);
    }

    if (submission.status === SubmissionStatus.SUBMITTED) {
      await setSubmissionStatusForPublish(submission.id, SubmissionStatus.UNDER_REVIEW, "Publish workflow: marked under review.");
      completedSteps.push("under review");
      submission = await readSubmissionForPublish(submission.id);
    }

    if (submission.status === SubmissionStatus.UNDER_REVIEW) {
      await setSubmissionStatusForPublish(submission.id, SubmissionStatus.APPROVED, "Publish workflow: approved for official import.");
      completedSteps.push("approved");
      submission = await readSubmissionForPublish(submission.id);
    }

    if (submission.status === SubmissionStatus.APPROVED) {
      const preflight = await buildSubmissionImportPreflight(submission);
      if (preflight.overallSummary.importBlocked) {
        throw new Error(`Cannot publish yet: ${preflight.overallSummary.blockers.join(" ")}`);
      }

      await importApprovedSubmissionOfficialData(submission.id);
      completedSteps.push("imported");
      submission = await readSubmissionForPublish(submission.id);
    }

    if (submission.status !== SubmissionStatus.IMPORTED) {
      throw new Error(`Cannot publish submission from status ${submission.status}.`);
    }

    await computeImportedSubmissionFormulaScores(submission.id);
    completedSteps.push("scores");

    await computeImportedSubmissionPlayerRatings(submission.id);
    completedSteps.push("ratings");

    await computeImportedSubmissionTeamRatings(submission.id);
    completedSteps.push("team-ratings");

    await generateImportedSubmissionMonthlyRankings(submission.id);
    completedSteps.push("rankings");

    const validation = await validateImportedSubmissionRankings(submission.id);
    completedSteps.push("validation");

    if (!validation.validationPassed) {
      throw new Error("Validation completed with issues. Review Advanced details for the validation result.");
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: { publishedAt: new Date() },
      select: { id: true }
    });
    completedSteps.push("published");

    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${submission.id}`);
    redirectParams = { reviewSuccess: `Publish completed: ${completedSteps.join(", ")}.` };
  } catch (error) {
    redirectParams = {
      reviewError: `${error instanceof Error ? error.message : "Publish failed."} Completed steps: ${completedSteps.join(", ") || "none"}.`
    };
  }

  redirect(reviewRedirectUrl(submissionId, redirectParams));
}
export async function updateSubmissionReviewStatus(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  const targetStatus = parseStatus(formData.get("targetStatus"));
  const note = cleanAdminNotes(formData.get("adminNotes"));

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
    select: { id: true, status: true, adminNotes: true, deletedAt: true }
  });

  if (!submission) {
    throw new Error("Submission not found.");
  }

  assertSubmissionReviewable(submission);

  const allowedTargets = allowedTransitions[submission.status] ?? [];
  if (!allowedTargets.includes(targetStatus)) {
    redirect(reviewRedirectUrl(submission.id, {
      reviewError: `Cannot change submission from ${submission.status} to ${targetStatus}. Mark Under Review first if needed.`
    }));
  }

  const nextAdminNotes = note ? appendAdminNotes(submission.adminNotes, note) : submission.adminNotes;

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: targetStatus,
      adminNotes: nextAdminNotes
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
async function runPostImportAction(
  formData: FormData,
  actionName: string,
  action: (submissionId: string) => Promise<unknown>
) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  let redirectParams: Record<string, string>;
  try {
    await action(submissionId);
    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${submissionId}`);
    redirectParams = { reviewSuccess: `${actionName} completed.` };
  } catch (error) {
    redirectParams = { reviewError: error instanceof Error ? error.message : `${actionName} failed.` };
  }

  redirect(reviewRedirectUrl(submissionId, redirectParams));
}

export async function computeSubmissionFormulaScores(formData: FormData) {
  await runPostImportAction(formData, "Formula v1 score computation", computeImportedSubmissionFormulaScores);
}

export async function computeSubmissionPlayerRatings(formData: FormData) {
  await runPostImportAction(formData, "Player rating computation", computeImportedSubmissionPlayerRatings);
}

export async function generateSubmissionMonthlyRankings(formData: FormData) {
  await runPostImportAction(formData, "Monthly ranking generation", generateImportedSubmissionMonthlyRankings);
}

export async function validateSubmissionRankings(formData: FormData) {
  await runPostImportAction(formData, "Ranking validation", validateImportedSubmissionRankings);
}

export async function processAndPublishSubmissionRankings(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  const completedSteps: string[] = [];
  let redirectParams: Record<string, string>;

  try {
    await computeImportedSubmissionFormulaScores(submissionId);
    completedSteps.push("scores");

    await computeImportedSubmissionPlayerRatings(submissionId);
    completedSteps.push("ratings");

    await computeImportedSubmissionTeamRatings(submissionId);
    completedSteps.push("team-ratings");

    await generateImportedSubmissionMonthlyRankings(submissionId);
    completedSteps.push("rankings");

    const validation = await validateImportedSubmissionRankings(submissionId);
    completedSteps.push("validation");

    if (!validation.validationPassed) {
      throw new Error("Validation completed with issues. Review the individual validation step for details.");
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: { publishedAt: new Date() },
      select: { id: true }
    });

    revalidatePath("/admin/submissions");
    revalidatePath(`/admin/submissions/${submissionId}`);
    redirectParams = {
      reviewSuccess: "Process & Publish completed: scores, ratings, monthly rankings, and validation passed."
    };
  } catch (error) {
    redirectParams = {
      reviewError: `${error instanceof Error ? error.message : "Process & Publish failed."} Completed steps: ${completedSteps.join(", ") || "none"}.`
    };
  }

  redirect(reviewRedirectUrl(submissionId, redirectParams));
}

export async function deleteSubmissionDraft(formData: FormData) {
  await requireAdminUser();

  const submissionId = formData.get("submissionId");
  const confirmText = formData.get("confirmText");
  const redirectTo = formData.get("redirectTo");

  if (typeof submissionId !== "string" || !submissionId) {
    throw new Error("Submission id is required.");
  }

  if (confirmText !== "DELETE") {
    redirect(typeof redirectTo === "string" && redirectTo.startsWith("/admin/submissions")
      ? `${redirectTo}?error=${encodeURIComponent("Type DELETE to confirm deletion.")}`
      : `/admin/submissions/${submissionId}?reviewError=${encodeURIComponent("Type DELETE to confirm deletion.")}`);
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, deletedAt: true, publishedAt: true, importedAt: true, status: true }
  });

  if (!submission) {
    throw new Error("Submission not found.");
  }

  if (!canDeleteDraftSubmission(submission)) {
    const reason = draftDeleteIneligibilityReason(submission) ?? "This submission cannot be deleted.";
    redirect(typeof redirectTo === "string" && redirectTo.startsWith("/admin/submissions")
      ? `${redirectTo}?error=${encodeURIComponent(reason)}`
      : `/admin/submissions/${submissionId}?reviewError=${encodeURIComponent(reason)}`);
  }

  if (submissionRequiresDeleteReviewWarning(submission.status) && formData.get("confirmReviewDelete") !== "yes") {
    redirect(`/admin/submissions/${submissionId}?reviewError=${encodeURIComponent("Confirm that you understand this submission is under review or approved.")}`);
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { deletedAt: new Date() },
    select: { id: true }
  });

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submission.id}`);

  if (typeof redirectTo === "string" && redirectTo.startsWith("/admin/submissions")) {
    redirect(`${redirectTo}?draftDeleted=1`);
  }

  redirect("/admin/submissions?draftDeleted=1");
}

