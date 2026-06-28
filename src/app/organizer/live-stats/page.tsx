import { UserRole } from "@prisma/client";
import { requireOrganizerUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { LiveStatsClient } from "@/app/portal/live-stats/LiveStatsClient";

type PageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function OrganizerLiveStatsPage({ searchParams }: PageProps) {
  const user = await requireOrganizerUser();
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true, gender: true, region: true, city: true },
    orderBy: { displayName: "asc" },
    take: 500
  });

  return (
    <LiveStatsClient
      showAdminHome={user.role === UserRole.ADMIN}
      errorMessage={searchParams?.error ? decodeURIComponent(searchParams.error) : undefined}
      playerSuggestions={players}
    />
  );
}