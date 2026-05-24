import { AgeGroup } from "@prisma/client";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { getAgeBracketAsOfMarch31, getClassYear } from "@/lib/ranking-eligibility";
import { getUaapSchoolDisplayName } from "@/lib/uaap-school-display";
import { PlayerManagementClient, type ManagedPlayer } from "./PlayerManagementClient";

export const metadata = {
  title: "Player Management - Admin Portal",
  description: "Search and edit existing player bio fields."
};

export default async function AdminPlayersPage() {
  await requireAdminUser();

  const players = await prisma.player.findMany({
    where: {
      deletedAt: null
    },
    include: {
      currentProgram: true,
      currentRatings: {
        where: {
          ageGroup: AgeGroup.U19
        },
        take: 1
      },
      gameStats: {
        where: { deletedAt: null },
        include: { team: { select: { name: true, program: { select: { fullName: true } } } } },
        orderBy: { game: { gameDate: "desc" } },
        take: 1
      }
    },
    orderBy: {
      displayName: "asc"
    }
  });

  const serializedPlayers: ManagedPlayer[] = players.map((player) => {
    const rating = player.currentRatings[0] ?? null;
    const computedAgeBracket = getAgeBracketAsOfMarch31(player.birthDate);
    const schoolDisplay = player.currentProgram?.fullName || player.schoolOverride?.trim() || player.gameStats[0]?.team.program?.fullName || getUaapSchoolDisplayName(player.gameStats[0]?.team.name);

    return {
      id: player.id,
      displayName: player.displayName,
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      school: schoolDisplay,
      schoolOverride: player.schoolOverride,
      computedAgeBracket,
      ageGroupOverride: player.ageGroupOverride,
      displayAgeBracket: player.ageGroupOverride || computedAgeBracket || "Unknown",
      city: player.city,
      region: player.region,
      position: player.position,
      heightCm: player.heightCm,
      birthDate: player.birthDate ? player.birthDate.toISOString().slice(0, 10) : "",
      calculatedClassYear: getClassYear(player.birthDate),
      classYearOverride: player.classYearOverride,
      photoUrl: player.photoUrl,
      rating: rating ? Number(rating.adjustedRating) : null,
      verifiedGameCount: rating?.verifiedGameCount ?? null
    };
  });

  return <PlayerManagementClient players={serializedPlayers} />;
}
