/**
 * Canonicalize BistrotLeCoucou → Bistrot Le Coucou (program + team identity only).
 *
 * Usage:
 *   npx tsx scripts/canonicalize-bistrot-le-coucou.ts           # pre-merge report only
 *   npx tsx scripts/canonicalize-bistrot-le-coucou.ts --execute # backup + execute + validate
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

const CANONICAL_PROGRAM_ID = "97062465-a28b-4097-a9fb-0a6c451c5cc4";
const DUPLICATE_PROGRAM_ID = "65cde8f7-e861-4c4f-b3a2-165778b5eab1";
const CANONICAL_TEAM_ID = "ff96c815-68e3-4402-804a-4d49c91313ed";
const DUPLICATE_TEAM_ID = "8f0ddc95-b993-4fbf-a903-ce53ab2bbaad";

const REPORT_DIR = join(process.cwd(), "scripts", "reports");

type ProtectedCounts = {
  activeGameStats: number;
  gamePerformanceScores: number;
  playerRatings: number;
  rankingSnapshots: number;
  rankingSnapshotRows: number;
};

async function protectedCounts(): Promise<ProtectedCounts> {
  const [activeGameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows] =
    await Promise.all([
      prisma.gameStat.count({ where: { deletedAt: null } }),
      prisma.gamePerformanceScore.count({ where: { deletedAt: null } }),
      prisma.playerRating.count(),
      prisma.rankingSnapshot.count(),
      prisma.rankingSnapshotRow.count()
    ]);
  return { activeGameStats, gamePerformanceScores, playerRatings, rankingSnapshots, rankingSnapshotRows };
}

async function countTeamUsage(teamId: string) {
  const [activeGames, activeGameStats, rosterSeasons, externalAliases, teamRatings] = await Promise.all([
    prisma.game.count({
      where: {
        deletedAt: null,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
      }
    }),
    prisma.gameStat.count({ where: { deletedAt: null, teamId } }),
    prisma.playerTeamSeason.count({ where: { teamId } }),
    prisma.teamExternalAlias.count({ where: { teamId } }),
    prisma.teamRating.count({ where: { teamId } })
  ]);
  return { activeGames, activeGameStats, rosterSeasons, externalAliases, teamRatings };
}

async function loadProgram(programId: string) {
  return prisma.program.findUnique({
    where: { id: programId },
    select: {
      id: true,
      fullName: true,
      deletedAt: true,
      teams: { where: { deletedAt: null }, select: { id: true, name: true } },
      currentPlayers: { where: { deletedAt: null }, select: { id: true, displayName: true } }
    }
  });
}

async function loadTeam(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      programId: true,
      deletedAt: true,
      program: { select: { id: true, fullName: true } }
    }
  });
}

async function loadDuplicateGames(teamId: string) {
  return prisma.game.findMany({
    where: {
      deletedAt: null,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
    },
    include: {
      season: { include: { league: { select: { id: true, name: true, ageGroup: true } } } },
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      stats: {
        where: { deletedAt: null, teamId },
        select: { id: true, playerId: true, points: true, rebounds: true, assists: true }
      }
    },
    orderBy: [{ gameDate: "asc" }, { gameNumber: "asc" }]
  });
}

async function buildPreMergeReport() {
  const [canonicalProgram, duplicateProgram, canonicalTeam, duplicateTeam, counts] = await Promise.all([
    loadProgram(CANONICAL_PROGRAM_ID),
    loadProgram(DUPLICATE_PROGRAM_ID),
    loadTeam(CANONICAL_TEAM_ID),
    loadTeam(DUPLICATE_TEAM_ID),
    protectedCounts()
  ]);

  if (!canonicalProgram || !duplicateProgram || !canonicalTeam || !duplicateTeam) {
    throw new Error("Canonical or duplicate Program/Team not found.");
  }
  if (canonicalProgram.deletedAt || duplicateProgram.deletedAt) {
    throw new Error("Canonical or duplicate Program is soft-deleted.");
  }
  if (canonicalTeam.deletedAt || duplicateTeam.deletedAt) {
    throw new Error("Canonical or duplicate Team is soft-deleted.");
  }

  const [canonicalUsage, duplicateUsage, duplicateGames] = await Promise.all([
    countTeamUsage(CANONICAL_TEAM_ID),
    countTeamUsage(DUPLICATE_TEAM_ID),
    loadDuplicateGames(DUPLICATE_TEAM_ID)
  ]);

  const duplicateGameStats = duplicateGames.flatMap((game) => game.stats);
  const duplicateGameStatIds = duplicateGameStats.map((stat) => stat.id);

  const duplicatePlayersOnProgram = await prisma.player.findMany({
    where: { deletedAt: null, currentProgramId: DUPLICATE_PROGRAM_ID },
    select: { id: true, displayName: true }
  });

  return {
    generatedAt: new Date().toISOString(),
    phase: "pre-merge-backup",
    mode: "read-only",
    canonical: {
      program: { id: canonicalProgram.id, fullName: canonicalProgram.fullName },
      team: { id: canonicalTeam.id, name: canonicalTeam.name, programId: canonicalTeam.programId },
      usage: canonicalUsage
    },
    duplicate: {
      program: { id: duplicateProgram.id, fullName: duplicateProgram.fullName },
      team: { id: duplicateTeam.id, name: duplicateTeam.name, programId: duplicateTeam.programId },
      usage: duplicateUsage,
      teamsUnderProgram: duplicateProgram.teams,
      playersWithCurrentProgram: duplicatePlayersOnProgram
    },
    affectedRecords: {
      games: duplicateGames.map((game) => ({
        id: game.id,
        gameNumber: game.gameNumber,
        gameDate: game.gameDate.toISOString(),
        league: game.season.league.name,
        season: game.season.name,
        ageGroup: game.season.league.ageGroup,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeamName: game.homeTeam.name,
        awayTeamName: game.awayTeam.name,
        gameStatCount: game.stats.length
      })),
      gameStatIds: duplicateGameStatIds,
      gameStatCount: duplicateGameStatIds.length,
      gameCount: duplicateGames.length,
      rosterSeasons: duplicateUsage.rosterSeasons,
      externalAliases: duplicateUsage.externalAliases,
      teamRatings: duplicateUsage.teamRatings,
      playersToReassignProgram: duplicatePlayersOnProgram
    },
    protectedCountsBefore: counts,
    rollbackInstructions: {
      summary: "Restore teamId/homeTeamId/awayTeamId/currentProgramId from this backup JSON; un-soft-delete duplicate entities if retired.",
      tables: ["games", "game_stats", "player_team_seasons", "team_external_aliases", "team_ratings", "players", "teams", "programs"]
    }
  };
}

async function executeCanonicalization(preMerge: Awaited<ReturnType<typeof buildPreMergeReport>>) {
  const expectedGames = preMerge.affectedRecords.gameCount;
  const expectedGameStats = preMerge.affectedRecords.gameStatCount;
  const gameIds = preMerge.affectedRecords.games.map((game) => game.id);

  const repairResult = await prisma.$transaction(async (tx) => {
    const liveGameStats = await tx.gameStat.count({
      where: { deletedAt: null, teamId: DUPLICATE_TEAM_ID, gameId: { in: gameIds } }
    });
    if (liveGameStats !== expectedGameStats) {
      throw new Error(`Expected ${expectedGameStats} GameStats on duplicate team, found ${liveGameStats}.`);
    }

    const playersUpdated = await tx.player.updateMany({
      where: { deletedAt: null, currentProgramId: DUPLICATE_PROGRAM_ID },
      data: { currentProgramId: CANONICAL_PROGRAM_ID }
    });

    const rosterUpdated = await tx.playerTeamSeason.updateMany({
      where: { teamId: DUPLICATE_TEAM_ID },
      data: { teamId: CANONICAL_TEAM_ID }
    });

    const aliasCollisions = await tx.teamExternalAlias.findMany({
      where: { teamId: DUPLICATE_TEAM_ID },
      select: { id: true, provider: true, normalizedExternalLabel: true }
    });
    let aliasesMoved = 0;
    let aliasesDeleted = 0;
    for (const alias of aliasCollisions) {
      const existing = await tx.teamExternalAlias.findFirst({
        where: {
          provider: alias.provider,
          normalizedExternalLabel: alias.normalizedExternalLabel,
          teamId: CANONICAL_TEAM_ID
        }
      });
      if (existing) {
        await tx.teamExternalAlias.delete({ where: { id: alias.id } });
        aliasesDeleted += 1;
      } else {
        await tx.teamExternalAlias.update({
          where: { id: alias.id },
          data: { teamId: CANONICAL_TEAM_ID }
        });
        aliasesMoved += 1;
      }
    }

    const teamRatingsMoved = await tx.teamRating.updateMany({
      where: { teamId: DUPLICATE_TEAM_ID },
      data: { teamId: CANONICAL_TEAM_ID }
    });

    const homeGamesUpdated = await tx.game.updateMany({
      where: { id: { in: gameIds }, homeTeamId: DUPLICATE_TEAM_ID, deletedAt: null },
      data: { homeTeamId: CANONICAL_TEAM_ID }
    });
    const awayGamesUpdated = await tx.game.updateMany({
      where: { id: { in: gameIds }, awayTeamId: DUPLICATE_TEAM_ID, deletedAt: null },
      data: { awayTeamId: CANONICAL_TEAM_ID }
    });
    const gameStatsUpdated = await tx.gameStat.updateMany({
      where: { deletedAt: null, teamId: DUPLICATE_TEAM_ID, gameId: { in: gameIds } },
      data: { teamId: CANONICAL_TEAM_ID }
    });

    const duplicateTeamRemainingStats = await tx.gameStat.count({
      where: { deletedAt: null, teamId: DUPLICATE_TEAM_ID }
    });
    const duplicateTeamRemainingGames = await tx.game.count({
      where: {
        deletedAt: null,
        OR: [{ homeTeamId: DUPLICATE_TEAM_ID }, { awayTeamId: DUPLICATE_TEAM_ID }]
      }
    });
    if (duplicateTeamRemainingStats > 0 || duplicateTeamRemainingGames > 0) {
      throw new Error(
        `Duplicate team still has active usage after reassignment (games=${duplicateTeamRemainingGames}, stats=${duplicateTeamRemainingStats}).`
      );
    }

    const now = new Date();
    const duplicateTeamRetired = await tx.team.update({
      where: { id: DUPLICATE_TEAM_ID },
      data: { deletedAt: now }
    });
    const duplicateProgramRetired = await tx.program.update({
      where: { id: DUPLICATE_PROGRAM_ID },
      data: { deletedAt: now }
    });

    return {
      playersUpdated: playersUpdated.count,
      rosterSeasonsUpdated: rosterUpdated.count,
      aliasesMoved,
      aliasesDeleted,
      teamRatingsMoved: teamRatingsMoved.count,
      homeGamesUpdated: homeGamesUpdated.count,
      awayGamesUpdated: awayGamesUpdated.count,
      gameStatsUpdated: gameStatsUpdated.count,
      duplicateTeamRetiredAt: duplicateTeamRetired.deletedAt?.toISOString() ?? null,
      duplicateProgramRetiredAt: duplicateProgramRetired.deletedAt?.toISOString() ?? null
    };
  });

  return repairResult;
}

async function buildPostMergeValidation(preMerge: Awaited<ReturnType<typeof buildPreMergeReport>>) {
  const [canonicalUsage, duplicateUsage, counts] = await Promise.all([
    countTeamUsage(CANONICAL_TEAM_ID),
    countTeamUsage(DUPLICATE_TEAM_ID),
    protectedCounts()
  ]);

  const duplicateProgram = await prisma.program.findUnique({
    where: { id: DUPLICATE_PROGRAM_ID },
    select: { deletedAt: true }
  });
  const duplicateTeam = await prisma.team.findUnique({
    where: { id: DUPLICATE_TEAM_ID },
    select: { deletedAt: true }
  });

  const expectedCanonicalGames = preMerge.canonical.usage.activeGames + preMerge.affectedRecords.gameCount;
  const expectedCanonicalStats =
    preMerge.canonical.usage.activeGameStats + preMerge.affectedRecords.gameStatCount;

  const validation = {
    duplicateTeamNoActiveUsage: duplicateUsage.activeGames === 0 && duplicateUsage.activeGameStats === 0,
    duplicateTeamSoftDeleted: Boolean(duplicateTeam?.deletedAt),
    duplicateProgramSoftDeleted: Boolean(duplicateProgram?.deletedAt),
    canonicalGamesExpected: canonicalUsage.activeGames === expectedCanonicalGames,
    canonicalGameStatsExpected: canonicalUsage.activeGameStats === expectedCanonicalStats,
    activeGameStatCountUnchanged: counts.activeGameStats === preMerge.protectedCountsBefore.activeGameStats,
    gamePerformanceScoreCountUnchanged:
      counts.gamePerformanceScores === preMerge.protectedCountsBefore.gamePerformanceScores,
    playerRatingCountUnchanged: counts.playerRatings === preMerge.protectedCountsBefore.playerRatings,
    rankingSnapshotCountUnchanged: counts.rankingSnapshots === preMerge.protectedCountsBefore.rankingSnapshots,
    rankingSnapshotRowCountUnchanged:
      counts.rankingSnapshotRows === preMerge.protectedCountsBefore.rankingSnapshotRows,
    noPlayersOnDuplicateProgram:
      (await prisma.player.count({ where: { deletedAt: null, currentProgramId: DUPLICATE_PROGRAM_ID } })) === 0
  };

  return {
    generatedAt: new Date().toISOString(),
    phase: "post-merge-validation",
    canonicalUsage,
    duplicateUsage,
    expectedCanonicalGames,
    expectedCanonicalGameStats: expectedCanonicalStats,
    protectedCountsAfter: counts,
    validation,
    validationPassed: Object.values(validation).every(Boolean)
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  mkdirSync(REPORT_DIR, { recursive: true });

  const preMerge = await buildPreMergeReport();
  const preMergePath = join(REPORT_DIR, "bistrot-le-coucou-pre-merge-report.json");
  writeFileSync(preMergePath, JSON.stringify(preMerge, null, 2), "utf8");

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          preMergePath,
          summary: {
            gamesToReassign: preMerge.affectedRecords.gameCount,
            gameStatsToReassign: preMerge.affectedRecords.gameStatCount,
            canonicalProgram: preMerge.canonical.program.fullName,
            duplicateProgram: preMerge.duplicate.program.fullName
          },
          nextStep: "npx tsx scripts/canonicalize-bistrot-le-coucou.ts --execute"
        },
        null,
        2
      )
    );
    return;
  }

  const repairResult = await executeCanonicalization(preMerge);
  const postMerge = await buildPostMergeValidation(preMerge);
  if (!postMerge.validationPassed) {
    throw new Error(`Post-merge validation failed: ${JSON.stringify(postMerge.validation)}`);
  }

  const postMergePath = join(REPORT_DIR, "bistrot-le-coucou-post-merge-validation.json");
  writeFileSync(postMergePath, JSON.stringify({ repairResult, ...postMerge }, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        mode: "executed",
        preMergePath,
        postMergePath,
        repairResult,
        validationPassed: postMerge.validationPassed
      },
      null,
      2
    )
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
