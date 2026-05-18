const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const groups = [
  { group: 1, names: ['Audrey Biongco', 'Audrey Biongcog'] },
  { group: 2, names: ['John Addatu'] },
  { group: 3, names: ['John dexter Santos', 'John Dexter Santos'] },
  { group: 4, names: ['Rhon-j Matias', 'Rhon-J Matias'] },
  { group: 5, names: ['Sam Hall'] }
];

async function playerDetails(player) {
  const [gameStats, performanceScores, playerRatings, snapshotRows] = await Promise.all([
    prisma.gameStat.findMany({
      where: { playerId: player.id },
      include: {
        team: { select: { name: true } },
        game: {
          include: {
            season: { include: { league: { select: { name: true } } } }
          }
        }
      }
    }),
    prisma.gamePerformanceScore.count({ where: { playerId: player.id } }),
    prisma.playerRating.findMany({ where: { playerId: player.id }, select: { id: true, ageGroup: true, adjustedRating: true, verifiedGameCount: true } }),
    prisma.rankingSnapshotRow.count({ where: { playerId: player.id } })
  ]);

  const teams = [...new Set(gameStats.map((stat) => stat.team?.name).filter(Boolean))].sort();
  const leagueSeasons = [...new Set(gameStats.map((stat) => `${stat.game.season.league.name} / ${stat.game.season.name}`).filter(Boolean))].sort();

  return {
    playerId: player.id,
    displayName: player.displayName,
    gender: player.gender,
    deletedAt: player.deletedAt ? player.deletedAt.toISOString() : null,
    gameStatCount: gameStats.length,
    gamePerformanceScoreCount: performanceScores,
    playerRatingCount: playerRatings.length,
    playerRatings: playerRatings.map((rating) => ({
      id: rating.id,
      ageGroup: rating.ageGroup,
      adjustedRating: Number(rating.adjustedRating),
      verifiedGameCount: rating.verifiedGameCount
    })),
    rankingSnapshotRowCount: snapshotRows,
    teamsPlayedFor: teams,
    leaguesSeasons: leagueSeasons,
    gameIds: gameStats.map((stat) => stat.gameId)
  };
}

function recommend(details) {
  const active = details.filter((item) => item.deletedAt === null);
  const withStats = active.filter((item) => item.gameStatCount > 0);
  const canonical = [...active].sort((a, b) => {
    if (b.gameStatCount !== a.gameStatCount) return b.gameStatCount - a.gameStatCount;
    if (b.playerRatingCount !== a.playerRatingCount) return b.playerRatingCount - a.playerRatingCount;
    return b.displayName.length - a.displayName.length;
  })[0] ?? details[0] ?? null;
  const sameGameConflict = active.some((left, i) => active.slice(i + 1).some((right) => left.gameIds.some((id) => right.gameIds.includes(id))));

  let riskLevel = 'low';
  let recommendedAction = 'merge';
  const reasons = [];

  if (active.length < 2) {
    riskLevel = 'low';
    recommendedAction = 'skip';
    reasons.push('Fewer than two active records found.');
  }
  if (sameGameConflict) {
    riskLevel = 'high';
    recommendedAction = 'manual review';
    reasons.push('Suspected duplicates appear in the same game.');
  }
  if (withStats.length > 1 && !sameGameConflict) {
    riskLevel = 'medium';
    reasons.push('Multiple active records have game stats but no same-game conflict.');
  }
  if (withStats.length <= 1 && active.length >= 2) {
    riskLevel = 'low';
    reasons.push('Only one active record has game stats.');
  }

  return {
    recommendedCanonicalPlayer: canonical ? { playerId: canonical.playerId, displayName: canonical.displayName } : null,
    sameGameConflict,
    riskLevel,
    recommendedAction,
    reason: reasons.join(' ') || 'Records appear to be likely name variants.'
  };
}

async function main() {
  const reports = [];

  for (const group of groups) {
    let players;
    if (group.names.length === 1) {
      players = await prisma.player.findMany({
        where: { displayName: group.names[0] },
        orderBy: [{ deletedAt: 'asc' }, { createdAt: 'asc' }]
      });
    } else {
      players = await prisma.player.findMany({
        where: { displayName: { in: group.names } },
        orderBy: [{ displayName: 'asc' }, { deletedAt: 'asc' }, { createdAt: 'asc' }]
      });
    }

    const details = await Promise.all(players.map(playerDetails));
    const byName = Object.fromEntries(group.names.map((name) => [name, details.filter((player) => player.displayName === name)]));
    const rec = recommend(details);

    reports.push({
      group: group.group,
      suspectedNames: group.names,
      recordsExist: Object.fromEntries(group.names.map((name) => [name, (byName[name] ?? []).length > 0])),
      playerRecords: details.map(({ gameIds, ...rest }) => rest),
      suspectedDuplicatePlayersAppearInSameGame: rec.sameGameConflict,
      recommendedCanonicalPlayer: rec.recommendedCanonicalPlayer,
      riskLevel: rec.riskLevel,
      recommendedAction: rec.recommendedAction,
      reason: rec.reason
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    groupsChecked: reports.length,
    reports
  };

  const reportPath = path.join(process.cwd(), 'scripts', 'reports', 'duplicate-player-diagnostic-round-2.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(output, null, 2), 'utf8');

  const summary = {
    reportPath,
    groupsChecked: reports.length,
    mergeRecommended: reports.filter((item) => item.recommendedAction === 'merge').length,
    manualReviewRecommended: reports.filter((item) => item.recommendedAction === 'manual review').length,
    skipped: reports.filter((item) => item.recommendedAction === 'skip').length,
    groupSummaries: reports.map((item) => ({
      group: item.group,
      suspectedNames: item.suspectedNames,
      activeRecords: item.playerRecords.filter((player) => player.deletedAt === null).length,
      recommendedCanonicalPlayer: item.recommendedCanonicalPlayer,
      sameGameConflict: item.suspectedDuplicatePlayersAppearInSameGame,
      riskLevel: item.riskLevel,
      recommendedAction: item.recommendedAction
    }))
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());