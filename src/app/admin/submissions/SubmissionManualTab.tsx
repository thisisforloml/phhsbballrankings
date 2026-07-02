import { LiveStatsClient } from "@/app/(site)/portal/live-stats/LiveStatsClient";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export async function SubmissionManualTab({ errorMessage }: { errorMessage?: string }) {
  await requireAdminUser();
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true, gender: true, region: true, city: true },
    orderBy: { displayName: "asc" },
    take: 500
  });

  return (
    <LiveStatsClient
      embedded
      showAdminHome={false}
      submissionsHref="/admin/submissions?tab=manual"
      errorMessage={errorMessage}
      playerSuggestions={players}
    />
  );
}
