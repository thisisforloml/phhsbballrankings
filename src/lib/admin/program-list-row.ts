import type { ProgramRole, ProgramType } from "@prisma/client";

export type ProgramListRow = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  programRole: ProgramRole;  city: string | null;
  region: string | null;
  parentProgramId: string | null;
  parentProgramFullName: string | null;
  childProgramCount: number;
  teamCount: number;
  possibleDuplicateContextGroups: number;
  derivedPlayerCount: number;
  officialGameCount: number;
};
