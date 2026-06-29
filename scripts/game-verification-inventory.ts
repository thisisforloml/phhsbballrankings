/**
 * TR-3.5 read-only game verification inventory — no writes.
 * Usage: npx tsx scripts/game-verification-inventory.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "../src/lib/competition-naming";

function classifyLeague(name: string): string {
  const n = name.toUpperCase();
  if (isPybcCompetitionName(normalizeCompetitionDisplayName(name))) return "PYBC";
  if (/\bUAAP\b/.test(n)) return "UAAP";
  if (/\bNCAA\b/.test(n)) return "NCAA";
  if (/\bSTALLION\b/.test(n)) return "Stallion";
  return "Other";
}

async function main() {
  const games = await prisma.game.findMany({
    where: { deletedAt: null },
    include: {
      season: { include: { league: true } },
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } }
    }
  });

  const leagues = await prisma.league.findMany({ where: { deletedAt: null } });

  const byStatus: Record<string, number> = {};
  const byStatusSource: Record<string, Record<string, number>> = {};
  const byLeagueBucket: Record<string, Record<string, number>> = {};
  const byLeagueBucketUnique: Record<string, Record<string, Set<string>>> = {};
  const bySubmissionType: Record<string, number> = {};

  for (const g of games) {
    byStatus[g.verificationStatus] = (byStatus[g.verificationStatus] ?? 0) + 1;
    const src = g.submissionType ?? "UNKNOWN";
    if (!byStatusSource[g.verificationStatus]) byStatusSource[g.verificationStatus] = {};
    byStatusSource[g.verificationStatus][src] = (byStatusSource[g.verificationStatus][src] ?? 0) + 1;
    bySubmissionType[src] = (bySubmissionType[src] ?? 0) + 1;

    const bucket = classifyLeague(g.season.league.name);
    if (!byLeagueBucket[bucket]) byLeagueBucket[bucket] = {};
    byLeagueBucket[bucket][g.verificationStatus] = (byLeagueBucket[bucket][g.verificationStatus] ?? 0) + 1;

    if (!byLeagueBucketUnique[bucket]) byLeagueBucketUnique[bucket] = {};
    if (!byLeagueBucketUnique[bucket][g.verificationStatus]) byLeagueBucketUnique[bucket][g.verificationStatus] = new Set();
    byLeagueBucketUnique[bucket][g.verificationStatus].add(g.gameNumber ?? g.id);
  }

  const leagueVerification = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    ageGroup: l.ageGroup,
    tier: l.tier,
    verificationStatus: l.verificationStatus,
    bucket: classifyLeague(l.name)
  }));

  const gpsCount = await prisma.gamePerformanceScore.count({ where: { deletedAt: null } });
  const gpsByGameStatus = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT g."verificationStatus" AS status, COUNT(*)::bigint AS count
    FROM game_performance_scores gps
    JOIN games g ON g.id = gps."gameId"
    WHERE gps."deletedAt" IS NULL AND g."deletedAt" IS NULL
    GROUP BY g."verificationStatus"
  `;

  const submissions = await prisma.submission.findMany({
    where: { deletedAt: null },
    select: { id: true, status: true, type: true, leagueName: true, createdAt: true }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    totalActiveGames: games.length,
    byStatus,
    byStatusSource,
    bySubmissionType,
    byLeagueBucket,
    byLeagueBucketUniqueGameNumbers: Object.fromEntries(
      Object.entries(byLeagueBucketUnique).map(([bucket, statuses]) => [
        bucket,
        Object.fromEntries(
          Object.entries(statuses).map(([st, set]) => [st, set.size])
        )
      ])
    ),
    leagueVerification,
    gpsTotal: gpsCount,
    gpsByGameVerificationStatus: gpsByGameStatus.map((r) => ({
      status: r.status,
      count: Number(r.count)
    })),
    submissions: {
      total: submissions.length,
      byStatus: submissions.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      }, {})
    },
    policyScenarios: {
      verifiedOnly: {
        gameRows: games.filter((g) => g.verificationStatus === VerificationStatus.VERIFIED).length,
        uniquePybc: byLeagueBucketUnique.PYBC?.[VerificationStatus.VERIFIED]?.size ?? 0
      },
      submittedPlusVerified: {
        gameRows: games.filter((g) =>
          g.verificationStatus === VerificationStatus.VERIFIED ||
          g.verificationStatus === VerificationStatus.SUBMITTED
        ).length,
        uniquePybc:
          new Set(
            games
              .filter(
                (g) =>
                  classifyLeague(g.season.league.name) === "PYBC" &&
                  (g.verificationStatus === VerificationStatus.VERIFIED ||
                    g.verificationStatus === VerificationStatus.SUBMITTED)
              )
              .map((g) => g.gameNumber ?? g.id)
          ).size
      }
    }
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "game-verification-inventory-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
