import { ProgramRole } from "@prisma/client";

import { assertOperationalProgramRole, operationalProgramWhere } from "@/lib/admin/program-role";
import { prisma } from "@/lib/prisma";

export async function assertActivePlayer(playerId: string) {
  const player = await prisma.player.findFirst({
    where: { id: playerId, deletedAt: null },
    select: { id: true, displayName: true, currentProgramId: true },
  });
  if (!player) {
    throw new Error("Player does not exist or has been deleted.");
  }
  return player;
}

export async function assertAssignableProgram(programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null, ...operationalProgramWhere },
    select: { id: true, fullName: true, programRole: true },
  });
  assertOperationalProgramRole(program, "player assignment");
  return program!;
}

export async function assignPlayerToProgram(playerId: string, programId: string) {
  const [player, program] = await Promise.all([assertActivePlayer(playerId), assertAssignableProgram(programId)]);

  if (player.currentProgramId === programId) {
    return { player, program, action: "already_linked" as const, previousProgramId: player.currentProgramId };
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: { currentProgramId: programId },
    select: { id: true, displayName: true, currentProgramId: true },
  });

  return { player: updated, program, action: "assigned" as const, previousProgramId: player.currentProgramId };
}

export async function removePlayerFromProgram(playerId: string) {
  const player = await assertActivePlayer(playerId);

  if (!player.currentProgramId) {
    throw new Error("Player is not assigned to a program.");
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data: { currentProgramId: null },
    select: { id: true, displayName: true, currentProgramId: true },
  });

  return { player: updated, previousProgramId: player.currentProgramId };
}

export function isOperationalProgramRole(programRole: ProgramRole | null | undefined) {
  return programRole === ProgramRole.OPERATIONAL;
}
