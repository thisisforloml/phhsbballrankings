import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Leagues | Admin",
  description: "League and season management."
};

export default async function AdminLeaguesPage() {
  await requireAdminUser();

  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          seasons: true
        }
      },
      seasons: {
        where: { deletedAt: null },
        include: {
          _count: {
            select: { games: true }
          }
        },
        orderBy: { seasonYear: "desc" },
        take: 1
      }
    },
    orderBy: { name: "asc" }
  });

  return (
    <>
      <AdminPageHeader title="Leagues" statusBadge={`${leagues.length} leagues`} />
      <section className="overflow-x-auto border border-surface-200 bg-white shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-navy-950 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white">
            <tr>
              <th className="px-4 py-2.5">League</th>
              <th className="px-4 py-2.5">Age group</th>
              <th className="px-4 py-2.5 text-center">Tier</th>
              <th className="px-4 py-2.5 text-center">Seasons</th>
              <th className="px-4 py-2.5 text-center">Games</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {leagues.map((league) => {
              const latestSeason = league.seasons[0];
              const gameCount = latestSeason?._count.games ?? 0;
              return (
                <tr key={league.id}>
                  <td className="px-4 py-3 font-semibold text-navy-900">
                    <Link href={`/admin/leagues/${league.id}`} className="hover:text-orange-700">
                      {league.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{league.ageGroup}</td>
                  <td className="px-4 py-3 text-center text-ink-700">{league.tier}</td>
                  <td className="px-4 py-3 text-center text-ink-700">{league._count.seasons}</td>
                  <td className="px-4 py-3 text-center text-ink-700">{gameCount}</td>
                </tr>
              );
            })}
            {!leagues.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">
                  No leagues yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
