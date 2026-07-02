import { ProgramType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminPlayerSchoolProgram = {
  id: string;
  fullName: string;
};

type FilterBundleSqlRow = {
  programs: AdminPlayerSchoolProgram[];
  schoolOverrides: string[];
  clubPrograms: string[];
};

type CachedFilterContext = {
  programs: AdminPlayerSchoolProgram[];
  schoolOptions: string[];
  loadedAt: number;
};

let filterContextCache: CachedFilterContext | null = null;
const FILTER_CONTEXT_CACHE_MS = 5 * 60 * 1000;

export function buildSchoolFilterOptions(bundle: FilterBundleSqlRow): string[] {
  const labels = new Set<string>();
  for (const program of bundle.programs) {
    labels.add(program.fullName);
  }
  for (const override of bundle.schoolOverrides) {
    if (override) labels.add(override);
  }
  for (const clubProgram of bundle.clubPrograms) {
    if (clubProgram) labels.add(clubProgram);
  }
  labels.add("Program pending");
  return [...labels].sort((left, right) => left.localeCompare(right));
}

export async function loadAdminPlayerFilterBundleSql(): Promise<FilterBundleSqlRow> {
  const rows = await prisma.$queryRaw<FilterBundleSqlRow[]>`
    SELECT
      (
        SELECT COALESCE(
          json_agg(
            json_build_object('id', pr.id, 'fullName', pr."fullName")
            ORDER BY pr."fullName" ASC
          ),
          '[]'::json
        )
        FROM programs pr
        WHERE pr."deletedAt" IS NULL
          AND pr.type = ${ProgramType.SCHOOL}::"ProgramType"
      ) AS programs,
      (
        SELECT COALESCE(json_agg(override_label ORDER BY override_label ASC), '[]'::json)
        FROM (
          SELECT DISTINCT TRIM(p."schoolOverride") AS override_label
          FROM players p
          WHERE p."deletedAt" IS NULL
            AND p."schoolOverride" IS NOT NULL
            AND TRIM(p."schoolOverride") <> ''
        ) override_rows
      ) AS "schoolOverrides",
      (
        SELECT COALESCE(json_agg(club_label ORDER BY club_label ASC), '[]'::json)
        FROM (
          SELECT DISTINCT pr."fullName" AS club_label
          FROM players p
          INNER JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
          WHERE p."deletedAt" IS NULL
            AND (p."schoolOverride" IS NULL OR TRIM(p."schoolOverride") = '')
            AND pr.type::text <> ${ProgramType.SCHOOL}
        ) club_rows
      ) AS "clubPrograms"
  `;

  return (
    rows[0] ?? {
      programs: [],
      schoolOverrides: [],
      clubPrograms: [],
    }
  );
}

export async function loadAdminPlayerFilterContext(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    filterContextCache &&
    now - filterContextCache.loadedAt < FILTER_CONTEXT_CACHE_MS
  ) {
    return {
      programs: filterContextCache.programs,
      schoolOptions: filterContextCache.schoolOptions,
    };
  }

  const bundle = await loadAdminPlayerFilterBundleSql();
  const schoolOptions = buildSchoolFilterOptions(bundle);
  filterContextCache = {
    programs: bundle.programs,
    schoolOptions,
    loadedAt: now,
  };

  return {
    programs: bundle.programs,
    schoolOptions,
  };
}

export function clearAdminPlayerFilterContextCache() {
  filterContextCache = null;
}
