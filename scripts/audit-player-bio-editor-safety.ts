import { prisma } from "../src/lib/prisma";

async function main() {
  const [
    playerCount,
    gameCount,
    gameStatCount,
    gamePerformanceScoreCount,
    playerRatingCount,
    rankingSnapshotCount,
    rankingSnapshotRowCount,
    leagueCount,
    seasonCount,
    playersWithPosition,
    playersWithHeightCm,
    playersWithBirthDate,
    playersWithPhotoUrl
  ] = await Promise.all([
    prisma.player.count(),
    prisma.game.count(),
    prisma.gameStat.count(),
    prisma.gamePerformanceScore.count(),
    prisma.playerRating.count(),
    prisma.rankingSnapshot.count(),
    prisma.rankingSnapshotRow.count(),
    prisma.league.count(),
    prisma.season.count(),
    prisma.player.count({ where: { position: { not: null } } }),
    prisma.player.count({ where: { heightCm: { not: null } } }),
    prisma.player.count({ where: { birthDate: { not: null } } }),
    prisma.player.count({ where: { photoUrl: { not: null } } })
  ]);

  console.log(
    JSON.stringify(
      {
        counts: {
          Player: playerCount,
          Game: gameCount,
          GameStat: gameStatCount,
          GamePerformanceScore: gamePerformanceScoreCount,
          PlayerRating: playerRatingCount,
          RankingSnapshot: rankingSnapshotCount,
          RankingSnapshotRow: rankingSnapshotRowCount,
          League: leagueCount,
          Season: seasonCount
        },
        playerBioCounts: {
          playersWithNonNullPosition: playersWithPosition,
          playersWithNonNullHeightCm: playersWithHeightCm,
          playersWithNonNullBirthDate: playersWithBirthDate,
          playersWithNonNullPhotoUrl: playersWithPhotoUrl
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });