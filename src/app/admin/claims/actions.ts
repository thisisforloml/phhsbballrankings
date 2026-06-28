"use server";

import { revalidatePath } from "next/cache";
import { ProfileClaimStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/portal-auth";
import { writeAuditLog } from "@/lib/admin/log-admin-action";

export type ClaimActionState = { ok: boolean; message: string };

export async function reviewProfileClaim(_previous: ClaimActionState, formData: FormData): Promise<ClaimActionState> {
  try {
    const user = await requireAdminUser();
    const claimId = String(formData.get("claimId") ?? "").trim();
    const action = String(formData.get("action") ?? "").trim();
    const adminNotes = String(formData.get("adminNotes") ?? "").trim() || null;

    if (!claimId) throw new Error("Claim id is required.");

    const claim = await prisma.profileClaim.findUnique({
      where: { id: claimId },
      select: { id: true, playerId: true, status: true }
    });
    if (!claim) throw new Error("Claim not found.");
    if (claim.status !== ProfileClaimStatus.PENDING) throw new Error("Only pending claims can be reviewed.");

    if (action === "APPROVE") {
      await prisma.$transaction([
        prisma.profileClaim.update({
          where: { id: claimId },
          data: {
            status: ProfileClaimStatus.APPROVED,
            reviewedById: user.id,
            reviewedAt: new Date(),
            adminNotes
          }
        }),
        prisma.playerClaimProfile.upsert({
          where: { playerId: claim.playerId },
          create: { playerId: claim.playerId, claimId },
          update: { claimId }
        })
      ]);
      await writeAuditLog({
        userId: user.id,
        entityType: "PROFILE_CLAIM",
        entityId: claimId,
        action: "APPROVE",
        reason: adminNotes ?? "Claim approved"
      });
      revalidatePath("/admin/claims");
      return { ok: true, message: "Claim approved." };
    }

    if (action === "REJECT") {
      await prisma.profileClaim.update({
        where: { id: claimId },
        data: {
          status: ProfileClaimStatus.REJECTED,
          reviewedById: user.id,
          reviewedAt: new Date(),
          adminNotes
        }
      });
      await writeAuditLog({
        userId: user.id,
        entityType: "PROFILE_CLAIM",
        entityId: claimId,
        action: "REJECT",
        reason: adminNotes ?? "Claim rejected"
      });
      revalidatePath("/admin/claims");
      return { ok: true, message: "Claim rejected." };
    }

    throw new Error("Unsupported review action.");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not review claim." };
  }
}
