import { ProfileClaimStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { requirePortalUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { getActivePolicyVersionId } from "@/lib/ratings/player-rating-query";
import { selectPublicPlayerRating } from "@/lib/ratings/resolve-public-player-rating";

import { ClaimantProfileClient } from "./ClaimantProfileClient";

export const metadata = {
  title: "My Profile | Portal",
  description: "Edit claimed player profile."
};

export default async function PortalMyProfilePage({
  searchParams
}: {
  searchParams?: { playerId?: string };
}) {
  await requirePortalUser();
  const playerId = searchParams?.playerId?.trim();
  if (!playerId) notFound();

  const [player, claim] = await Promise.all([
    prisma.player.findFirst({
      where: { id: playerId, deletedAt: null },
      include: {
        claimProfile: true,
        currentRatings: { where: { policyVersionId: getActivePolicyVersionId() } },
        gameStats: {
          where: { deletedAt: null },
          include: {
            game: {
              select: {
                gameDate: true,
                season: { select: { league: { select: { ageGroup: true } } } }
              }
            }
          },
          orderBy: { game: { gameDate: "desc" } },
          take: 1
        }
      }
    }),
    prisma.profileClaim.findFirst({
      where: { playerId, status: ProfileClaimStatus.APPROVED },
      select: { id: true }
    })
  ]);

  if (!player || !claim) notFound();

  const rating = selectPublicPlayerRating(player);

  return (
    <ClaimantProfileClient
      player={{
        id: player.id,
        displayName: player.displayName,
        firstName: player.firstName,
        lastName: player.lastName,
        hometown: player.hometown ?? player.city,
        region: player.region,
        position: player.position,
        contactEmail: player.claimProfile?.contactEmail ?? null,
        rating: rating ? Number(rating.adjustedRating) : null,
        verifiedGameCount: rating?.verifiedGameCount ?? null
      }}
    />
  );
}
