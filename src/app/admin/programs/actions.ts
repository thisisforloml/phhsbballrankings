"use server";

import { ProgramType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

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
