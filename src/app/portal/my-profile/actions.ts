"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePortalUser } from "@/lib/portal-auth";
import { slugify } from "@/lib/format";
import { writeAuditLog } from "@/lib/admin/log-admin-action";

export type ClaimantProfileState = { ok: boolean; message: string };

export async function updateClaimedPlayerBio(_previous: ClaimantProfileState, formData: FormData): Promise<ClaimantProfileState> {
  try {
    const user = await requirePortalUser();
    const playerId = String(formData.get("playerId") ?? "").trim();
    if (!playerId) throw new Error("Player id is required.");

    const approvedClaim = await prisma.profileClaim.findFirst({
      where: { playerId, status: "APPROVED" },
      select: { id: true }
    });
    if (!approvedClaim) throw new Error("No approved claim exists for this player.");

    const displayName = String(formData.get("displayName") ?? "").trim();
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const hometown = String(formData.get("hometown") ?? "").trim();
    const region = String(formData.get("region") ?? "").trim();
    const position = String(formData.get("position") ?? "").trim() || null;
    const contactEmail = String(formData.get("contactEmail") ?? "").trim() || null;

    if (!displayName || !firstName || !lastName || !hometown || !region) {
      throw new Error("Display name, names, hometown, and play region are required.");
    }

    await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: {
          displayName,
          firstName,
          lastName,
          hometown,
          city: hometown,
          region,
          position
        }
      }),
      prisma.playerClaimProfile.upsert({
        where: { playerId },
        create: { playerId, claimId: approvedClaim.id, contactEmail },
        update: { contactEmail }
      })
    ]);

    await writeAuditLog({
      userId: user.id,
      entityType: "PLAYER",
      entityId: playerId,
      action: "CLAIMANT_BIO_UPDATE",
      reason: "Claimant profile edit",
      newData: { displayName, hometown, region, position }
    });

    revalidatePath("/portal/my-profile");
    revalidatePath(`/players/${slugify(displayName)}`);

    return { ok: true, message: "Profile updated. Ratings and scouting remain locked." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update profile."
    };
  }
}
