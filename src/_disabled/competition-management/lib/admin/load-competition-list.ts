import type { ManagedCompetition } from "@/lib/admin/competition-management/types";
import { prisma } from "@/lib/prisma";

const CACHE_MS = 5 * 60 * 1000;

let cache: { value: ManagedCompetition[]; loadedAt: number } | null = null;

export function clearCompetitionListCache() {
  cache = null;
}

export async function loadCompetitionList(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (!options?.bypassCache && cache && now - cache.loadedAt < CACHE_MS) {
    return cache.value;
  }

  const rows = await prisma.league.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          seasons: { where: { deletedAt: null } },
        },
      },
      seasons: {
        where: { deletedAt: null },
        select: {
          _count: {
            select: {
              games: { where: { deletedAt: null } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const value: ManagedCompetition[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    organization: row.organizerName,
    seasonType: row.seasonType,
    country: row.country,
    region: row.region,
    sport: row.sport,
    defaultAgeGroups: row.defaultAgeGroups.length ? row.defaultAgeGroups : [row.ageGroup],
    defaultGenders: row.defaultGenders,
    status: row.status,
    logoUrl: row.logoUrl,
    website: row.website,
    notes: row.adminNotes,
    tier: row.tier,
    ageGroup: row.ageGroup,
    seasonCount: row._count.seasons,
    gameCount: row.seasons.reduce((sum, season) => sum + season._count.games, 0),
  }));

  cache = { value, loadedAt: now };
  return value;
}
