import type { ProgramType } from "@prisma/client";

export type ProgramListRow = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  city: string | null;
  region: string | null;
  teamCount: number;
  possibleDuplicateContextGroups: number;
  derivedPlayerCount: number;
  officialGameCount: number;
};
