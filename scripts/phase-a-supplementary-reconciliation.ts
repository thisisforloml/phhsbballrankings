/**
 * Phase A supplementary read-only reconciliation (DB-level, no submission rawText).
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const imported = await prisma.submission.findMany({
    where: { status: "IMPORTED", deletedAt: null },
    select: {
      id: true,
      title: true,
      rawText: true,
      parsedPreview: true,
      storedFilePath: true,
      importedAt: true,
      leagueName: true,
      type: true,
    },
  });

  const rawTextEmpty = imported.filter((s) => !s.rawText?.trim()).length;
  const hasPreview = imported.filter((s) => s.parsedPreview != null).length;
  const hasStoredFile = imported.filter((s) => s.storedFilePath).length;
  const hasImportedAt = imported.filter((s) => s.importedAt).length;

  const [
    activePlayers,
    distinctPlayersWithStats,
    playersWithoutStats,
    activeGames,
    activeGameStats,
    activeGps,
    playerRatings,
    snapshotRows,
    snapshots,
  ] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.gameStat.findMany({
      where: { deletedAt: null },
      distinct: ["playerId"],
      select: { playerId: true },
    }),
    prisma.player.count({
      where: { deletedAt: null, gameStats: { none: { deletedAt: null } } },
    }),
    prisma.game.count({ where: { deletedAt: null } }),
    prisma.gameStat.count({ where: { deletedAt: null } }),
    prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
    prisma.playerRating.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.rankingSnapshot.count(),
  ]);

  const gamesByVerification = await prisma.game.groupBy({
    by: ["verificationStatus"],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  const seasonCoverage = await prisma.$queryRaw<
    Array<{
      league_name: string;
      age_group: string;
      season_name: string;
      games: number;
      game_stats: number;
      distinct_players: number;
    }>
  >`
    SELECT
      l.name AS league_name,
      l."ageGroup"::text AS age_group,
      s.name AS season_name,
      COUNT(DISTINCT g.id)::int AS games,
      COUNT(gs.id)::int AS game_stats,
      COUNT(DISTINCT gs."playerId")::int AS distinct_players
    FROM leagues l
    JOIN seasons s ON s."leagueId" = l.id AND s."deletedAt" IS NULL
    LEFT JOIN games g ON g."seasonId" = s.id AND g."deletedAt" IS NULL
    LEFT JOIN game_stats gs ON gs."gameId" = g.id AND gs."deletedAt" IS NULL
    WHERE l."deletedAt" IS NULL
    GROUP BY l.name, l."ageGroup", s.name
    HAVING COUNT(DISTINCT g.id) > 0
    ORDER BY game_stats DESC, games DESC
  `;

  const sourceBuckets = await prisma.$queryRaw<
    Array<{ source_bucket: string; games: number; game_stats: number }>
  >`
    SELECT
      CASE
        WHEN g."sourceName" ILIKE '%StatsHub URL import%' THEN 'statshub_url_import'
        WHEN g."sourceName" ILIKE '%spreadsheet%' OR g."sourceName" ILIKE '%PYBC%' THEN 'spreadsheet_upload'
        WHEN g."sourceName" ILIKE '%UAAP%' OR g."sourceName" ILIKE '%Season 88%' THEN 'uaap_batch'
        ELSE 'other'
      END AS source_bucket,
      COUNT(DISTINCT g.id)::int AS games,
      COUNT(gs.id)::int AS game_stats
    FROM games g
    LEFT JOIN game_stats gs ON gs."gameId" = g.id AND gs."deletedAt" IS NULL
    WHERE g."deletedAt" IS NULL
    GROUP BY 1
    ORDER BY game_stats DESC
  `;

  const statsWithoutGps = await prisma.gameStat.count({
    where: { deletedAt: null, performanceScore: null },
  });

  const softDeleted = {
    players: (await prisma.player.count()) - activePlayers,
    games: (await prisma.game.count()) - activeGames,
    gameStats: (await prisma.gameStat.count()) - activeGameStats,
  };

  console.log(
    JSON.stringify(
      {
        submissionEvidence: {
          totalImported: imported.length,
          rawTextEmpty,
          rawTextPresent: imported.length - rawTextEmpty,
          hasParsedPreview: hasPreview,
          hasStoredFile,
          hasImportedAt,
          importedAtNull: imported.length - hasImportedAt,
        },
        globalReconciliation: {
          activePlayers,
          distinctPlayersWithActiveGameStats: distinctPlayersWithStats.length,
          activePlayersWithoutGameStats: playersWithoutStats,
          activeGames,
          activeGameStats,
          activeGps,
          gameStatToGpsDelta: activeGameStats - activeGps,
          statsWithoutGps,
          playerRatings,
          rankingSnapshots: snapshots,
          rankingSnapshotRows: snapshotRows,
          operatorCampaignNote:
            "~3,000+ player rows reported — compare to activeGameStats (stat lines) and distinctPlayersWithActiveGameStats (unique players)",
        },
        softDeleted,
        gamesByVerification,
        seasonCoverage,
        sourceBuckets,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
