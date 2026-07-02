import { prisma } from "@/lib/prisma";

const LEAGUES_LIST_CACHE_MS = 5 * 60 * 1000;

type LeaguesListRow = Awaited<ReturnType<typeof loadAdminLeaguesListUncached>>[number];

export type AdminLeagueListRow = LeaguesListRow;

let leaguesListCache: { value: LeaguesListRow[]; loadedAt: number } | null = null;

export function clearAdminLeaguesListCache() {
  leaguesListCache = null;
}

async function loadAdminLeaguesListUncached() {
  return prisma.league.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          seasons: true,
        },
      },
      seasons: {
        where: { deletedAt: null },
        include: {
          _count: {
            select: { games: true },
          },
        },
        orderBy: { seasonYear: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function loadAdminLeaguesList(options?: { bypassCache?: boolean }): Promise<LeaguesListRow[]> {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    leaguesListCache &&
    now - leaguesListCache.loadedAt < LEAGUES_LIST_CACHE_MS
  ) {
    return leaguesListCache.value;
  }

  const value = await loadAdminLeaguesListUncached();
  leaguesListCache = { value, loadedAt: now };
  return value;
}
