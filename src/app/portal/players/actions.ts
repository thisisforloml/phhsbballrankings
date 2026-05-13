"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePortalUser } from "@/lib/portal-auth";
import { slugify } from "@/lib/format";

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

function readOptionalPhotoUrl(formData: FormData) {
  const value = readOptionalString(formData, "photoUrl", "Photo URL", 500);

  if (!value) return null;

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
    await requirePortalUser();

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
        displayName: true
      }
    });

    if (!existingPlayer) {
      throw new Error("Player does not exist or has been deleted.");
    }

    const displayName = readRequiredString(formData, "displayName", "Display name", 120);
    const firstName = readRequiredString(formData, "firstName", "First name", 80);
    const lastName = readRequiredString(formData, "lastName", "Last name", 80);
    const city = readRequiredString(formData, "city", "City", 100);
    const region = readRequiredString(formData, "region", "Region", 100);
    const position = readOptionalString(formData, "position", "Position", 20);
    const heightCm = readOptionalHeight(formData);
    const birthDate = readOptionalBirthDate(formData);
    const photoUrl = readOptionalPhotoUrl(formData);

    await prisma.player.update({
      where: {
        id: playerId
      },
      data: {
        displayName,
        firstName,
        lastName,
        city,
        region,
        position,
        heightCm,
        birthDate,
        photoUrl
      }
    });

    revalidatePath("/portal/players");
    revalidatePath("/rankings");
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