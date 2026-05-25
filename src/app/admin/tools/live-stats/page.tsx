import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { LiveStatsClient } from "@/app/portal/live-stats/LiveStatsClient";

type PageProps = {
  searchParams?: {
    error?: string;
  };
};

export const metadata = {
  title: "Admin Manual Stats Entry",
  description: "Admin-owned manual game stats entry."
};

export default async function AdminLiveStatsPage({ searchParams }: PageProps) {
  await requireAdminUser();
  const players = await prisma.player.findMany({
    where: { deletedAt: null },
    select: { id: true, displayName: true, gender: true, region: true, city: true },
    orderBy: { displayName: "asc" },
    take: 500
  });

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="manualStats" />
        <LiveStatsClient
          embedded
          showAdminHome
          submissionsHref="/admin/tools/submissions"
          errorMessage={searchParams?.error ? decodeURIComponent(searchParams.error) : undefined}
          playerSuggestions={players}
        />
      </div>
    </main>
  );
}
