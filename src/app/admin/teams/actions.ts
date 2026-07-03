"use server";

import { revalidatePath } from "next/cache";

import { invalidateAdminProgramMembershipCaches, invalidateAdminTeamsCaches } from "@/lib/admin/invalidate-admin-caches";
import {
  assignTeamToProgram,
  createTeamRecord,
  removeTeamFromProgram,
} from "@/lib/admin/program-team-membership";
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

function revalidateTeamProgramSurfaces(programId?: string | null) {
  invalidateAdminTeamsCaches();
  invalidateAdminProgramMembershipCaches();
  revalidatePath("/admin/teams");
  revalidatePath("/admin/programs");
  if (programId) revalidatePath(`/admin/programs/${programId}`);
  revalidatePublicRankingSurfaces();
}

export async function createTeam(_previousState: UpdateTeamState, formData: FormData): Promise<UpdateTeamState> {
  try {
    await requireAdminUser();
    const assignmentMode = String(formData.get("assignmentMode") ?? "standalone").trim();
    const programIdRaw = String(formData.get("programId") ?? "").trim();
    const programId = assignmentMode === "under_program" ? programIdRaw : null;

    if (assignmentMode === "under_program" && !programId) {
      throw new Error("Program is required when creating a team under a program.");
    }

    const team = await createTeamRecord({
      name: readRequiredString(formData, "name", "Team name", 120),
      city: readRequiredString(formData, "city", "City", 100),
      region: readRequiredString(formData, "region", "Region", 100),
      programId,
    });

    revalidateTeamProgramSurfaces(programId);
    return { ok: true, message: `Created ${team.name}.`, teamId: team.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create team." };
  }
}

export async function updateTeamProgram(_previousState: UpdateTeamState, formData: FormData): Promise<UpdateTeamState> {
  try {
    await requireAdminUser();
    const teamId = String(formData.get("teamId") ?? "").trim();
    const mode = String(formData.get("programMode") ?? "assign").trim();
    if (!teamId) throw new Error("Team id is required.");

    const existingTeam = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true, programId: true },
    });
    if (!existingTeam) throw new Error("Team does not exist or has been deleted.");

    if (mode === "remove") {
      const result = await removeTeamFromProgram(teamId);
      revalidateTeamProgramSurfaces(result.previousProgramId);
      return { ok: true, message: "Program assignment removed.", teamId };
    }

    const programId = String(formData.get("programId") ?? "").trim();
    if (!programId) throw new Error("Program is required.");

    if (mode === "change" && !existingTeam.programId) {
      throw new Error("Team has no program to change. Use Assign instead.");
    }

    if (mode === "assign" && existingTeam.programId) {
      throw new Error("Team already has a program. Use Change instead.");
    }

    const result = await assignTeamToProgram(teamId, programId);
    revalidateTeamProgramSurfaces(programId);
    if (result.previousProgramId) revalidatePath(`/admin/programs/${result.previousProgramId}`);
    return {
      ok: true,
      message:
        result.action === "already_linked"
          ? "Team is already assigned to that program."
          : mode === "change"
            ? `Program changed to ${result.program.fullName}.`
            : `Assigned to ${result.program.fullName}.`,
      teamId,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update program assignment." };
  }
}

export async function updateTeamBio(_previousState: UpdateTeamState, formData: FormData): Promise<UpdateTeamState> {
  try {
    await requireAdminUser();

    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!teamId) throw new Error("Team id is required.");

    const existingTeam = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true, programId: true }
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
    if (existingTeam.programId) revalidatePath(`/admin/programs/${existingTeam.programId}`);
    revalidatePublicRankingSurfaces();

    return { ok: true, message: "Team updated.", teamId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update team." };
  }
}
