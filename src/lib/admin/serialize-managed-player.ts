import { AgeGroup, type ProgramType } from "@prisma/client";
import type { ManagedPlayer } from "@/components/admin/AdminPlayerEditPanel";
import { resolveAdminPlayerStats } from "@/lib/admin/resolve-admin-player-stats";
import { getAgeBracketAsOfMarch31, getClassYear } from "@/lib/ranking-eligibility";
import { resolvePrimaryRankingAffiliation } from "@/lib/player-display-affiliation";

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
  currentProgram: {
    fullName: string;
    abbreviation: string | null;
    type: ProgramType;
  } | null;
  currentRatings: Array<{ ageGroup: AgeGroup; adjustedRating: unknown; verifiedGameCount: number }>;
  gameStats: Array<{
    team: { name: string; program: { fullName: string; abbreviation: string | null; type: ProgramType } | null };
    game: { id: string; gameDate: Date | null };
  }>;
};

export function serializeManagedPlayer(player: PlayerForSerialize): ManagedPlayer {
  const computedAgeBracket = getAgeBracketAsOfMarch31(player.birthDate);
  const { rating, verifiedGameCount } = resolveAdminPlayerStats(player);
  const schoolDisplay = resolvePrimaryRankingAffiliation({
    schoolOverride: player.schoolOverride,
    currentProgram: player.currentProgram,
    gameStats: player.gameStats,
  });

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

export const managedPlayerInclude = {
  currentProgram: true,
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
