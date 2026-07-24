import { ProgramRole } from "@prisma/client";

export const OPERATIONAL_PROGRAM_ROLE = ProgramRole.OPERATIONAL;
export const GROUP_PROGRAM_ROLE = ProgramRole.GROUP;

export const operationalProgramWhere = {
  programRole: OPERATIONAL_PROGRAM_ROLE,
} as const;

export function readProgramRoleFromForm(formData: FormData): ProgramRole {
  const value = String(formData.get("programRole") ?? ProgramRole.OPERATIONAL).trim().toUpperCase();
  if (value !== ProgramRole.OPERATIONAL && value !== ProgramRole.GROUP) {
    throw new Error("Program role must be Operational or Group.");
  }
  return value as ProgramRole;
}

export function validateProgramCreateInput(input: {
  programRole: ProgramRole;
  parentProgramId?: string | null;
  teamCount?: number;
  playerCount?: number;
}) {
  if (input.programRole !== GROUP_PROGRAM_ROLE) return;

  if (input.parentProgramId) {
    throw new Error("Organizations cannot belong to another organization.");
  }
  if ((input.teamCount ?? 0) > 0) {
    throw new Error("Group programs cannot own teams.");
  }
  if ((input.playerCount ?? 0) > 0) {
    throw new Error("Group programs cannot own players.");
  }
}

export function assertOperationalProgramRole(
  program: { fullName?: string; programRole: ProgramRole } | null | undefined,
  context: "team assignment" | "player assignment" | "import",
) {
  if (!program) {
    throw new Error("Program does not exist or has been archived.");
  }
  if (program.programRole !== OPERATIONAL_PROGRAM_ROLE) {
    const label = program.fullName ? `"${program.fullName}"` : "This program";
    if (context === "import") {
      throw new Error(`${label} is a group container and cannot be used for imports.`);
    }
    if (context === "player assignment") {
      throw new Error(`${label} is a group container and cannot be assigned to players.`);
    }
    throw new Error(`${label} is a group container and cannot own teams.`);
  }
}

export function assertImportProgramReusable(program: { fullName: string; programRole: ProgramRole }) {
  assertOperationalProgramRole(program, "import");
}
