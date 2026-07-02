"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/admin/log-admin-action";
import { requireAdminUser } from "@/lib/portal-auth";
import { computeProgramTeamRatings } from "@/lib/team-ratings/compute-program-team-ratings";

export type OpsActionState = { ok: boolean; message: string };

export async function recomputeAllTeamRatings(_previous: OpsActionState, formData: FormData): Promise<OpsActionState> {
  try {
    const user = await requireAdminUser();
    if (String(formData.get("confirm") ?? "") !== "on") {
      throw new Error("Confirm team rating recompute.");
    }

    const result = await computeProgramTeamRatings();
    await writeAuditLog({
      userId: user.id,
      entityType: "TEAM_RATINGS",
      entityId: user.id,
      action: "RECOMPUTE_ALL",
      reason: "Manual ops recompute",
      newData: { upserted: result.upserted, deleted: result.deleted, totalRows: result.totalRows }
    });

    revalidatePath("/admin/ops");
    return { ok: true, message: `Team ratings updated (${result.totalRows} rows).` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Recompute failed." };
  }
}
