"use server";

import { revalidatePath } from "next/cache";

import { invalidateAdminTeamsCaches } from "@/lib/admin/invalidate-admin-caches";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePublicRankingSurfaces } from "@/lib/public-cache-revalidation";

export type UpdateTeamState = {
  ok: boolean;
  message: string;
  teamId?: string;
};

function readRequiredString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return value;
}

export async function updateTeamBio(_previousState: UpdateTeamState, formData: FormData): Promise<UpdateTeamState> {
  try {
    await requireAdminUser();

    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!teamId) throw new Error("Team id is required.");

    const existingTeam = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true }
    });
    if (!existingTeam) throw new Error("Team does not exist or has been deleted.");

    const name = readRequiredString(formData, "name", "Team name", 120);
    const city = readRequiredString(formData, "city", "City", 100);
    const region = readRequiredString(formData, "region", "Region", 100);
    const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

    await prisma.team.update({
      where: { id: teamId },
      data: { name, city, region, logoUrl }
    });

    invalidateAdminTeamsCaches();
    revalidatePath("/admin/teams");
    revalidatePublicRankingSurfaces();

    return { ok: true, message: "Team updated.", teamId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update team." };
  }
}
