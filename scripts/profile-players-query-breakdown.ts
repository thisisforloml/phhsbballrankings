import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/prisma";
import { managedPlayerListSelect } from "@/lib/admin/serialize-managed-player";
import { buildManagedPlayerListWhere } from "@/lib/admin/managed-player-list-query";

async function time(label: string, fn: () => Promise<unknown>) {
  const start = performance.now();
  const result = await fn();
  const rows = Array.isArray(result) ? result.length : result;
  console.log(`${label}: ${Math.round(performance.now() - start)}ms`, rows);
}

async function main() {
  const where = buildManagedPlayerListWhere({
    search: "",
    program: "All",
    gender: "All",
    ageBracket: "All",
  });

  await time("count all", () => prisma.player.count({ where: { deletedAt: null } }));
  await time(
    "school distinct sql",
    () =>
      prisma.$queryRaw<{ label: string }[]>`
        SELECT DISTINCT
          COALESCE(
            NULLIF(TRIM(p."schoolOverride"), ''),
            pr."fullName",
            'Program pending'
          ) AS label
        FROM players p
        LEFT JOIN programs pr ON pr.id = p."currentProgramId" AND pr."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
        ORDER BY label ASC
      `,
  );
  await time("findMany 50", () =>
    prisma.player.findMany({
      where,
      select: managedPlayerListSelect,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 50,
    }),
  );
  await time("findMany 50 lean", () =>
    prisma.player.findMany({
      where,
      select: { id: true, displayName: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 50,
    }),
  );

  const ids = (
    await prisma.player.findMany({
      where,
      select: { id: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 50,
    })
  ).map((row) => row.id);

  await time("findMany by 50 ids full select", () =>
    prisma.player.findMany({
      where: { id: { in: ids } },
      select: managedPlayerListSelect,
    }),
  );

  const listSelectWithoutRatings = {
    id: true,
    displayName: true,
    firstName: true,
    lastName: true,
    gender: true,
    schoolOverride: true,
    birthDate: true,
    ageGroupOverride: true,
    city: true,
    hometown: true,
    region: true,
    currentProgramId: true,
    position: true,
    heightCm: true,
    classYearOverride: true,
    photoUrl: true,
    commitmentStatus: true,
    committedUniversity: true,
    currentProgram: {
      select: { fullName: true, abbreviation: true, type: true },
    },
  } as const;

  await time("findMany by 50 ids without ratings", () =>
    prisma.player.findMany({
      where: { id: { in: ids } },
      select: listSelectWithoutRatings,
    }),
  );

  await time("ratings for 50 players", () =>
    prisma.playerRating.findMany({
      where: { playerId: { in: ids } },
      orderBy: { ageGroup: "desc" },
      select: { playerId: true, ageGroup: true, adjustedRating: true, verifiedGameCount: true },
    }),
  );
}

main()
  .finally(() => prisma.$disconnect());
