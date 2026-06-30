"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/portal-auth";
import { revalidatePublicRankingSurfaces } from "@/lib/public-cache-revalidation";
import { slugify } from "@/lib/format";
import { getClassYear } from "@/lib/ranking-eligibility";
import { updatePlayerSchoolAssignment } from "@/lib/admin/player-school-transfer";
import { assignPlayerRosterFromAgeBracket } from "@/lib/admin/roster-from-game-evidence";
import { writeAuditLog } from "@/lib/admin/log-admin-action";

export type UpdatePlayerBioState = {
  ok: boolean;
  message: string;
  playerId?: string;
};

function readRequiredString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return value;
}

function readOptionalString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) return null;

  if (value.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return value;
}

function readOptionalHeight(formData: FormData) {
  const value = String(formData.get("heightCm") ?? "").trim();

  if (!value) return null;

  const heightCm = Number(value);
  if (!Number.isInteger(heightCm) || heightCm < 120 || heightCm > 230) {
    throw new Error("Height must be a whole number from 120 to 230 cm.");
  }

  return heightCm;
}

function readOptionalBirthDate(formData: FormData) {
  const value = String(formData.get("birthDate") ?? "").trim();

  if (!value) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error("Birth date must be a valid date.");
  }

  return date;
}

function readOptionalClassYear(formData: FormData) {
  const value = String(formData.get("classYear") ?? "").trim();

  if (!value) return null;

  const classYear = Number(value);
  if (!Number.isInteger(classYear) || classYear < 2000 || classYear > 2100) {
    throw new Error("Class Year must be a whole year from 2000 to 2100.");
  }

  return classYear;
}

function readOptionalAgeGroupOverride(formData: FormData) {
  const value = String(formData.get("ageGroupOverride") ?? "").trim().toUpperCase();
  if (!value) return null;
  if (!["U13", "U16", "U19"].includes(value)) {
    throw new Error("Age bracket override must be U13, U16, U19, or blank.");
  }
  return value;
}
const maxPhotoBytes = 3 * 1024 * 1024;
const allowedPhotoTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

function safeBaseName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "player-photo";
}

async function storePlayerPhoto(file: File, playerId: string) {
  if (!allowedPhotoTypes.has(file.type)) {
    throw new Error("Player photo must be a JPG, PNG, or WEBP image.");
  }
  if (file.size > maxPhotoBytes) {
    throw new Error("Player photo must be 3 MB or smaller.");
  }

  const extension = allowedPhotoTypes.get(file.type) ?? "jpg";
  const uploadDir = path.join(process.cwd(), "public", "uploads", "player-photos");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${playerId}-${Date.now()}-${randomUUID()}-${safeBaseName(file.name || `photo.${extension}`)}`;
  const finalName = filename.includes(".") ? filename : `${filename}.${extension}`;
  await writeFile(path.join(uploadDir, finalName), Buffer.from(await file.arrayBuffer()));
  return `/uploads/player-photos/${finalName}`;
}

async function readOptionalPhotoUrl(formData: FormData, playerId: string) {
  const uploadedPhoto = formData.get("photoFile");
  if (uploadedPhoto instanceof File && uploadedPhoto.size > 0) {
    return storePlayerPhoto(uploadedPhoto, playerId);
  }

  if (String(formData.get("clearPhoto") ?? "") === "on") {
    return null;
  }

  const value = readOptionalString(formData, "photoUrl", "Photo URL", 500);

  if (!value) return null;
  if (value.startsWith("/uploads/player-photos/")) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Photo URL must start with http:// or https://.");
    }
  } catch {
    throw new Error("Photo URL must be a valid URL.");
  }

  return value;
}

export async function updatePlayerBio(_previousState: UpdatePlayerBioState, formData: FormData): Promise<UpdatePlayerBioState> {
  try {
    await requireAdminUser();

    const playerId = String(formData.get("playerId") ?? "").trim();

    if (!playerId) {
      throw new Error("Player id is required.");
    }

    const existingPlayer = await prisma.player.findFirst({
      where: {
        id: playerId,
        deletedAt: null
      },
      select: {
        id: true,
        displayName: true,
        birthDate: true
      }
    });

    if (!existingPlayer) {
      throw new Error("Player does not exist or has been deleted.");
    }

    const previousBirthDate = existingPlayer.birthDate?.toISOString().slice(0, 10) ?? null;

    const displayName = readRequiredString(formData, "displayName", "Display name", 120);
    const firstName = readRequiredString(formData, "firstName", "First name", 80);
    const lastName = readRequiredString(formData, "lastName", "Last name", 80);
    const hometown = readRequiredString(formData, "hometown", "Hometown", 100);
    const region = readRequiredString(formData, "region", "Region (where they play)", 100);
    const position = readOptionalString(formData, "position", "Position", 20);
    const schoolOverride = readOptionalString(formData, "schoolOverride", "School override", 160);
    const ageGroupOverride = readOptionalAgeGroupOverride(formData);
    const heightCm = readOptionalHeight(formData);
    const birthDate = readOptionalBirthDate(formData);
    const submittedClassYear = readOptionalClassYear(formData);
    const calculatedClassYear = getClassYear(birthDate);
    const classYearOverride = submittedClassYear === null || submittedClassYear === calculatedClassYear ? null : submittedClassYear;
    const photoUrl = await readOptionalPhotoUrl(formData, playerId);

    await prisma.player.update({
      where: {
        id: playerId
      },
      data: {
        displayName,
        firstName,
        lastName,
        hometown,
        city: hometown,
        region,
        position,
        schoolOverride,
        ageGroupOverride,
        heightCm,
        birthDate,
        classYearOverride,
        photoUrl
      }
    });

    const nextBirthDate = birthDate?.toISOString().slice(0, 10) ?? null;
    if (birthDate && nextBirthDate !== previousBirthDate) {
      await assignPlayerRosterFromAgeBracket(playerId);
    }

    revalidatePath("/admin/players");
    revalidatePath("/admin/programs");
    revalidatePath("/portal/players");
    revalidatePublicRankingSurfaces();
    revalidatePath(`/players/${slugify(existingPlayer.displayName)}`);
    revalidatePath(`/players/${slugify(displayName)}`);
    revalidatePath(`/players/${playerId}`);

    return {
      ok: true,
      message: "Player bio updated.",
      playerId
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update player bio."
    };
  }
}

function readTransferDate(formData: FormData) {
  const value = String(formData.get("effectiveDate") ?? "").trim();
  if (!value) throw new Error("Effective date is required.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error("Effective date must be a valid date.");
  }
  return date;
}

function readSchoolChangeMode(formData: FormData) {
  const value = String(formData.get("schoolChangeMode") ?? "").trim().toUpperCase();
  if (value !== "ASSIGN" && value !== "TRANSFER") {
    throw new Error("Choose Assign or Transfer.");
  }
  return value as "ASSIGN" | "TRANSFER";
}

export async function updatePlayerSchool(_previousState: UpdatePlayerBioState, formData: FormData): Promise<UpdatePlayerBioState> {
  try {
    const user = await requireAdminUser();
    const playerId = String(formData.get("playerId") ?? "").trim();
    const nextProgramId = String(formData.get("nextProgramId") ?? "").trim();
    const schoolChangeMode = readSchoolChangeMode(formData);
    const note = readOptionalString(formData, "transferNote", "Note", 500);
    const targetTeamId = String(formData.get("targetTeamId") ?? "").trim();
    const targetSeasonId = String(formData.get("targetSeasonId") ?? "").trim();
    const confirmAction = String(formData.get("confirmSchoolChange") ?? "") === "on";
    const fromProgramId = String(formData.get("fromProgramId") ?? "").trim() || null;

    if (!playerId) throw new Error("Player id is required.");
    if (!nextProgramId) throw new Error("Target school is required.");
    if (!confirmAction) {
      throw new Error(schoolChangeMode === "TRANSFER" ? "Confirm the school transfer to continue." : "Confirm the school assignment to continue.");
    }

    const result = await updatePlayerSchoolAssignment({
      mode: schoolChangeMode,
      playerId,
      nextProgramId,
      effectiveDate: readTransferDate(formData),
      note,
      expectedFromProgramId: schoolChangeMode === "TRANSFER" ? fromProgramId : null,
      manualRoster: targetTeamId && targetSeasonId ? { teamId: targetTeamId, seasonId: targetSeasonId } : null
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "PLAYER",
      entityId: playerId,
      action: schoolChangeMode === "TRANSFER" ? "TRANSFER_SCHOOL" : "ASSIGN_SCHOOL",
      reason: note ?? (schoolChangeMode === "TRANSFER" ? "Admin school transfer" : "Admin school assign"),
      newData: { nextProgramId, rosterTarget: result.rosterTarget, mode: schoolChangeMode }
    });

    const rosterMessage = result.rosterTarget
      ? ` Roster: ${result.rosterTarget.teamName} (${result.rosterTarget.seasonName}).`
      : "";

    return {
      ok: true,
      message:
        schoolChangeMode === "TRANSFER"
          ? `Transferred to ${result.programName}.${rosterMessage}`
          : `Assigned to ${result.programName}.${rosterMessage}`,
      playerId
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update player school."
    };
  }
}

/** @deprecated Use updatePlayerSchool */
export async function transferPlayerSchool(_previousState: UpdatePlayerBioState, formData: FormData): Promise<UpdatePlayerBioState> {
  formData.set("schoolChangeMode", "TRANSFER");
  if (!formData.get("confirmSchoolChange") && formData.get("confirmTransfer") === "on") {
    formData.set("confirmSchoolChange", "on");
  }
  return updatePlayerSchool(_previousState, formData);
}

function readCommitmentStatus(formData: FormData): "UNDECLARED" | "COMMITTED" {
  const value = String(formData.get("commitmentStatus") ?? "").trim().toUpperCase();
  if (value !== "UNDECLARED" && value !== "COMMITTED") {
    throw new Error("Choose Undeclared or Committed.");
  }
  return value;
}

export async function updatePlayerRecruitment(
  _previousState: UpdatePlayerBioState,
  formData: FormData
): Promise<UpdatePlayerBioState> {
  try {
    await requireAdminUser();

    const playerId = String(formData.get("playerId") ?? "").trim();
    if (!playerId) {
      throw new Error("Player id is required.");
    }

    const existingPlayer = await prisma.player.findFirst({
      where: { id: playerId, deletedAt: null },
      select: { id: true, displayName: true },
    });

    if (!existingPlayer) {
      throw new Error("Player does not exist or has been deleted.");
    }

    const commitmentStatus = readCommitmentStatus(formData);
    const committedUniversity =
      commitmentStatus === "COMMITTED"
        ? readRequiredString(formData, "committedUniversity", "University", 160)
        : null;

    await prisma.player.update({
      where: { id: playerId },
      data: { commitmentStatus, committedUniversity },
    });

    revalidatePath("/admin/players");
    revalidatePath("/admin/programs");
    revalidatePath(`/players/${slugify(existingPlayer.displayName)}`);
    revalidatePath(`/players/${playerId}`);

    return {
      ok: true,
      message: "Recruitment status updated.",
      playerId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update recruitment status.",
    };
  }
}
