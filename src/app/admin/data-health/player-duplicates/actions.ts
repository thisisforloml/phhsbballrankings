"use server";

import { revalidatePath } from "next/cache";

import {
  invalidateAdminPlayerProfileCaches,
  invalidateAdminProgramMembershipCaches,
} from "@/lib/admin/invalidate-admin-caches";
import { clearDataHealthCenterCache } from "@/lib/admin/load-data-health-center";
import { clearDuplicateDetectionCorpusCache } from "@/lib/admin/load-player-duplicate-candidates";
import { executePlayerMerge } from "@/lib/admin/player-merge";
import { requireAdminUser } from "@/lib/portal-auth";
import { revalidatePublicRankingSurfaces } from "@/lib/public-cache-revalidation";

export type PlayerMergeActionState = {
  ok: boolean;
  message: string;
  canonicalPlayerId?: string;
};

export const initialPlayerMergeActionState: PlayerMergeActionState = {
  ok: false,
  message: "",
};

function required(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function duplicatePlayerIds(formData: FormData) {
  const playerIds = formData.getAll("duplicatePlayerIds")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const uniquePlayerIds = Array.from(new Set(playerIds));
  if (!uniquePlayerIds.length) throw new Error("Select at least one duplicate Player.");
  if (uniquePlayerIds.length > 10) throw new Error("Merge at most 10 duplicate profiles at one time.");
  return uniquePlayerIds;
}

export async function mergeDuplicatePlayer(
  _previousState: PlayerMergeActionState,
  formData: FormData,
): Promise<PlayerMergeActionState> {
  try {
    const user = await requireAdminUser();
    const canonicalPlayerId = required(formData, "canonicalPlayerId", "Player to keep");
    const selectedDuplicatePlayerIds = duplicatePlayerIds(formData);
    const expectedFingerprint = required(formData, "expectedFingerprint", "Preview fingerprint");
    const reason = required(formData, "reason", "Merge reason");
    const confirmText = required(formData, "confirmText", "Confirmation");
    const confirmHistory = String(formData.get("confirmHistory") ?? "") === "on";

    if (reason.length > 500) throw new Error("Merge reason must be 500 characters or fewer.");
    if (confirmText !== "MERGE") throw new Error("Type MERGE exactly to confirm.");
    if (!confirmHistory) {
      throw new Error("Confirm that historical Team and game context will remain unchanged.");
    }

    const result = await executePlayerMerge({
      canonicalPlayerId,
      duplicatePlayerIds: selectedDuplicatePlayerIds,
      expectedFingerprint,
      reason,
      userId: user.id,
    });

    clearDuplicateDetectionCorpusCache();
    clearDataHealthCenterCache();
    invalidateAdminPlayerProfileCaches();
    invalidateAdminProgramMembershipCaches();
    revalidatePath("/admin");
    revalidatePath("/admin/players");
    revalidatePath("/admin/programs");
    revalidatePath("/admin/data-health");
    revalidatePath("/admin/data-health/player-duplicates");
    revalidatePath(`/players/${result.canonicalPlayerId}`);
    for (const playerId of result.duplicatePlayerIds) revalidatePath(`/players/${playerId}`);
    revalidatePublicRankingSurfaces();

    return {
      ok: true,
      message: `${result.duplicateDisplayNames.length} profile(s) merged into ${result.canonicalDisplayName}. ${result.reassigned.gameStats} GameStat rows reassigned.`,
      canonicalPlayerId: result.canonicalPlayerId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Player merge failed.",
    };
  }
}
