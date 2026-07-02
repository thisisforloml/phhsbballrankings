import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/prisma";
import { buildManagedPlayerListSqlWhere } from "@/lib/admin/managed-player-list-sql";

async function time(label: string, fn: () => Promise<unknown>) {
  const start = performance.now();
  const result = await fn();
  const rows = Array.isArray(result) ? result.length : result;
  console.log(`${label}: ${Math.round(performance.now() - start)}ms`, rows);
}

async function main() {
  const whereSql = buildManagedPlayerListSqlWhere({
    search: "",
    program: "All",
    gender: "All",
    ageBracket: "All",
  });

  await time("sql page + count over", () =>
    prisma.$queryRaw`
      SELECT
        p.id,
        p."displayName",
        COUNT(*) OVER()::int AS "filteredCount"
      FROM players p
      LEFT JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
      WHERE ${whereSql}
      ORDER BY p."displayName" ASC, p.id ASC
      LIMIT 50
      OFFSET 0
    `,
  );

  await time("parallel sql page + school", () =>
    Promise.all([
      prisma.$queryRaw`
        SELECT p.id, COUNT(*) OVER()::int AS "filteredCount"
        FROM players p
        LEFT JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
        LEFT JOIN LATERAL (
          SELECT COALESCE(json_agg(json_build_object('ageGroup', prt."ageGroup") ORDER BY prt."ageGroup" DESC), '[]'::json) AS ratings
          FROM player_ratings prt WHERE prt."playerId" = p.id
        ) ratings ON TRUE
        WHERE ${whereSql}
        ORDER BY p."displayName" ASC, p.id ASC
        LIMIT 50 OFFSET 0
      `,
      prisma.$queryRaw`
        SELECT DISTINCT COALESCE(NULLIF(TRIM(p."schoolOverride"), ''), pr."fullName", 'Program pending') AS label
        FROM players p
        LEFT JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
        ORDER BY label ASC
      `,
    ]),
  );
}

main().finally(() => prisma.$disconnect());
