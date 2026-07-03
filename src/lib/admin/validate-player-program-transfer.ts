import { ProgramRole } from "@prisma/client";

export type PlayerProgramTransferValidationInput = {
  currentProgramId: string | null;
  destinationProgramId: string;
  destinationExists: boolean;
  destinationArchived: boolean;
  destinationProgramRole: ProgramRole | null;
};

export function validatePlayerProgramTransfer(input: PlayerProgramTransferValidationInput): string | null {
  if (!input.currentProgramId) {
    return "Player has no current program. Use Assign instead of Transfer.";
  }

  if (!input.destinationProgramId) {
    return "Destination program is required.";
  }

  if (!input.destinationExists || input.destinationArchived) {
    return "Destination program does not exist or has been archived.";
  }

  if (input.destinationProgramRole !== ProgramRole.OPERATIONAL) {
    return "Destination program must be operational. Group programs cannot receive player transfers.";
  }

  if (input.currentProgramId === input.destinationProgramId) {
    return "Destination program must be different from the current program.";
  }

  return null;
}
