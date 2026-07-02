import type { AgeGroup } from "@prisma/client";

import type { ManagedPlayerListFilters } from "@/lib/admin/managed-player-list-query";
import {
  buildManagedPlayerListSqlWhere,
  type ManagedPlayerListSqlRow,
  mapManagedPlayerListSqlRow,
} from "@/lib/admin/managed-player-list-sql";
import { serializeManagedPlayerListRow } from "@/lib/admin/serialize-managed-player";
import { prisma } from "@/lib/prisma";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";

export const ADMIN_PLAYER_PAGE_SIZE = 50;

export type ManagedPlayerListPageResult = {
  players: ReturnType<typeof serializeManagedPlayerListRow>[];
  filteredCount: number;
  totalPlayers: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PLAYER_LIST_CACHE_MS = 5 * 60 * 1000;

let defaultPlayerListPageCache: { value: ManagedPlayerListPageResult; loadedAt: number } | null = null;

export function clearManagedPlayerListPageCache() {
  defaultPlayerListPageCache = null;
  totalPlayersCache = null;
}

function isUnfilteredList(filters: ManagedPlayerListFilters) {
  return (
    !filters.search.trim() &&
    filters.program === "All" &&
    filters.gender === "All" &&
    filters.ageBracket === "All"
  );
}

let totalPlayersCache: { value: number; loadedAt: number } | null = null;
const TOTAL_PLAYERS_CACHE_MS = 5 * 60 * 1000;

async function loadTotalPlayersCount() {
  const now = Date.now();
  if (totalPlayersCache && now - totalPlayersCache.loadedAt < TOTAL_PLAYERS_CACHE_MS) {
    return totalPlayersCache.value;
  }

  const value = await prisma.player.count({ where: { deletedAt: null } });
  totalPlayersCache = { value, loadedAt: now };
  return value;
}

type ManagedPlayerListPageSqlRow = ManagedPlayerListSqlRow & {
  ratings: Array<{
    ageGroup: AgeGroup;
    adjustedRating: string | number;
    verifiedGameCount: number;
  }> | null;
};

async function loadManagedPlayerListSqlPage(
  filters: ManagedPlayerListFilters,
  skip: number,
  pageSize: number,
) {
  const whereSql = buildManagedPlayerListSqlWhere(filters);
  const policyVersionId = getActivePolicyVersionId();

  return prisma.$queryRaw<ManagedPlayerListPageSqlRow[]>`
    WITH page_players AS (
      SELECT
        p.id,
        p."displayName",
        p."firstName",
        p."lastName",
        p.gender,
        p."schoolOverride",
        p."birthDate",
        p."ageGroupOverride",
        p.city,
        p.hometown,
        p.region,
        p."currentProgramId",
        p.position,
        p."heightCm",
        p."classYearOverride",
        p."photoUrl",
        p."commitmentStatus",
        p."committedUniversity",
        pr."fullName" AS "programFullName",
        pr.abbreviation AS "programAbbreviation",
        pr.type AS "programType",
        COUNT(*) OVER()::int AS "filteredCount"
      FROM players p
      LEFT JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
      WHERE ${whereSql}
      ORDER BY p."displayName" ASC, p.id ASC
      LIMIT ${pageSize}
      OFFSET ${skip}
    )
    SELECT
      pp.id,
      pp."displayName",
      pp."firstName",
      pp."lastName",
      pp.gender,
      pp."schoolOverride",
      pp."birthDate",
      pp."ageGroupOverride",
      pp.city,
      pp.hometown,
      pp.region,
      pp."currentProgramId",
      pp.position,
      pp."heightCm",
      pp."classYearOverride",
      pp."photoUrl",
      pp."commitmentStatus",
      pp."committedUniversity",
      pp."programFullName",
      pp."programAbbreviation",
      pp."programType",
      pp."filteredCount",
      COALESCE(page_ratings.ratings, '[]'::json) AS ratings
    FROM page_players pp
    LEFT JOIN (
      SELECT
        prt."playerId",
        json_agg(
          json_build_object(
            'ageGroup', prt."ageGroup",
            'adjustedRating', prt."adjustedRating",
            'verifiedGameCount', prt."verifiedGameCount"
          )
          ORDER BY prt."ageGroup" DESC
        ) AS ratings
      FROM player_ratings prt
      INNER JOIN page_players pp2 ON pp2.id = prt."playerId"
      WHERE prt."policyVersionId" = ${policyVersionId}
      GROUP BY prt."playerId"
    ) page_ratings ON page_ratings."playerId" = pp.id
    ORDER BY pp."displayName" ASC, pp.id ASC
  `;
}

export async function loadManagedPlayerListPage(
  filters: ManagedPlayerListFilters,
  page: number,
  pageSize = ADMIN_PLAYER_PAGE_SIZE,
  options?: { bypassCache?: boolean },
): Promise<ManagedPlayerListPageResult> {
  const requestedPage = Math.max(1, page);
  const isDefaultCacheable =
    requestedPage === 1 &&
    pageSize === ADMIN_PLAYER_PAGE_SIZE &&
    isUnfilteredList(filters);
  const now = Date.now();

  if (
    isDefaultCacheable &&
    !options?.bypassCache &&
    defaultPlayerListPageCache &&
    now - defaultPlayerListPageCache.loadedAt < DEFAULT_PLAYER_LIST_CACHE_MS
  ) {
    return defaultPlayerListPageCache.value;
  }

  const initialSkip = (requestedPage - 1) * pageSize;
  const unfiltered = isUnfilteredList(filters);
  const totalPlayersPromise = unfiltered ? null : loadTotalPlayersCount();

  const rows = await loadManagedPlayerListSqlPage(filters, initialSkip, pageSize);
  const filteredCount = rows[0]?.filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const pageRows =
    safePage === requestedPage
      ? rows
      : await loadManagedPlayerListSqlPage(filters, (safePage - 1) * pageSize, pageSize);

  const totalPlayers = unfiltered ? filteredCount : await totalPlayersPromise!;

  const result: ManagedPlayerListPageResult = {
    players: pageRows.map((row) => {
      const { ratings, ...base } = row;
      return serializeManagedPlayerListRow(
        mapManagedPlayerListSqlRow(
          base,
          (ratings ?? []).map((rating) => ({
            ageGroup: rating.ageGroup,
            adjustedRating: rating.adjustedRating,
            verifiedGameCount: rating.verifiedGameCount,
          })),
        ),
      );
    }),
    filteredCount,
    totalPlayers,
    page: safePage,
    pageSize,
    totalPages,
  };

  if (isDefaultCacheable) {
    defaultPlayerListPageCache = { value: result, loadedAt: now };
  }

  return result;
}
