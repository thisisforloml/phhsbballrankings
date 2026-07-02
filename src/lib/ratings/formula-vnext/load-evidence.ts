import { AgeGroup, PlayerGender, VerificationStatus } from "@prisma/client";

import { FORMULA_V1_VERSION_NUMBER } from "@/lib/player-rating-cumulative";
import { prisma } from "@/lib/prisma";
import { getCurrentRankingAgeBracket } from "@/lib/ranking-eligibility";

import { deriveEvidenceRole } from "./context-factors";
import type { LoadedGameEvidence } from "./types";

type LoadOptions = {
  asOfDate?: Date;
  ageGroup?: AgeGroup;
  gender?: PlayerGender;
};

export async function loadFormulaVnextEvidence(options: LoadOptions = {}): Promise<LoadedGameEvidence[]> {
  const asOfDate = options.asOfDate ?? new Date();

  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) return [];

  const rows = await prisma.gamePerformanceScore.findMany({
    where: {
      deletedAt: null,
      formulaVersionId: formulaVersion.id,
      finalPerformanceScore: { not: null },
      game: {
        deletedAt: null,
        verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
        season: { deletedAt: null, league: { deletedAt: null } }
      },
      player: { deletedAt: null }
    },
    select: {
      finalPerformanceScore: true,
      effectiveFieldGoalPct: true,
      trueShootingPct: true,
      playerEfficiencyRating: true,
      winShares: true,
      pie: true,
      gameStatId: true,
      gameId: true,
      playerId: true,
      gameStat: {
        select: {
          teamId: true,
          team: { select: { programId: true } }
        }
      },
      game: {
        select: {
          gameDate: true,
          homeTeamId: true,
          awayTeamId: true,
          homeTeam: { select: { programId: true } },
          awayTeam: { select: { programId: true } },
          season: {
            select: {
              league: {
                select: {
                  ageGroup: true,
                  tier: true,
                  name: true
                }
              }
            }
          }
        }
      },
      player: {
        select: {
          displayName: true,
          gender: true,
          birthDate: true,
          classYearOverride: true
        }
      }
    }
  });

  const programRatings = await prisma.programTeamRating.findMany({
    select: {
      programId: true,
      ageGroup: true,
      gender: true,
      rating: true
    }
  });
  const programRatingMap = new Map(
    programRatings.map((row) => [
      `${row.programId}|${row.ageGroup}|${row.gender}`,
      Number(row.rating)
    ])
  );

  const playerRatings = await prisma.playerRating.findMany({
    select: { playerId: true, ageGroup: true, adjustedRating: true }
  });
  const playerRatingMap = new Map(
    playerRatings.map((row) => [`${row.playerId}|${row.ageGroup}`, Number(row.adjustedRating)])
  );

  const gameTeamScores = new Map<string, number[]>();
  for (const row of rows) {
    const base = Number(row.finalPerformanceScore);
    const teamKey = `${row.gameId}|${row.gameStat.teamId}`;
    const bucket = gameTeamScores.get(teamKey) ?? [];
    bucket.push(base);
    gameTeamScores.set(teamKey, bucket);
  }

  const evidence: LoadedGameEvidence[] = [];

  for (const row of rows) {
    const competitionAgeGroup = row.game.season.league.ageGroup;
    const gender = row.player.gender;
    if (options.ageGroup && competitionAgeGroup !== options.ageGroup) continue;
    if (options.gender && gender !== options.gender) continue;

    const homeBracket = getCurrentRankingAgeBracket(
      row.player.birthDate,
      asOfDate,
      row.player.classYearOverride,
      competitionAgeGroup
    );
    const evidenceRole = deriveEvidenceRole(homeBracket, competitionAgeGroup);

    const playerTeamId = row.gameStat.teamId;
    const opponentProgramId =
      row.game.homeTeamId === playerTeamId
        ? row.game.awayTeam.programId
        : row.game.homeTeam.programId;

    const teamKey = `${row.gameId}|${playerTeamId}`;
    const teamScores = gameTeamScores.get(teamKey) ?? [];
    const teamMateAvgBaseScore =
      teamScores.length > 1
        ? teamScores.reduce((sum, value) => sum + value, 0) / teamScores.length
        : null;

    const opponentProgramRating = opponentProgramId
      ? programRatingMap.get(`${opponentProgramId}|${competitionAgeGroup}|${gender}`) ?? null
      : null;

    const playerPriorRating =
      playerRatingMap.get(`${row.playerId}|${competitionAgeGroup}`) ?? null;

    const leagueTier = Math.min(4, Math.max(1, row.game.season.league.tier ?? 1)) as 1 | 2 | 3 | 4;

    evidence.push({
      gameStatId: row.gameStatId,
      gameId: row.gameId,
      gameDate: row.game.gameDate,
      playerId: row.playerId,
      displayName: row.player.displayName,
      gender,
      birthDate: row.player.birthDate,
      classYearOverride: row.player.classYearOverride,
      competitionAgeGroup,
      homeBracket,
      evidenceRole,
      baseGameScore: Number(row.finalPerformanceScore),
      leagueTier,
      opponentProgramRating,
      teamMateAvgBaseScore,
      playerPriorRating,
      effectiveFieldGoalPct: row.effectiveFieldGoalPct ? Number(row.effectiveFieldGoalPct) : null,
      trueShootingPct: row.trueShootingPct ? Number(row.trueShootingPct) : null,
      playerEfficiencyRating: row.playerEfficiencyRating ? Number(row.playerEfficiencyRating) : null,
      winShares: row.winShares ? Number(row.winShares) : null,
      pie: row.pie ? Number(row.pie) : null
    });
  }

  return evidence;
}
