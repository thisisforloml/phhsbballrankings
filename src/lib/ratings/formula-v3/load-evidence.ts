import { AgeGroup, VerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCalendarAge, getCurrentRankingAgeBracket } from "@/lib/ranking-eligibility";
import { inferCompetitionAgeLabel } from "@/lib/team-context-name";

import type { FormulaV3Coverage, FormulaV3StatLine } from "./types";

function numberOrNull(value: { toString(): string } | number | null) {
  return value === null ? null : Number(value);
}

function fallbackRatingAgeGroup(value: string | null, competitionAgeGroup: AgeGroup) {
  return value === AgeGroup.U13 || value === AgeGroup.U16 || value === AgeGroup.U19
    ? value
    : competitionAgeGroup;
}

export async function loadFormulaV3Evidence(asOfDate = new Date()): Promise<{
  rows: FormulaV3StatLine[];
  coverage: FormulaV3Coverage;
  warnings: string[];
}> {
  const stats = await prisma.gameStat.findMany({
    where: {
      deletedAt: null,
      player: { deletedAt: null },
      team: { deletedAt: null },
      game: {
        deletedAt: null,
        verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
        season: { deletedAt: null, league: { deletedAt: null } }
      }
    },
    select: {
      id: true,
      gameId: true,
      teamId: true,
      minutes: true,
      points: true,
      fieldGoalsMade: true,
      fieldGoalsAttempt: true,
      threeMade: true,
      threeAttempt: true,
      freeThrowsMade: true,
      freeThrowsAttempt: true,
      offensiveRebounds: true,
      defensiveRebounds: true,
      rebounds: true,
      assists: true,
      steals: true,
      blocks: true,
      turnovers: true,
      fouls: true,
      foulsDrawn: true,
      player: {
        select: {
          id: true,
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true,
          ageGroupOverride: true
        }
      },
      game: {
        select: {
          gameDate: true,
          seasonId: true,
          homeTeamId: true,
          awayTeamId: true,
          season: {
            select: {
              leagueId: true,
              league: { select: { name: true, ageGroup: true, tier: true, qualityScore: true } }
            }
          }
        }
      }
    },
    orderBy: [{ game: { gameDate: "asc" } }, { gameId: "asc" }, { playerId: "asc" }]
  });

  const warnings: string[] = [];
  const rows: FormulaV3StatLine[] = [];
  for (const stat of stats) {
    const competitionAgeGroup = stat.game.season.league.ageGroup;
    const competitionAgeLabel = inferCompetitionAgeLabel(
      stat.game.season.league.name,
      competitionAgeGroup
    );
    const calculated = getCurrentRankingAgeBracket(
      stat.player.birthDate,
      asOfDate,
      stat.player.classYearOverride,
      competitionAgeGroup
    );
    if (calculated === "OUT_OF_RANGE") continue;
    const ratingAgeGroup = calculated ?? fallbackRatingAgeGroup(stat.player.ageGroupOverride, competitionAgeGroup);
    const opponentTeamId = stat.teamId === stat.game.homeTeamId
      ? stat.game.awayTeamId
      : stat.teamId === stat.game.awayTeamId
        ? stat.game.homeTeamId
        : null;
    if (!opponentTeamId) {
      warnings.push(`GameStat ${stat.id} Team is not a Game participant.`);
      continue;
    }

    rows.push({
      gameStatId: stat.id,
      gameId: stat.gameId,
      gameDate: stat.game.gameDate,
      seasonId: stat.game.seasonId,
      leagueId: stat.game.season.leagueId,
      leagueName: stat.game.season.league.name,
      leagueTier: Math.min(4, Math.max(1, stat.game.season.league.tier ?? 1)),
      leagueQualityScore: stat.game.season.league.qualityScore ?? 0,
      competitionAgeLabel,
      competitionAgeGroup,
      ratingAgeGroup,
      playerAgeAtGame: getCalendarAge(stat.player.birthDate, stat.game.gameDate),
      gender: stat.player.gender,
      playerId: stat.player.id,
      displayName: stat.player.displayName,
      teamId: stat.teamId,
      opponentTeamId,
      minutes: numberOrNull(stat.minutes),
      points: stat.points,
      fieldGoalsMade: stat.fieldGoalsMade,
      fieldGoalsAttempt: stat.fieldGoalsAttempt,
      threeMade: stat.threeMade,
      threeAttempt: stat.threeAttempt,
      freeThrowsMade: stat.freeThrowsMade,
      freeThrowsAttempt: stat.freeThrowsAttempt,
      offensiveRebounds: stat.offensiveRebounds,
      defensiveRebounds: stat.defensiveRebounds,
      rebounds: stat.rebounds,
      assists: stat.assists,
      steals: stat.steals,
      blocks: stat.blocks,
      turnovers: stat.turnovers,
      fouls: stat.fouls,
      foulsDrawn: stat.foulsDrawn
    });
  }

  const count = (getter: (row: FormulaV3StatLine) => unknown) =>
    rows.reduce((sum, row) => sum + (getter(row) === null ? 0 : 1), 0);
  return {
    rows,
    coverage: {
      totalStatRows: rows.length,
      minutes: count((row) => row.minutes),
      fieldGoalAttempts: count((row) => row.fieldGoalsAttempt),
      threePointAttempts: count((row) => row.threeAttempt),
      freeThrowAttempts: count((row) => row.freeThrowsAttempt),
      turnovers: count((row) => row.turnovers),
      steals: count((row) => row.steals),
      blocks: count((row) => row.blocks),
      fouls: count((row) => row.fouls),
      foulsDrawn: count((row) => row.foulsDrawn)
    },
    warnings
  };
}
