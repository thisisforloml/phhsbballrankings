import type { ProgramRole, ProgramType } from "@prisma/client";
import { ProgramRole as ProgramRoleEnum } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertOperationalProgramRole,
  operationalProgramWhere,
  validateProgramCreateInput,
} from "./program-role";

export type ProgramFormInput = {
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  programRole?: ProgramRole;
  city: string | null;
  region: string | null;
};

export type ProgramTeamOption = {
  id: string;
  name: string;
  city: string;
  region: string;
  programId: string | null;
  programFullName: string | null;
};

export async function loadActiveProgramOptions() {
  return prisma.program.findMany({
    where: { deletedAt: null, ...operationalProgramWhere },
    select: { id: true, fullName: true, abbreviation: true, type: true, programRole: true },
    orderBy: { fullName: "asc" },
  });
}

export async function loadProgramTeamOptions() {
  return prisma.team.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      programId: true,
      program: { select: { fullName: true } },
    },
    orderBy: { name: "asc" },
  });
}

export function serializeProgramTeamOptions(
  teams: Awaited<ReturnType<typeof loadProgramTeamOptions>>,
): ProgramTeamOption[] {
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    city: team.city,
    region: team.region,
    programId: team.programId,
    programFullName: team.program?.fullName ?? null,
  }));
}

export async function createProgramRecord(input: ProgramFormInput) {
  const programRole = input.programRole ?? ProgramRoleEnum.OPERATIONAL;
  validateProgramCreateInput({ programRole, parentProgramId: null });

  const duplicate = await prisma.program.findFirst({
    where: { deletedAt: null, fullName: { equals: input.fullName, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("A program with this full name already exists.");
  }

  return prisma.program.create({
    data: {
      fullName: input.fullName,
      abbreviation: input.abbreviation,
      type: input.type,
      programRole,
      city: input.city,
      region: input.region,
    },
  });
}

export async function archiveProgramRecord(programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!program) {
    throw new Error("Program does not exist or is already archived.");
  }

  await prisma.program.update({
    where: { id: programId },
    data: { deletedAt: new Date() },
  });

  return program;
}

async function assertActiveProgram(programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null },
    select: { id: true, fullName: true, programRole: true },
  });
  assertOperationalProgramRole(program, "team assignment");
  return program!;
}

async function assertActiveTeam(teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    select: { id: true, name: true, programId: true },
  });
  if (!team) {
    throw new Error("Team does not exist or has been deleted.");
  }
  return team;
}

export async function assignTeamToProgram(teamId: string, programId: string) {
  const [team, program] = await Promise.all([assertActiveTeam(teamId), assertActiveProgram(programId)]);

  if (team.programId === programId) {
    return { team, program, action: "already_linked" as const };
  }

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { programId },
    select: { id: true, name: true, programId: true },
  });

  return { team: updated, program, action: "assigned" as const, previousProgramId: team.programId };
}

export async function removeTeamFromProgram(teamId: string, programId?: string) {
  const team = await assertActiveTeam(teamId);

  if (!team.programId) {
    throw new Error("Team is not assigned to a program.");
  }

  if (programId && team.programId !== programId) {
    throw new Error("Team does not belong to this program.");
  }

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { programId: null },
    select: { id: true, name: true, programId: true },
  });

  return { team: updated, previousProgramId: team.programId };
}

export async function moveTeamBetweenPrograms(teamId: string, fromProgramId: string, toProgramId: string) {
  if (fromProgramId === toProgramId) {
    throw new Error("Source and target programs must be different.");
  }

  const team = await assertActiveTeam(teamId);
  if (team.programId !== fromProgramId) {
    throw new Error("Team is not assigned to the source program.");
  }

  const program = await assertActiveProgram(toProgramId);
  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { programId: toProgramId },
    select: { id: true, name: true, programId: true },
  });

  return { team: updated, program, previousProgramId: fromProgramId };
}

export async function createProgramAndAssignTeam(input: ProgramFormInput, teamId: string) {
  const program = await createProgramRecord(input);
  const assignment = await assignTeamToProgram(teamId, program.id);
  return { program, assignment };
}

export async function createTeamRecord(input: {
  name: string;
  city: string;
  region: string;
  programId?: string | null;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Team name is required.");
  }
  if (name.length > 120) {
    throw new Error("Team name must be 120 characters or fewer.");
  }

  const city = input.city.trim();
  const region = input.region.trim();
  if (!city) {
    throw new Error("City is required.");
  }
  if (!region) {
    throw new Error("Region is required.");
  }
  if (city.length > 100) {
    throw new Error("City must be 100 characters or fewer.");
  }
  if (region.length > 100) {
    throw new Error("Region must be 100 characters or fewer.");
  }

  if (input.programId) {
    await assertActiveProgram(input.programId);
  }

  return prisma.team.create({
    data: {
      name,
      city,
      region,
      programId: input.programId ?? null,
    },
    select: { id: true, name: true, programId: true },
  });
}
