import { assertActivePlayer,assertAssignableProgram } from "@/lib/admin/player-program-assignment";
import { validatePlayerProgramTransfer } from "@/lib/admin/validate-player-program-transfer";
import { prisma } from "@/lib/prisma";

export type TransferPlayerProgramInput = {
  playerId: string;
  destinationProgramId: string;
  expectedFromProgramId: string;
  effectiveDate: Date;
  reason: string;
};

export async function transferPlayerToProgram(input: TransferPlayerProgramInput) {
  const player = await assertActivePlayer(input.playerId);

  if (!player.currentProgramId) {
    throw new Error("Player has no current program. Use Assign instead of Transfer.");
  }

  if (player.currentProgramId !== input.expectedFromProgramId) {
    throw new Error("Current program no longer matches. Refresh the page and try again.");
  }

  const destination = await prisma.program.findFirst({
    where: { id: input.destinationProgramId },
    select: { id: true, fullName: true, programRole: true, deletedAt: true },
  });

  const validationError = validatePlayerProgramTransfer({
    currentProgramId: player.currentProgramId,
    destinationProgramId: input.destinationProgramId,
    destinationExists: Boolean(destination),
    destinationArchived: Boolean(destination?.deletedAt),
    destinationProgramRole: destination?.programRole ?? null,
  });

  if (validationError) {
    throw new Error(validationError);
  }

  const assignableProgram = await assertAssignableProgram(input.destinationProgramId);

  const result = await prisma.$transaction(async (tx) => {
    const updatedPlayer = await tx.player.update({
      where: { id: input.playerId },
      data: { currentProgramId: input.destinationProgramId },
      select: { id: true, displayName: true, currentProgramId: true },
    });

    const history = await tx.playerProgramHistory.create({
      data: {
        playerId: input.playerId,
        fromProgramId: player.currentProgramId,
        toProgramId: input.destinationProgramId,
        effectiveDate: input.effectiveDate,
        note: input.reason,
        changeType: "TRANSFER",
      },
      select: { id: true },
    });

    return { updatedPlayer, history, program: assignableProgram };
  });

  return {
    player: result.updatedPlayer,
    historyId: result.history.id,
    program: result.program,
    previousProgramId: player.currentProgramId,
  };
}
