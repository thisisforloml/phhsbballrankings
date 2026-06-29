/**
 * Canonicalize SMILE 360 BULLIES U13 Boys → Smile 360 Bullies (identity only).
 * Preserves both PYBC 13u games including SH-47340-2779282 and SH-47340-2787987.
 *
 * Usage:
 *   npx tsx scripts/canonicalize-smile360-bullies.ts           # pre-merge report only
 *   npx tsx scripts/canonicalize-smile360-bullies.ts --execute  # backup + execute + validate
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";

const CANONICAL_PROGRAM_ID = "58f9e2a2-fe97-44bf-b4d7-caf0164637d9";
const DUPLICATE_PROGRAM_ID = "60645321-d3b4-4db9-94aa-6176232b7476";
const CANONICAL_TEAM_ID = "48b03b46-91b7-4acb-9b85-1a8278c33773";
const DUPLICATE_TEAM_ID = "de02c99c-0b47-49f4-8af1-693b5dbf7493";
const TARGET_GAME_NUMBER = "SH-47340-2787987";
const TARGET_GAME_ID = "a1545b57-8c60-49a6-a634-a6747b146c4b";
const PRESERVE_GAME_NUMBER = "SH-47340-2779282";
const PYBC_13U_LEAGUE_ID = "87e9d0c6-d5d4-41f5-9d1c-e495cd16baad";
const PYBC_13U_SEASON_ID = "757fb031-d320-46a5-b9b6-e05fa321c0e7";
const EXPECTED_GAME_STATS = 15;
const EXPECTED_PYBC_13U_GAMES_AFTER = 9;

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
      where: { deletedAt: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] }
    }),
    prisma.gameStat.count({ where: { deletedAt: null, teamId } }),
    prisma.playerTeamSeason.count({ where: { teamId } }),
    prisma.teamExternalAlias.count({ where: { teamId } }),
    prisma.teamRating.count({ where: { teamId } })
  ]);
  return { activeGames, activeGameStats, rosterSeasons, externalAliases, teamRatings };
}

async function countPybc13uGames(teamId: string) {
  return prisma.game.count({
    where: {
      deletedAt: null,
      seasonId: PYBC_13U_SEASON_ID,
      season: { leagueId: PYBC_13U_LEAGUE_ID, deletedAt: null, league: { deletedAt: null } },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }]
    }
  });
}

async function buildPreMergeReport() {
  const [canonicalProgram, duplicateProgram, canonicalTeam, duplicateTeam, targetGame, counts] =
    await Promise.all([
      prisma.program.findUnique({
        where: { id: CANONICAL_PROGRAM_ID },
        select: {
          id: true,
          fullName: true,
          deletedAt: true,
          teams: { where: { deletedAt: null }, select: { id: true, name: true } },
          currentPlayers: { where: { deletedAt: null }, select: { id: true, displayName: true } }
        }
      }),
      prisma.program.findUnique({
        where: { id: DUPLICATE_PROGRAM_ID },
        select: {
          id: true,
          fullName: true,
          deletedAt: true,
          teams: { where: { deletedAt: null }, select: { id: true, name: true } }
        }
      }),
      prisma.team.findUnique({
        where: { id: CANONICAL_TEAM_ID },
        select: { id: true, name: true, programId: true, deletedAt: true }
      }),
      prisma.team.findUnique({
        where: { id: DUPLICATE_TEAM_ID },
        select: { id: true, name: true, programId: true, deletedAt: true }
      }),
      prisma.game.findFirst({
        where: { id: TARGET_GAME_ID, gameNumber: TARGET_GAME_NUMBER, deletedAt: null },
        include: {
          season: { include: { league: { select: { id: true, name: true, ageGroup: true } } } },
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          stats: {
            where: { deletedAt: null, teamId: DUPLICATE_TEAM_ID },
            select: {
              id: true,
              playerId: true,
              teamId: true,
              points: true,
              rebounds: true,
              assists: true,
              performanceScore: { select: { id: true, finalPerformanceScore: true } }
            }
          }
        }
      }),
      protectedCounts()
    ]);

  if (!canonicalProgram || !duplicateProgram || !canonicalTeam || !duplicateTeam || !targetGame) {
    throw new Error("Canonical/duplicate entities or target game not found.");
  }
  if (targetGame.homeTeamId !== DUPLICATE_TEAM_ID) {
    throw new Error(`Expected ${TARGET_GAME_NUMBER} homeTeamId to be duplicate team.`);
  }

  const [canonicalUsage, duplicateUsage, canonicalPybc13uBefore] = await Promise.all([
    countTeamUsage(CANONICAL_TEAM_ID),
    countTeamUsage(DUPLICATE_TEAM_ID),
    countPybc13uGames(CANONICAL_TEAM_ID)
  ]);

  const gameStatIds = targetGame.stats.map((stat) => stat.id);
  if (gameStatIds.length !== EXPECTED_GAME_STATS) {
    throw new Error(`Expected ${EXPECTED_GAME_STATS} GameStats on target game, found ${gameStatIds.length}.`);
  }

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
      usage: canonicalUsage,
      pybc13uGamesBefore: canonicalPybc13uBefore
    },
    duplicate: {
      program: { id: duplicateProgram.id, fullName: duplicateProgram.fullName },
      team: { id: duplicateTeam.id, name: duplicateTeam.name, programId: duplicateTeam.programId },
      usage: duplicateUsage,
      teamsUnderProgram: duplicateProgram.teams
    },
    affectedRecords: {
      game: {
        id: targetGame.id,
        gameNumber: targetGame.gameNumber,
        gameDate: targetGame.gameDate.toISOString(),
        homeScore: targetGame.homeScore,
        awayScore: targetGame.awayScore,
        league: targetGame.season.league.name,
        season: targetGame.season.name,
        ageGroup: targetGame.season.league.ageGroup,
        homeTeamIdBefore: targetGame.homeTeamId,
        homeTeamNameBefore: targetGame.homeTeam.name,
        awayTeamId: targetGame.awayTeamId,
        awayTeamName: targetGame.awayTeam.name,
        homeTeamIdAfter: CANONICAL_TEAM_ID
      },
      gameStatIds,
      gameStatSnapshots: targetGame.stats.map((stat) => ({
        id: stat.id,
        playerId: stat.playerId,
        teamIdBefore: stat.teamId,
        teamIdAfter: CANONICAL_TEAM_ID,
        points: stat.points,
        rebounds: stat.rebounds,
        assists: stat.assists,
        gpsId: stat.performanceScore?.id ?? null,
        gpsScore: stat.performanceScore?.finalPerformanceScore ?? null
      })),
      gameStatCount: gameStatIds.length,
      playersToReassignProgram: duplicatePlayersOnProgram
    },
    preservedGames: [PRESERVE_GAME_NUMBER, TARGET_GAME_NUMBER],
    protectedCountsBefore: counts,
    rollbackInstructions: {
      summary:
        "Restore game homeTeamId and GameStat teamId from affectedRecords; set programs/teams deletedAt=null on duplicate entities.",
      steps: [
        `UPDATE games SET "homeTeamId"='${DUPLICATE_TEAM_ID}' WHERE id='${TARGET_GAME_ID}'`,
        "UPDATE game_stats SET teamId to teamIdBefore for each id in gameStatIds",
        `UPDATE programs SET "deletedAt"=NULL WHERE id='${DUPLICATE_PROGRAM_ID}'`,
        `UPDATE teams SET "deletedAt"=NULL WHERE id='${DUPLICATE_TEAM_ID}'`
      ],
      tables: ["games", "game_stats", "players", "player_team_seasons", "team_external_aliases", "team_ratings", "teams", "programs"]
    }
  };
}

async function executeCanonicalization(preMerge: Awaited<ReturnType<typeof buildPreMergeReport>>) {
  const gameId = preMerge.affectedRecords.game.id;
  const gameStatIds = preMerge.affectedRecords.gameStatIds;

  return prisma.$transaction(async (tx) => {
    const liveGameStats = await tx.gameStat.count({
      where: { deletedAt: null, teamId: DUPLICATE_TEAM_ID, gameId, id: { in: gameStatIds } }
    });
    if (liveGameStats !== EXPECTED_GAME_STATS) {
      throw new Error(`Expected ${EXPECTED_GAME_STATS} GameStats, found ${liveGameStats}.`);
    }

    const targetGame = await tx.game.findUnique({
      where: { id: gameId },
      select: { homeTeamId: true, homeScore: true, awayScore: true, gameDate: true }
    });
    if (!targetGame || targetGame.homeTeamId !== DUPLICATE_TEAM_ID) {
      throw new Error("Target game homeTeamId changed before execution.");
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

    const homeGameUpdated = await tx.game.updateMany({
      where: { id: gameId, homeTeamId: DUPLICATE_TEAM_ID, deletedAt: null },
      data: { homeTeamId: CANONICAL_TEAM_ID }
    });
    if (homeGameUpdated.count !== 1) {
      throw new Error(`Expected 1 homeTeamId update on ${TARGET_GAME_NUMBER}, got ${homeGameUpdated.count}.`);
    }

    const gameStatsUpdated = await tx.gameStat.updateMany({
      where: { deletedAt: null, teamId: DUPLICATE_TEAM_ID, gameId, id: { in: gameStatIds } },
      data: { teamId: CANONICAL_TEAM_ID }
    });
    if (gameStatsUpdated.count !== EXPECTED_GAME_STATS) {
      throw new Error(`Expected ${EXPECTED_GAME_STATS} GameStat updates, got ${gameStatsUpdated.count}.`);
    }

    const gameAfter = await tx.game.findUnique({
      where: { id: gameId },
      select: { homeTeamId: true, homeScore: true, awayScore: true, gameDate: true }
    });
    if (
      !gameAfter ||
      gameAfter.homeScore !== targetGame.homeScore ||
      gameAfter.awayScore !== targetGame.awayScore ||
      gameAfter.gameDate.getTime() !== targetGame.gameDate.getTime()
    ) {
      throw new Error("Game scores or date changed during identity reassignment.");
    }

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
        `Duplicate team still has active usage (games=${duplicateTeamRemainingGames}, stats=${duplicateTeamRemainingStats}).`
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
      homeGamesUpdated: homeGameUpdated.count,
      gameStatsUpdated: gameStatsUpdated.count,
      duplicateTeamRetiredAt: duplicateTeamRetired.deletedAt?.toISOString() ?? null,
      duplicateProgramRetiredAt: duplicateProgramRetired.deletedAt?.toISOString() ?? null
    };
  });
}

async function buildPostMergeValidation(preMerge: Awaited<ReturnType<typeof buildPreMergeReport>>) {
  const [canonicalUsage, duplicateUsage, counts, canonicalPybc13u, preserveGame, targetGame] =
    await Promise.all([
      countTeamUsage(CANONICAL_TEAM_ID),
      countTeamUsage(DUPLICATE_TEAM_ID),
      protectedCounts(),
      countPybc13uGames(CANONICAL_TEAM_ID),
      prisma.game.findFirst({
        where: { gameNumber: PRESERVE_GAME_NUMBER, deletedAt: null },
        select: { id: true, awayTeamId: true, homeScore: true, awayScore: true }
      }),
      prisma.game.findFirst({
        where: { gameNumber: TARGET_GAME_NUMBER, deletedAt: null },
        select: { id: true, homeTeamId: true, homeScore: true, awayScore: true }
      })
    ]);

  const duplicateProgram = await prisma.program.findUnique({
    where: { id: DUPLICATE_PROGRAM_ID },
    select: { deletedAt: true }
  });
  const duplicateTeam = await prisma.team.findUnique({
    where: { id: DUPLICATE_TEAM_ID },
    select: { deletedAt: true }
  });

  const expectedCanonicalGames = preMerge.canonical.usage.activeGames + 1;
  const expectedCanonicalStats = preMerge.canonical.usage.activeGameStats + EXPECTED_GAME_STATS;

  const validation = {
    duplicateTeamNoActiveUsage: duplicateUsage.activeGames === 0 && duplicateUsage.activeGameStats === 0,
    duplicateTeamSoftDeleted: Boolean(duplicateTeam?.deletedAt),
    duplicateProgramSoftDeleted: Boolean(duplicateProgram?.deletedAt),
    canonicalGamesExpected: canonicalUsage.activeGames === expectedCanonicalGames,
    canonicalGameStatsExpected: canonicalUsage.activeGameStats === expectedCanonicalStats,
    canonicalPybc13uGamesExpected: canonicalPybc13u === EXPECTED_PYBC_13U_GAMES_AFTER,
    preserveGameStillActive: Boolean(preserveGame),
    preserveGameStillOnCanonicalTeam: preserveGame?.awayTeamId === CANONICAL_TEAM_ID,
    targetGameHomeTeamCanonical: targetGame?.homeTeamId === CANONICAL_TEAM_ID,
    targetGameScoresUnchanged:
      targetGame?.homeScore === preMerge.affectedRecords.game.homeScore &&
      targetGame?.awayScore === preMerge.affectedRecords.game.awayScore,
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
    canonicalPybc13uGames: canonicalPybc13u,
    expectedCanonicalGames,
    expectedCanonicalGameStats: expectedCanonicalStats,
    expectedPybc13uGames: EXPECTED_PYBC_13U_GAMES_AFTER,
    preservedGames: {
      [PRESERVE_GAME_NUMBER]: preserveGame,
      [TARGET_GAME_NUMBER]: targetGame
    },
    protectedCountsAfter: counts,
    validation,
    validationPassed: Object.values(validation).every(Boolean),
    rollbackInstructions: preMerge.rollbackInstructions
  };
}

async function main() {
  const execute = process.argv.includes("--execute");
  mkdirSync(REPORT_DIR, { recursive: true });

  const preMerge = await buildPreMergeReport();
  const preMergePath = join(REPORT_DIR, "smile360-pre-merge-report.json");
  writeFileSync(preMergePath, JSON.stringify(preMerge, null, 2), "utf8");

  if (!execute) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          preMergePath,
          summary: {
            gameToReassign: TARGET_GAME_NUMBER,
            gameStatsToReassign: EXPECTED_GAME_STATS,
            pybc13uGamesAfter: EXPECTED_PYBC_13U_GAMES_AFTER
          },
          nextStep: "npx tsx scripts/canonicalize-smile360-bullies.ts --execute"
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

  const postMergePath = join(REPORT_DIR, "smile360-post-merge-validation.json");
  writeFileSync(postMergePath, JSON.stringify({ repairResult, ...postMerge }, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        mode: "executed",
        preMergePath,
        postMergePath,
        repairResult,
        canonicalPybc13uGames: postMerge.canonicalPybc13uGames,
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
