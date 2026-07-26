"use server";

import { ProgramRole, ProgramType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { invalidateAdminProgramMembershipCaches, invalidateAdminTeamsCaches } from "@/lib/admin/invalidate-admin-caches";
import { clearProgramListCache } from "@/lib/admin/load-program-list";
import { updateProgramParentProgramId } from "@/lib/admin/program-hierarchy";
import { readProgramRoleFromForm } from "@/lib/admin/program-role";
import {
  archiveProgramRecord,
  assignTeamToProgram,
  createProgramAndAssignTeam,
  createProgramRecord,
  createTeamRecord,
  moveTeamBetweenPrograms,
  removeTeamFromProgram,
} from "@/lib/admin/program-team-membership";
import { slugify } from "@/lib/format";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePublicRankingSurfaces } from "@/lib/public-cache-revalidation";

export type ProgramActionState = {
  ok: boolean;
  message: string;
};

const initialProgramState: ProgramActionState = { ok: false, message: "" };

function readRequiredString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return value;
}

function readOptionalString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return value;
}

function readProgramType(formData: FormData) {
  const value = String(formData.get("type") ?? "").trim().toUpperCase();
  if (!Object.values(ProgramType).includes(value as ProgramType)) throw new Error("Program type must be SCHOOL, CLUB, TEAM, or UNKNOWN.");
  return value as ProgramType;
}

function readChangeMode(formData: FormData) {
  const value = String(formData.get("changeMode") ?? "EDIT").trim().toUpperCase();
  if (value !== "EDIT" && value !== "TRANSFER") throw new Error("Change mode must be Edit only or Transfer.");
  return value as "EDIT" | "TRANSFER";
}

function readOptionalDate(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
}

function revalidatePlayerProgramPaths(programId: string, player: { id: string; displayName: string; currentProgramId: string | null }, nextProgramId: string) {
  invalidateAdminProgramMembershipCaches();
  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath(`/admin/programs/${nextProgramId}`);
  if (player.currentProgramId) revalidatePath(`/admin/programs/${player.currentProgramId}`);
  revalidatePath("/admin/players");
  revalidatePublicRankingSurfaces();
  revalidatePath(`/players/${slugify(player.displayName)}`);
  revalidatePath(`/players/${player.id}`);
}

function readProgramFormInput(formData: FormData) {
  return {
    fullName: readRequiredString(formData, "fullName", "Program full name", 180),
    abbreviation: readOptionalString(formData, "abbreviation", "Abbreviation", 80),
    type: readProgramType(formData),
    programRole: readProgramRoleFromForm(formData),
    parentProgramId: readOptionalString(formData, "parentProgramId", "Organization", 64),
    city: readOptionalString(formData, "city", "City", 100),
    region: readOptionalString(formData, "region", "Region", 100),
  };
}

function revalidateProgramSurfaces(programId?: string) {
  invalidateAdminProgramMembershipCaches();
  invalidateAdminTeamsCaches();
  revalidatePath("/admin/programs");
  if (programId) revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/teams");
  revalidatePublicRankingSurfaces();
}

export async function createProgram(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const program = await createProgramRecord(readProgramFormInput(formData));
    revalidateProgramSurfaces(program.id);
    return { ok: true, message: `Program created: ${program.fullName}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create program." };
  }
}

export async function archiveProgram(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    const confirmText = String(formData.get("confirmText") ?? "").trim();
    if (!programId) throw new Error("Program id is required.");
    if (confirmText !== "ARCHIVE") throw new Error("Type ARCHIVE to confirm.");

    const program = await archiveProgramRecord(programId);
    revalidateProgramSurfaces(programId);
    return { ok: true, message: `${program.fullName} archived. Linked teams keep their program reference for audit.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not archive program." };
  }
}

export async function createProgramTeam(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    if (!programId) throw new Error("Program id is required.");

    const team = await createTeamRecord({
      name: readRequiredString(formData, "name", "Team name", 120),
      city: readRequiredString(formData, "city", "City", 100),
      region: readRequiredString(formData, "region", "Region", 100),
      programId,
      ageLabel: readRequiredString(formData, "ageLabel", "Age group", 3),
      gender: readRequiredString(formData, "gender", "Gender", 5),
    });

    revalidateProgramSurfaces(programId);
    invalidateAdminTeamsCaches();
    revalidatePath("/admin/teams");
    revalidatePublicRankingSurfaces();
    return { ok: true, message: `Created ${team.name} under this program.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create team." };
  }
}

export async function assignProgramTeam(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!programId || !teamId) throw new Error("Program id and team id are required.");

    const result = await assignTeamToProgram(teamId, programId);
    revalidateProgramSurfaces(programId);
    if (result.previousProgramId && result.previousProgramId !== programId) {
      revalidatePath(`/admin/programs/${result.previousProgramId}`);
    }
    return {
      ok: true,
      message:
        result.action === "already_linked"
          ? "Team is already assigned to this program."
          : `Team assigned to ${result.program.fullName}.`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not assign team to program." };
  }
}

export async function removeProgramTeam(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!programId || !teamId) throw new Error("Program id and team id are required.");

    await removeTeamFromProgram(teamId, programId);
    revalidateProgramSurfaces(programId);
    return { ok: true, message: "Team removed from program." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not remove team from program." };
  }
}

export async function moveProgramTeam(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const fromProgramId = String(formData.get("fromProgramId") ?? "").trim();
    const toProgramId = String(formData.get("toProgramId") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!fromProgramId || !toProgramId || !teamId) throw new Error("Source program, target program, and team id are required.");

    const result = await moveTeamBetweenPrograms(teamId, fromProgramId, toProgramId);
    revalidateProgramSurfaces(fromProgramId);
    revalidateProgramSurfaces(toProgramId);
    return { ok: true, message: `Team moved to ${result.program.fullName}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not move team between programs." };
  }
}

export async function createProgramWithTeam(
  _previousState: ProgramActionState = initialProgramState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!teamId) throw new Error("Team id is required.");

    const { program } = await createProgramAndAssignTeam(readProgramFormInput(formData), teamId);
    revalidateProgramSurfaces(program.id);
    return { ok: true, message: `Created ${program.fullName} and assigned the team.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create program and assign team." };
  }
}

function revalidateProgramHierarchySurfaces(programId: string) {
  clearProgramListCache();
  invalidateAdminProgramMembershipCaches();
  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${programId}`);
}

export async function updateProgramParent(
  _previousState: ProgramActionState = initialProgramState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    if (!programId) throw new Error("Program id is required.");

    const parentProgramIdRaw = String(formData.get("parentProgramId") ?? "").trim();
    const parentProgramId = parentProgramIdRaw || null;

    await updateProgramParentProgramId(programId, parentProgramId);
    revalidateProgramHierarchySurfaces(programId);
    return {
      ok: true,
      message: parentProgramId ? "Organization assignment updated." : "Organization assignment removed.",
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update organization assignment." };
  }
}

export async function updateProgram(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    if (!programId) throw new Error("Program id is required.");

    const existingProgram = await prisma.program.findFirst({ where: { id: programId, deletedAt: null }, select: { id: true } });
    if (!existingProgram) throw new Error("Program does not exist or has been deleted.");

    const fullName = readRequiredString(formData, "fullName", "Program full name", 180);
    const abbreviation = readOptionalString(formData, "abbreviation", "Abbreviation", 80);
    const type = readProgramType(formData);
    const city = readOptionalString(formData, "city", "City", 100);
    const region = readOptionalString(formData, "region", "Region", 100);

    await prisma.program.update({
      where: { id: programId },
      data: { fullName, abbreviation, type, city, region }
    });

    invalidateAdminProgramMembershipCaches();
    revalidatePath("/admin/programs");
    revalidatePath(`/admin/programs/${programId}`);
    revalidatePath("/admin/teams");
    revalidatePublicRankingSurfaces();
    return { ok: true, message: "Program updated." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update program." };
  }
}

export async function updateProgramTeam(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    const teamId = String(formData.get("teamId") ?? "").trim();
    if (!programId) throw new Error("Program id is required.");
    if (!teamId) throw new Error("Team id is required.");

    const team = await prisma.team.findFirst({ where: { id: teamId, programId, deletedAt: null }, select: { id: true } });
    if (!team) throw new Error("Team does not belong to this Program or has been deleted.");

    const name = readRequiredString(formData, "name", "Team name", 120);
    await prisma.team.update({ where: { id: teamId }, data: { name } });

    invalidateAdminTeamsCaches();
    invalidateAdminProgramMembershipCaches();
    revalidatePath("/admin/programs");
    revalidatePath(`/admin/programs/${programId}`);
    revalidatePath("/admin/teams");
    revalidatePublicRankingSurfaces();
    return { ok: true, message: "Team updated." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update team." };
  }
}

export async function updatePlayerCurrentProgram(_previousState: ProgramActionState = initialProgramState, formData: FormData): Promise<ProgramActionState> {
  try {
    await requireAdminUser();
    const programId = String(formData.get("programId") ?? "").trim();
    const playerId = String(formData.get("playerId") ?? "").trim();
    const nextProgramId = String(formData.get("nextProgramId") ?? "").trim();
    const changeMode = readChangeMode(formData);
    const effectiveDate = readOptionalDate(formData, "effectiveDate", "Effective date");
    const note = readOptionalString(formData, "note", "Transfer note", 500);

    if (!programId) throw new Error("Program id is required.");
    if (!playerId) throw new Error("Player id is required.");
    if (!nextProgramId) throw new Error("Target Program is required.");
    if (changeMode === "TRANSFER" && !effectiveDate) throw new Error("Effective date is required for transfers.");

    const [player, nextProgram] = await Promise.all([
      prisma.player.findFirst({ where: { id: playerId, deletedAt: null }, select: { id: true, displayName: true, currentProgramId: true } }),
      prisma.program.findFirst({
        where: {
          id: nextProgramId,
          deletedAt: null,
          programRole: ProgramRole.OPERATIONAL,
          ...(changeMode === "TRANSFER" ? { type: ProgramType.SCHOOL } : {}),
        },
        select: { id: true, fullName: true, type: true },
      }),
    ]);

    if (!player) throw new Error("Player does not exist or has been deleted.");
    if (!nextProgram) {
      throw new Error(changeMode === "TRANSFER" ? "Target school does not exist or is not a school program." : "Target program does not exist or has been deleted.");
    }

    if (changeMode === "EDIT") {
      await prisma.player.update({ where: { id: playerId }, data: { currentProgramId: nextProgramId } });
      revalidatePlayerProgramPaths(programId, player, nextProgramId);
      return { ok: true, message: `Current Program set to ${nextProgram.fullName}. No transfer history row was created.` };
    }

    await prisma.$transaction([
      prisma.player.update({ where: { id: playerId }, data: { currentProgramId: nextProgramId } }),
      prisma.playerProgramHistory.create({
        data: {
          playerId,
          fromProgramId: player.currentProgramId,
          toProgramId: nextProgramId,
          effectiveDate,
          note,
          changeType: "TRANSFER"
        }
      })
    ]);

    revalidatePlayerProgramPaths(programId, player, nextProgramId);
    return { ok: true, message: `Transfer recorded to ${nextProgram.fullName}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update current Program." };
  }
}
