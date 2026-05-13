import { AgeGroup } from "@prisma/client";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
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
      currentRatings: {
        where: {
          ageGroup: AgeGroup.U19
        },
        take: 1
      }
    },
    orderBy: {
      displayName: "asc"
    }
  });

  const serializedPlayers: ManagedPlayer[] = players.map((player) => {
    const rating = player.currentRatings[0] ?? null;

    return {
      id: player.id,
      displayName: player.displayName,
      firstName: player.firstName,
      lastName: player.lastName,
      gender: player.gender,
      city: player.city,
      region: player.region,
      position: player.position,
      heightCm: player.heightCm,
      birthDate: player.birthDate ? player.birthDate.toISOString().slice(0, 10) : "",
      photoUrl: player.photoUrl,
      rating: rating ? Number(rating.adjustedRating) : null,
      verifiedGameCount: rating?.verifiedGameCount ?? null
    };
  });

  return <PlayerManagementClient players={serializedPlayers} />;
}