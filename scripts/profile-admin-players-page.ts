import { ProgramType } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { loadManagedPlayerListPage } from "../src/lib/admin/load-managed-player-list";
import {
  clearAdminPlayerFilterContextCache,
  loadAdminPlayerFilterBundleSql,
  loadAdminPlayerFilterContext,
} from "../src/lib/admin/load-admin-player-filter-context";
import { buildManagedPlayerListSqlWhere } from "../src/lib/admin/managed-player-list-sql";

const filters = { search: "", program: "All", gender: "All", ageBracket: "All" };

async function time<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  return { label, ms: Math.round(performance.now() - start), result };
}

async function legacyFilterQueries() {
  const [programs, overrideRows, clubProgramRows] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null, type: ProgramType.SCHOOL },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.$queryRaw<{ schoolOverride: string }[]>`
      SELECT DISTINCT TRIM(p."schoolOverride") AS "schoolOverride"
      FROM players p
      WHERE p."deletedAt" IS NULL
        AND p."schoolOverride" IS NOT NULL
        AND TRIM(p."schoolOverride") <> ''
      ORDER BY "schoolOverride" ASC
    `,
    prisma.$queryRaw<{ fullName: string }[]>`
      SELECT DISTINCT pr."fullName" AS "fullName"
      FROM players p
      INNER JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
      WHERE p."deletedAt" IS NULL
        AND (p."schoolOverride" IS NULL OR TRIM(p."schoolOverride") = '')
        AND pr.type::text <> ${ProgramType.SCHOOL}
      ORDER BY pr."fullName" ASC
    `,
  ]);
  return { programs, overrideRows, clubProgramRows };
}

async function main() {
  console.log("Admin players page query profile\n");

  const page = await time("player page SQL", () => loadManagedPlayerListPage(filters, 1));
  const legacyFilters = await time("LEGACY filter queries (3 parallel)", legacyFilterQueries);
  const bundle = await time("OPTIMIZED filter bundle SQL (1 query)", loadAdminPlayerFilterBundleSql);

  clearAdminPlayerFilterContextCache();
  const coldContext = await time("OPTIMIZED filter context (cold)", () =>
    loadAdminPlayerFilterContext({ bypassCache: true }),
  );
  const warmContext = await time("OPTIMIZED filter context (warm cache)", () => loadAdminPlayerFilterContext());

  const legacyParallel = await time("LEGACY full page parallel (page + 3 filters)", async () => {
    const [list] = await Promise.all([loadManagedPlayerListPage(filters, 1), legacyFilterQueries()]);
    return list;
  });

  clearAdminPlayerFilterContextCache();
  const optimizedCold = await time("OPTIMIZED full page parallel (page + bundle, cold cache)", async () => {
    const [list] = await Promise.all([loadManagedPlayerListPage(filters, 1), loadAdminPlayerFilterContext()]);
    return list;
  });

  const optimizedWarm = await time("OPTIMIZED full page parallel (page only, warm cache)", async () => {
    await loadAdminPlayerFilterContext();
    return loadManagedPlayerListPage(filters, 1);
  });

  const whereSql = buildManagedPlayerListSqlWhere(filters);
  const explain = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
    `EXPLAIN (FORMAT TEXT)
     SELECT
       (
         SELECT COALESCE(json_agg(json_build_object('id', pr.id, 'fullName', pr."fullName") ORDER BY pr."fullName" ASC), '[]'::json)
         FROM programs pr
         WHERE pr."deletedAt" IS NULL AND pr.type = 'SCHOOL'::"ProgramType"
       ) AS programs,
       (
         SELECT COALESCE(json_agg(override_label ORDER BY override_label ASC), '[]'::json)
         FROM (
           SELECT DISTINCT TRIM(p."schoolOverride") AS override_label
           FROM players p
           WHERE p."deletedAt" IS NULL AND p."schoolOverride" IS NOT NULL AND TRIM(p."schoolOverride") <> ''
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
             AND pr.type::text <> 'SCHOOL'
         ) club_rows
       ) AS "clubPrograms"`,
  );

  console.table([
    { step: page.label, ms: page.ms, rows: page.result.players.length },
    { step: legacyFilters.label, ms: legacyFilters.ms, rows: legacyFilters.result.programs.length },
    { step: bundle.label, ms: bundle.ms, rows: bundle.result.programs.length },
    { step: coldContext.label, ms: coldContext.ms, rows: coldContext.result.schoolOptions.length },
    { step: warmContext.label, ms: warmContext.ms, rows: warmContext.result.schoolOptions.length },
    { step: legacyParallel.label, ms: legacyParallel.ms, rows: legacyParallel.result.players.length },
    { step: optimizedCold.label, ms: optimizedCold.ms, rows: optimizedCold.result.players.length },
    { step: optimizedWarm.label, ms: optimizedWarm.ms, rows: optimizedWarm.result.players.length },
  ]);

  console.log("\nFilter bundle SQL plan:");
  for (const row of explain) {
    console.log(row["QUERY PLAN"]);
  }
}

main().finally(() => prisma.$disconnect());
