import { ProgramType } from "@prisma/client";

export type SchoolChangeMode = "ASSIGN" | "TRANSFER";

export function resolveCurrentSchoolId(
  currentProgramId: string | null,
  currentProgramType: ProgramType | null | undefined,
): string | null {
  return currentProgramType === ProgramType.SCHOOL ? currentProgramId : null;
}

export function validateSchoolAssignmentInput(input: {
  mode: SchoolChangeMode;
  currentSchoolId: string | null;
  nextProgramId: string;
  expectedFromProgramId?: string | null;
}): string | null {
  if (input.mode === "ASSIGN") {
    if (input.currentSchoolId) {
      return "Player already has a school. Use Transfer to change schools.";
    }
    return null;
  }

  if (!input.currentSchoolId) {
    return "Player has no current school to transfer from. Use Assign instead.";
  }
  if (input.expectedFromProgramId && input.expectedFromProgramId !== input.currentSchoolId) {
    return "Origin school no longer matches. Refresh the page and try again.";
  }
  if (input.currentSchoolId === input.nextProgramId) {
    return "Target school must be different from the origin school.";
  }
  return null;
}
