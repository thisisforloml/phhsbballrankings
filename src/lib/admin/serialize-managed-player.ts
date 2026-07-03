import { AgeGroup, type ProgramType } from "@prisma/client";

import type { ManagedPlayer } from "@/components/admin/AdminPlayerEditPanel";
import { resolveAdminPlayerStats } from "@/lib/admin/resolve-admin-player-stats";
import { resolvePrimaryRankingAffiliation } from "@/lib/player-display-affiliation";
import { getAgeBracketAsOfMarch31, getClassYear } from "@/lib/ranking-eligibility";

type ProgramRef = {
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  programRole?: "GROUP" | "OPERATIONAL";
  parentProgram?: {
    fullName: string;
    programRole: "GROUP" | "OPERATIONAL";
  } | null;
};

type PlayerForSerialize = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  gender: "BOYS" | "GIRLS";
  schoolOverride: string | null;
  birthDate: Date | null;
  ageGroupOverride: string | null;
  city: string;
  hometown: string | null;
  region: string;
  currentProgramId: string | null;
  position: string | null;
  heightCm: number | null;
  classYearOverride: number | null;
  photoUrl: string | null;
  commitmentStatus: "UNDECLARED" | "COMMITTED";
  committedUniversity: string | null;
  currentProgram: ProgramRef | null;
  currentRatings: Array<{ ageGroup: AgeGroup; adjustedRating: unknown; verifiedGameCount: number }>;
  gameStats: Array<{
    team: { name: string; program: { fullName: string; abbreviation: string | null; type: ProgramType } | null };
    game: { id: string; gameDate: Date | null };
  }>;
};

export const managedPlayerListSelect = {
  id: true,
  displayName: true,
  firstName: true,
  lastName: true,
  gender: true,
  schoolOverride: true,
  birthDate: true,
  ageGroupOverride: true,
  city: true,
  hometown: true,
  region: true,
  currentProgramId: true,
  position: true,
  heightCm: true,
  classYearOverride: true,
  photoUrl: true,
  commitmentStatus: true,
  committedUniversity: true,
  currentProgram: {
    select: {
      fullName: true,
      abbreviation: true,
      type: true,
      programRole: true,
      parentProgram: {
        select: {
          fullName: true,
          programRole: true,
        },
      },
    },
  },
  currentRatings: {
    orderBy: { ageGroup: "desc" as const },
    select: {
      ageGroup: true,
      adjustedRating: true,
      verifiedGameCount: true,
    },
  },
} as const;

export type PlayerListRowRecord = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  gender: "BOYS" | "GIRLS";
  schoolOverride: string | null;
  birthDate: Date | null;
  ageGroupOverride: string | null;
  city: string;
  hometown: string | null;
  region: string;
  currentProgramId: string | null;
  position: string | null;
  heightCm: number | null;
  classYearOverride: number | null;
  photoUrl: string | null;
  commitmentStatus: "UNDECLARED" | "COMMITTED";
  committedUniversity: string | null;
  currentProgram: PlayerForSerialize["currentProgram"];
  currentRatings: PlayerForSerialize["currentRatings"];
};

export function serializeManagedPlayer(player: PlayerForSerialize): ManagedPlayer {
  const computedAgeBracket = getAgeBracketAsOfMarch31(player.birthDate);
  const { rating, verifiedGameCount } = resolveAdminPlayerStats(player);
  const schoolDisplay = resolvePrimaryRankingAffiliation({
    schoolOverride: player.schoolOverride,
    currentProgram: player.currentProgram,
    gameStats: player.gameStats,
  });
  const currentProgramFullName =
    player.currentProgram &&
    (player.currentProgram.programRole === undefined || player.currentProgram.programRole === "OPERATIONAL")
      ? player.currentProgram.fullName
      : null;
  const parentGroupProgramFullName =
    player.currentProgram?.parentProgram?.programRole === "GROUP"
      ? player.currentProgram.parentProgram.fullName
      : null;
  const currentTeamName = resolveCurrentTeamName(player.gameStats);

  return {
    id: player.id,
    displayName: player.displayName,
    firstName: player.firstName ?? player.displayName,
    lastName: player.lastName ?? player.displayName,
    gender: player.gender,
    school: schoolDisplay,
    schoolOverride: player.schoolOverride,
    computedAgeBracket,
    ageGroupOverride: player.ageGroupOverride,
    displayAgeBracket: player.ageGroupOverride || computedAgeBracket || "Unknown",
    hometown: player.hometown ?? player.city,
    region: player.region,
    currentProgramId: player.currentProgramId,
    currentProgramFullName,
    parentGroupProgramFullName,
    currentTeamName,
    position: player.position,
    heightCm: player.heightCm,
    birthDate: player.birthDate ? player.birthDate.toISOString().slice(0, 10) : "",
    calculatedClassYear: getClassYear(player.birthDate),
    classYearOverride: player.classYearOverride,
    photoUrl: player.photoUrl,
    rating,
    verifiedGameCount,
    commitmentStatus: player.commitmentStatus ?? "UNDECLARED",
    committedUniversity: player.committedUniversity ?? null,
  };
}

function resolveCurrentTeamName(
  gameStats: Array<{ team: { name: string }; game: { gameDate: Date | null } }>,
): string | null {
  if (!gameStats.length) return null;

  const latest = [...gameStats].sort((left, right) => {
    const leftTime = left.game.gameDate?.getTime() ?? 0;
    const rightTime = right.game.gameDate?.getTime() ?? 0;
    return rightTime - leftTime;
  })[0];

  return latest?.team.name ?? null;
}

/** List row: affiliation from override/currentProgram only; ratings from PlayerRating. */
export function serializeManagedPlayerListRow(player: PlayerListRowRecord): ManagedPlayer {
  return serializeManagedPlayer({ ...player, gameStats: [] });
}

export const managedPlayerInclude = {
  currentProgram: {
    select: {
      id: true,
      fullName: true,
      abbreviation: true,
      type: true,
      programRole: true,
      parentProgram: {
        select: {
          fullName: true,
          programRole: true,
        },
      },
    },
  },
  currentRatings: {
    orderBy: { ageGroup: "desc" as const },
  },
  gameStats: {
    where: { deletedAt: null },
    include: {
      team: { select: { name: true, program: { select: { fullName: true, abbreviation: true, type: true } } } },
      game: { select: { id: true, gameDate: true } },
    },
    orderBy: { game: { gameDate: "desc" as const } },
    take: 40,
  },
} as const;
