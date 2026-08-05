import { starFromAdjustedRating } from "@/lib/player-rating-cumulative";
import {
  type CompetitionStrengthProfile,
  translateScoreByCompetition
} from "@/lib/ratings/competition-strength-v1";

import { DEFAULT_FORMULA_V3_PARAMS, type FormulaV3Params } from "./params";
import type {
  FormulaV3ContextBreakdown,
  FormulaV3GameScore,
  FormulaV3IndependentGameScore,
  FormulaV3PlayerRating
} from "./types";

type PriorGame = { gameDate: Date; score: number };
type PlayerHistory = { rows: PriorGame[] };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values: number[], fallback = 50) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values, 0);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2), 0));
}

function tierKey(tier: number): 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(1, Math.round(tier))) as 1 | 2 | 3 | 4;
}

export function translateCompetitionScore(
  score: number,
  tier: number,
  params: FormulaV3Params = DEFAULT_FORMULA_V3_PARAMS,
  profile?: CompetitionStrengthProfile
) {
  if (profile) return translateScoreByCompetition(score, profile);
  const translation = params.competitionTranslation[tierKey(tier)];
  return clamp(50 + (score - 50) * translation.scale + translation.offset, 1, 100);
}

export function competitionEvidenceWeight(
  tier: number,
  params: FormulaV3Params = DEFAULT_FORMULA_V3_PARAMS,
  profile?: CompetitionStrengthProfile
) {
  if (profile) return profile.evidenceWeight;
  return params.competitionTranslation[tierKey(tier)].evidenceWeight;
}

function ageBracketMaximum(age: number | null) {
  if (age === null) return null;
  if (age <= 13) return 13;
  if (age <= 16) return 16;
  if (age <= 19) return 19;
  return null;
}

function competitionMaximum(label: string) {
  const match = label.toUpperCase().match(/U\s*(1[3-9])/);
  return match ? Number(match[1]) : null;
}

export function computeAgeContextAdjustment(
  playerAgeAtGame: number | null,
  competitionAgeLabel: string,
  _opponentReliability: number,
  _params: FormulaV3Params = DEFAULT_FORMULA_V3_PARAMS
) {
  const naturalMaximum = ageBracketMaximum(playerAgeAtGame);
  const competitionMaximumAge = competitionMaximum(competitionAgeLabel);
  if (naturalMaximum === null || competitionMaximumAge === null) {
    return { playingUpYears: 0, adjustment: 0 };
  }
  const gap = competitionMaximumAge > naturalMaximum
    ? competitionMaximumAge - naturalMaximum
    : playerAgeAtGame! > competitionMaximumAge
      ? competitionMaximumAge - playerAgeAtGame!
      : 0;
  // Playing against older competition is already reflected by competition and
  // opponent strength. Adding direct age points would count difficulty twice.
  return { playingUpYears: Math.max(0, gap), adjustment: 0 };
}

function calendarDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function contextEstimate(history: PlayerHistory | undefined, priorGames: number) {
  if (!history?.rows.length) return { rating: 50, reliability: 0 };
  const observed = average(history.rows.map((row) => row.score));
  const reliability = history.rows.length / (history.rows.length + priorGames);
  return { rating: 50 + (observed - 50) * reliability, reliability };
}

function recencyWeight(gameDate: Date, asOfDate: Date, params: FormulaV3Params) {
  const days = Math.max(0, (asOfDate.getTime() - gameDate.getTime()) / 86_400_000);
  return Math.max(params.recencyFloor, 2 ** (-days / params.recencyHalfLifeDays));
}

function competitionPoolKey(row: FormulaV3IndependentGameScore) {
  return `${row.seasonId}|${row.competitionAgeGroup}|${row.gender}`;
}

function rosterKey(row: FormulaV3IndependentGameScore) {
  return `${row.seasonId}|${row.teamId}`;
}

function activeParticipants(rows: FormulaV3IndependentGameScore[]) {
  const positiveMinutes = rows.filter((row) => row.minutes === null || row.minutes > 0);
  return positiveMinutes.length ? positiveMinutes : rows;
}

export function buildFormulaV3Ratings(
  rows: FormulaV3IndependentGameScore[],
  asOfDate = new Date(),
  params: FormulaV3Params = DEFAULT_FORMULA_V3_PARAMS,
  competitionProfiles = new Map<string, CompetitionStrengthProfile>()
): { games: FormulaV3GameScore[]; ratings: FormulaV3PlayerRating[] } {
  const histories = new Map<string, PlayerHistory>();
  const rosters = new Map<string, Set<string>>();
  const gameScores: FormulaV3GameScore[] = [];
  const games = new Map<string, FormulaV3IndependentGameScore[]>();
  for (const row of rows) {
    const bucket = games.get(row.gameId) ?? [];
    bucket.push(row);
    games.set(row.gameId, bucket);
  }

  const byDay = new Map<string, Array<FormulaV3IndependentGameScore[]>>();
  for (const gameRows of games.values()) {
    const key = calendarDay(gameRows[0].gameDate);
    const bucket = byDay.get(key) ?? [];
    bucket.push(gameRows);
    byDay.set(key, bucket);
  }

  for (const day of [...byDay.keys()].sort()) {
    const pendingUpdates: FormulaV3GameScore[] = [];
    const dayGames = (byDay.get(day) ?? []).sort((a, b) => a[0].gameId.localeCompare(b[0].gameId));
    for (const gameRows of dayGames) {
      const teamGroups = new Map<string, FormulaV3IndependentGameScore[]>();
      for (const row of gameRows) {
        const bucket = teamGroups.get(row.teamId) ?? [];
        bucket.push(row);
        teamGroups.set(row.teamId, bucket);
      }

      for (const row of gameRows) {
        const teammates = activeParticipants(teamGroups.get(row.teamId) ?? []).filter(
          (candidate) => candidate.playerId !== row.playerId
        );
        const opponents = activeParticipants(teamGroups.get(row.opponentTeamId) ?? []);
        const ownRoster = [...(rosters.get(rosterKey(row)) ?? new Set<string>())].filter(
          (playerId) => playerId !== row.playerId
        );
        const opponentRoster = [...(rosters.get(`${row.seasonId}|${row.opponentTeamId}`) ?? new Set<string>())];
        const teammateEstimates = teammates.map((candidate) => contextEstimate(histories.get(candidate.playerId), params.contextPriorGames));
        const opponentEstimates = opponents.map((candidate) => contextEstimate(histories.get(candidate.playerId), params.contextPriorGames));
        const ownRosterEstimates = ownRoster.map((playerId) => contextEstimate(histories.get(playerId), params.contextPriorGames));
        const opponentRosterEstimates = opponentRoster.map((playerId) => contextEstimate(histories.get(playerId), params.contextPriorGames));
        const teammateLineupRating = average(teammateEstimates.map((value) => value.rating));
        const opponentLineupRating = average(opponentEstimates.map((value) => value.rating));
        const ownTeamRating = average(ownRosterEstimates.map((value) => value.rating), teammateLineupRating);
        const opponentTeamRating = average(opponentRosterEstimates.map((value) => value.rating), opponentLineupRating);
        const teammateContextReliability = average(teammateEstimates.map((value) => value.reliability), 0);
        const opponentContextReliability = average(opponentEstimates.map((value) => value.reliability), 0);

        const opponentTeamAdjustment = clamp((opponentTeamRating - 50) * params.opponentTeamSlope, -params.opponentTeamMax, params.opponentTeamMax);
        const opponentLineupAdjustment = clamp((opponentLineupRating - opponentTeamRating) * params.opponentLineupSlope, -params.opponentLineupMax, params.opponentLineupMax);
        const ownTeamAdjustment = clamp(-(ownTeamRating - 50) * params.ownTeamSlope, -params.ownTeamMax, params.ownTeamMax);
        const teammateLineupAdjustment = clamp(-(teammateLineupRating - ownTeamRating) * params.teammateLineupSlope, -params.teammateLineupMax, params.teammateLineupMax);
        const totalContextAdjustment = clamp(
          opponentTeamAdjustment + opponentLineupAdjustment + ownTeamAdjustment + teammateLineupAdjustment,
          -params.totalContextMax,
          params.totalContextMax
        );
        const competitionProfile = competitionProfiles.get(competitionPoolKey(row));
        const competitionAdjustedScore = translateCompetitionScore(
          row.stabilizedIndependentScore,
          row.leagueTier,
          params,
          competitionProfile
        );
        const evidenceWeight = competitionEvidenceWeight(row.leagueTier, params, competitionProfile);
        const ageContext = computeAgeContextAdjustment(row.playerAgeAtGame, row.competitionAgeLabel, opponentContextReliability, params);
        const context: FormulaV3ContextBreakdown = {
          opponentLineupRating,
          opponentTeamRating,
          teammateLineupRating,
          ownTeamRating,
          opponentContextReliability,
          teammateContextReliability,
          opponentLineupAdjustment,
          opponentTeamAdjustment,
          teammateLineupAdjustment,
          ownTeamAdjustment,
          totalContextAdjustment,
          competitionStrengthRating: competitionProfile?.strengthRating ?? ({ 1: 92, 2: 80, 3: 67, 4: 55 } as const)[tierKey(row.leagueTier)],
          competitionStrengthConfidence: competitionProfile?.confidence ?? 0,
          competitionStrengthAdjustment: competitionAdjustedScore - row.stabilizedIndependentScore,
          competitionAdjustedScore,
          playingUpYears: ageContext.playingUpYears
        };
        pendingUpdates.push({
          ...row,
          ...context,
          competitionEvidenceWeight: evidenceWeight,
          highQualityEvidence: competitionProfile?.highQualityEvidence ?? tierKey(row.leagueTier) <= 2,
          finalGameScore: clamp(competitionAdjustedScore + totalContextAdjustment, 1, 100)
        });
      }
    }

    // A full date is committed to history only after every game on that date is scored.
    for (const row of pendingUpdates) {
      const history = histories.get(row.playerId) ?? { rows: [] };
      history.rows.push({ gameDate: row.gameDate, score: row.finalGameScore });
      histories.set(row.playerId, history);
      const roster = rosters.get(rosterKey(row)) ?? new Set<string>();
      roster.add(row.playerId);
      rosters.set(rosterKey(row), roster);
      gameScores.push(row);
    }
  }

  const ratingGroups = new Map<string, FormulaV3GameScore[]>();
  for (const game of gameScores) {
    const key = `${game.playerId}|${game.ratingAgeGroup}|${game.gender}`;
    const bucket = ratingGroups.get(key) ?? [];
    bucket.push(game);
    ratingGroups.set(key, bucket);
  }

  const ratings: FormulaV3PlayerRating[] = [];
  for (const gamesForPlayer of ratingGroups.values()) {
    const first = gamesForPlayer[0];
    let totalWeight = 0;
    let adjustedSum = 0;
    let observedSum = 0;
    let qualityGameEquivalent = 0;
    let highQualityGameEquivalent = 0;
    let competitionConfidenceWeight = 0;
    let competitionConfidenceSum = 0;
    const tierExposure: Record<string, number> = {};
    for (const game of gamesForPlayer) {
      const evidence = game.competitionEvidenceWeight;
      const weight = recencyWeight(game.gameDate, asOfDate, params) * evidence;
      totalWeight += weight;
      adjustedSum += game.finalGameScore * weight;
      observedSum += game.stabilizedIndependentScore * weight;
      qualityGameEquivalent += evidence;
      if (game.highQualityEvidence) highQualityGameEquivalent += evidence;
      competitionConfidenceWeight += evidence;
      competitionConfidenceSum += game.competitionStrengthConfidence * evidence;
      tierExposure[String(tierKey(game.leagueTier))] = (tierExposure[String(tierKey(game.leagueTier))] ?? 0) + 1;
    }
    const observedRating = observedSum / totalWeight;
    const estimatedRating = adjustedSum / totalWeight;
    const verifiedGameCount = gamesForPlayer.length;
    const gameScoreStandardDeviation = standardDeviation(gamesForPlayer.map((game) => game.finalGameScore));
    const consistency = gameScoreStandardDeviation <= 8 ? "STEADY" : gameScoreStandardDeviation <= 15 ? "MIXED" : "VARIABLE";
    const samplingUncertainty = (gameScoreStandardDeviation || 18) /
      Math.sqrt(Math.max(1, qualityGameEquivalent));
    const averageCompetitionConfidence = competitionConfidenceWeight > 0
      ? competitionConfidenceSum / competitionConfidenceWeight
      : 0;
    const competitionUncertainty = (1 - averageCompetitionConfidence) *
      params.competitionUncertaintyMax;
    const ratingUncertainty = clamp(
      Math.sqrt(samplingUncertainty ** 2 + competitionUncertainty ** 2),
      1.5,
      20
    );
    const adjustedRating = clamp(
      estimatedRating - params.uncertaintyPenaltyFactor * ratingUncertainty,
      1,
      100
    );
    const minimumRawGames = first.gender === "GIRLS" ? params.girlsMinimumRawGames : params.boysMinimumRawGames;
    const minimumQualityGames = first.gender === "GIRLS" ? params.girlsMinimumQualityGames : params.boysMinimumQualityGames;
    ratings.push({
      playerId: first.playerId,
      displayName: first.displayName,
      ageGroup: first.ratingAgeGroup,
      gender: first.gender,
      observedRating: Number(observedRating.toFixed(2)),
      estimatedRating: Number(estimatedRating.toFixed(2)),
      adjustedRating: Number(adjustedRating.toFixed(2)),
      verifiedGameCount,
      effectiveGameWeight: Number(totalWeight.toFixed(2)),
      qualityGameEquivalent: Number(qualityGameEquivalent.toFixed(2)),
      highQualityGameEquivalent: Number(highQualityGameEquivalent.toFixed(2)),
      starRating: starFromAdjustedRating(adjustedRating),
      confidence: qualityGameEquivalent < params.developingQualityGames ? "PROVISIONAL" : qualityGameEquivalent < params.establishedQualityGames ? "DEVELOPING" : "ESTABLISHED",
      consistency,
      gameScoreStandardDeviation: Number(gameScoreStandardDeviation.toFixed(2)),
      ratingUncertainty: Number(ratingUncertainty.toFixed(2)),
      ratingLowerBound: Number(clamp(adjustedRating - 1.96 * ratingUncertainty, 1, 100).toFixed(2)),
      ratingUpperBound: Number(clamp(adjustedRating + 1.96 * ratingUncertainty, 1, 100).toFixed(2)),
      publicEligibilityReady: verifiedGameCount >= minimumRawGames && qualityGameEquivalent >= minimumQualityGames,
      tierExposure,
      averageCompetitionStrengthAdjustment: Number(average(gamesForPlayer.map((game) => game.competitionStrengthAdjustment), 0).toFixed(3)),
      averageContextAdjustment: Number(average(gamesForPlayer.map((game) => game.totalContextAdjustment), 0).toFixed(3)),
      averageOpponentLineupRating: Number(average(gamesForPlayer.map((game) => game.opponentLineupRating)).toFixed(2)),
      averageOpponentTeamRating: Number(average(gamesForPlayer.map((game) => game.opponentTeamRating)).toFixed(2)),
      averageTeammateLineupRating: Number(average(gamesForPlayer.map((game) => game.teammateLineupRating)).toFixed(2)),
      averageOwnTeamRating: Number(average(gamesForPlayer.map((game) => game.ownTeamRating)).toFixed(2))
    });
  }

  ratings.sort((a, b) => b.adjustedRating - a.adjustedRating || b.qualityGameEquivalent - a.qualityGameEquivalent || a.displayName.localeCompare(b.displayName));
  return { games: gameScores, ratings };
}
