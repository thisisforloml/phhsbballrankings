import { type Prisma,ProgramType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { resolveAutoRosterAssignment } from "@/lib/admin/auto-roster-assignment";
import { invalidateAdminProgramMembershipCaches, invalidateAdminTeamsCaches } from "@/lib/admin/invalidate-admin-caches";
import {
  resolveCurrentSchoolId,
  validateSchoolAssignmentInput,
} from "@/lib/admin/validate-school-assignment";
import { slugify } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { revalidatePublicRankingSurfaces } from "@/lib/public-cache-revalidation";

type SchoolChangeMode = "ASSIGN" | "TRANSFER";

type SchoolAssignmentInput = {
  mode: SchoolChangeMode;
  playerId: string;
  nextProgramId: string;
  effectiveDate: Date;
  note?: string | null;
  manualRoster?: { teamId: string; seasonId: string } | null;
  expectedFromProgramId?: string | null;
};

async function resolveRosterTarget(
  playerId: string,
  nextProgramId: string,
  manualRoster: { teamId: string; seasonId: string } | null | undefined
) {
  if (manualRoster) {
    const [team, season] = await Promise.all([
      prisma.team.findFirst({
        where: { id: manualRoster.teamId, programId: nextProgramId, deletedAt: null },
        select: { id: true, name: true }
      }),
      prisma.season.findFirst({
        where: { id: manualRoster.seasonId, deletedAt: null },
        select: { id: true, name: true }
      })
    ]);
    if (!team || !season) throw new Error("Manual roster target is invalid.");
    return { teamId: team.id, seasonId: season.id, teamName: team.name, seasonName: season.name };
  }

  const auto = await resolveAutoRosterAssignment({ playerId, programId: nextProgramId });
  if (auto.ok) return auto.match;
  if (auto.reason === "AMBIGUOUS" && auto.candidates?.length) {
    throw new Error(`Multiple teams match this age bracket. Pick: ${auto.candidates.map((c) => c.teamName).join(", ")}`);
  }
  return null;
}

export async function updatePlayerSchoolAssignment(input: SchoolAssignmentInput) {
  const [player, nextProgram] = await Promise.all([
    prisma.player.findFirst({
      where: { id: input.playerId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        currentProgramId: true,
        currentProgram: { select: { id: true, fullName: true, type: true } }
      }
    }),
    prisma.program.findFirst({
      where: { id: input.nextProgramId, deletedAt: null, type: ProgramType.SCHOOL },
      select: { id: true, fullName: true }
    })
  ]);

  if (!player) throw new Error("Player does not exist or has been deleted.");
  if (!nextProgram) throw new Error("Target school does not exist or is not a school program.");

  const currentSchoolId = resolveCurrentSchoolId(
    player.currentProgramId,
    player.currentProgram?.type,
  );

  const validationError = validateSchoolAssignmentInput({
    mode: input.mode,
    currentSchoolId,
    nextProgramId: input.nextProgramId,
    expectedFromProgramId: input.expectedFromProgramId,
  });
  if (validationError) throw new Error(validationError);

  const rosterTarget = await resolveRosterTarget(input.playerId, input.nextProgramId, input.manualRoster);

  const activeRosterRows = await prisma.playerTeamSeason.findMany({
    where: {
      playerId: input.playerId,
      deletedAt: null,
      OR: [{ endsOn: null }, { endsOn: { gt: input.effectiveDate } }]
    },
    select: {
      id: true,
      team: { select: { programId: true, program: { select: { type: true } } } }
    }
  });

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.player.update({
      where: { id: input.playerId },
      data: { currentProgramId: input.nextProgramId }
    }),
    prisma.playerProgramHistory.create({
      data: {
        playerId: input.playerId,
        fromProgramId: input.mode === "TRANSFER" ? currentSchoolId : null,
        toProgramId: input.nextProgramId,
        effectiveDate: input.effectiveDate,
        note: input.note ?? null,
        changeType: input.mode
      }
    })
  ];

  if (input.mode === "TRANSFER") {
    for (const roster of activeRosterRows) {
      const programId = roster.team.programId;
      const programType = roster.team.program?.type;
      if (programType === ProgramType.SCHOOL && programId && programId !== input.nextProgramId) {
        writes.push(
          prisma.playerTeamSeason.update({
            where: { id: roster.id },
            data: { endsOn: input.effectiveDate }
          })
        );
      }
    }
  }

  if (rosterTarget) {
    const rosterReason =
      input.mode === "TRANSFER"
        ? "Admin school transfer auto roster assignment."
        : "Admin school assign auto roster assignment.";
    writes.push(
      prisma.playerTeamSeason.upsert({
        where: { playerId_seasonId: { playerId: input.playerId, seasonId: rosterTarget.seasonId } },
        create: {
          playerId: input.playerId,
          teamId: rosterTarget.teamId,
          seasonId: rosterTarget.seasonId,
          adminOverride: true,
          overrideReason: rosterReason,
          startsOn: input.effectiveDate,
          endsOn: null,
          deletedAt: null
        },
        update: {
          teamId: rosterTarget.teamId,
          adminOverride: true,
          overrideReason: rosterReason,
          startsOn: input.effectiveDate,
          endsOn: null,
          deletedAt: null
        }
      })
    );
  }

  await prisma.$transaction(writes);

  invalidateAdminProgramMembershipCaches();
  invalidateAdminTeamsCaches();
  revalidatePath("/admin/players");
  revalidatePath("/admin/programs");
  revalidatePublicRankingSurfaces();
  revalidatePath(`/players/${slugify(player.displayName)}`);

  return {
    programName: nextProgram.fullName,
    rosterTarget,
    mode: input.mode
  };
}

/** @deprecated Use updatePlayerSchoolAssignment with mode TRANSFER */
export async function transferPlayerToProgram(input: {
  playerId: string;
  nextProgramId: string;
  effectiveDate: Date;
  note?: string | null;
  manualRoster?: { teamId: string; seasonId: string } | null;
}) {
  return updatePlayerSchoolAssignment({
    mode: "TRANSFER",
    playerId: input.playerId,
    nextProgramId: input.nextProgramId,
    effectiveDate: input.effectiveDate,
    note: input.note,
    manualRoster: input.manualRoster
  });
}
