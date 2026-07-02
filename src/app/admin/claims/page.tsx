import { ProfileClaimStatus } from "@prisma/client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { slugify } from "@/lib/format";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

import { ClaimsAdminClient } from "./ClaimsAdminClient";

export const metadata = {
  title: "Profile Claims | Admin",
  description: "Review and manage player profile claims."
};

function serializeClaim(claim: {
  id: string;
  status: ProfileClaimStatus;
  claimantName: string;
  relationship: string;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  createdAt: Date;
  player: { displayName: string; id: string };
}) {
  return {
    id: claim.id,
    playerId: claim.player.id,
    status: claim.status,
    claimantName: claim.claimantName,
    relationship: claim.relationship,
    contactEmail: claim.contactEmail,
    contactPhone: claim.contactPhone,
    message: claim.message,
    createdAt: claim.createdAt.toISOString().slice(0, 10),
    playerName: claim.player.displayName,
    playerHref: `/players/${slugify(claim.player.displayName)}`
  };
}

export default async function AdminClaimsPage() {
  const [, claims] = await Promise.all([
    requireAdminUser(),
    prisma.profileClaim.findMany({
    include: { player: { select: { displayName: true, id: true } } },
    orderBy: { createdAt: "desc" },
    take: 200
    }),
  ]);

  const pending = claims.filter((claim) => claim.status === ProfileClaimStatus.PENDING).map(serializeClaim);
  const approved = claims.filter((claim) => claim.status === ProfileClaimStatus.APPROVED).map(serializeClaim);

  return (
    <>
      <AdminPageHeader title="Profile Claims" statusBadge={`${pending.length} pending`} />
      <ClaimsAdminClient pending={pending} approved={approved} />
    </>
  );
}
