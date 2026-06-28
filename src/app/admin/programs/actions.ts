"use server";

import { ProgramType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { resolveAutoRosterAssignment } from "@/lib/admin/auto-roster-assignment";
import { slugify } from "@/lib/format";

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

function parseAliases(value: string | null) {
  if (!value) return [];
  return Array.from(new Set(value.split(/\r?\n|,/).map((alias) => alias.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
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
  revalidatePath("/admin/programs");
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath(`/admin/programs/${nextProgramId}`);
  if (player.currentProgramId) revalidatePath(`/admin/programs/${player.currentProgramId}`);
  revalidatePath("/admin/players");
  revalidatePath("/rankings");
  revalidatePath(`/players/${slugify(player.displayName)}`);
  revalidatePath(`/players/${player.id}`);
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
    const aliases = parseAliases(readOptionalString(formData, "aliases", "Aliases", 4000));

    await prisma.program.update({
      where: { id: programId },
      data: { fullName, abbreviation, type, city, region, aliases }
    });

    revalidatePath("/admin/programs");
    revalidatePath(`/admin/programs/${programId}`);
    revalidatePath("/admin/teams");
    revalidatePath("/teams");
    revalidatePath("/rankings");
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

    const name = readRequiredString(formData, "name", "Team / Moniker Name", 120);
    await prisma.team.update({ where: { id: teamId }, data: { name } });

    revalidatePath("/admin/programs");
    revalidatePath(`/admin/programs/${programId}`);
    revalidatePath("/admin/teams");
    revalidatePath("/teams");
    revalidatePath("/rankings");
    return { ok: true, message: "Team / moniker updated." };
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
          ...(changeMode === "TRANSFER" ? { type: ProgramType.SCHOOL } : {})
        },
        select: { id: true, fullName: true, type: true }
      })
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
