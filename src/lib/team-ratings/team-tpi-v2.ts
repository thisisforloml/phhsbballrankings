import type { AgeGroup, PlayerGender } from "@prisma/client";

import type { CompetitionStrengthProfile } from "@/lib/ratings/competition-strength-v1";

export const TEAM_TPI_V2_POLICY_ID = "TPI-v2-team-context-shadow";

export type TeamTpiV2GameInput = {
  gameId: string;
  gameDate: Date;
  poolKey: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homePossessions: number | null;
  awayPossessions: number | null;
  homeRosterStrength: number | null;
  awayRosterStrength: number | null;
};

export type TeamTpiV2Result = {
  teamId: string;
  teamName: string;
  poolKey: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  rating: number;
  observedRating: number;
  rosterStrength: number | null;
  verifiedGames: number;
  verifiedOpponents: number;
  effectiveGameWeight: number;
  confidence: number;
  uncertainty: number;
};

export type TeamTpiV2Params = {
  iterations: number;
  halfLifeDays: number;
  recencyFloor: number;
  shrinkageGames: number;
  rosterWeightMax: number;
  marginScale: number;
  marginCap: number;
  opponentAdjustmentMax: number;
  competitionAdjustmentMax: number;
};

export const DEFAULT_TEAM_TPI_V2_PARAMS: TeamTpiV2Params = {
  iterations: 6,
  halfLifeDays: 180,
  recencyFloor: 0.45,
  shrinkageGames: 6,
  rosterWeightMax: 0.2,
  marginScale: 3.5,
  marginCap: 18,
  opponentAdjustmentMax: 8,
  competitionAdjustmentMax: 6
};

type TeamGame = {
  game: TeamTpiV2GameInput;
  teamId: string;
  teamName: string;
  opponentTeamId: string;
  score: number;
  opponentScore: number;
  possessions: number | null;
  opponentPossessions: number | null;
  rosterStrength: number | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values: number[], fallback = 50) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function recencyWeight(gameDate: Date, asOfDate: Date, params: TeamTpiV2Params) {
  const days = Math.max(0, (asOfDate.getTime() - gameDate.getTime()) / 86_400_000);
  return Math.max(params.recencyFloor, 2 ** (-days / params.halfLifeDays));
}

function normalizedMargin(row: TeamGame) {
  const averagePossessions = row.possessions !== null && row.opponentPossessions !== null
    ? Math.max(1, (row.possessions + row.opponentPossessions) / 2)
    : null;
  const rawMargin = row.score - row.opponentScore;
  return averagePossessions === null ? rawMargin : (rawMargin * 100) / averagePossessions;
}

function expandGames(games: TeamTpiV2GameInput[]) {
  const rows: TeamGame[] = [];
  for (const game of games) {
    rows.push({
      game,
      teamId: game.homeTeamId,
      teamName: game.homeTeamName,
      opponentTeamId: game.awayTeamId,
      score: game.homeScore,
      opponentScore: game.awayScore,
      possessions: game.homePossessions,
      opponentPossessions: game.awayPossessions,
      rosterStrength: game.homeRosterStrength
    });
    rows.push({
      game,
      teamId: game.awayTeamId,
      teamName: game.awayTeamName,
      opponentTeamId: game.homeTeamId,
      score: game.awayScore,
      opponentScore: game.homeScore,
      possessions: game.awayPossessions,
      opponentPossessions: game.homePossessions,
      rosterStrength: game.awayRosterStrength
    });
  }
  return rows;
}

export function computeTeamTpiV2(
  games: TeamTpiV2GameInput[],
  competitionProfiles: Map<string, CompetitionStrengthProfile>,
  asOfDate = new Date(),
  params: TeamTpiV2Params = DEFAULT_TEAM_TPI_V2_PARAMS
): TeamTpiV2Result[] {
  const expanded = expandGames(games);
  const grouped = new Map<string, TeamGame[]>();
  for (const row of expanded) {
    const key = `${row.game.poolKey}|${row.teamId}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  let strengths = new Map<string, number>();
  for (const [key] of grouped) strengths.set(key, 50);

  const observed = new Map<string, number>();
  const effectiveWeights = new Map<string, number>();
  for (let iteration = 0; iteration < Math.max(1, params.iterations); iteration += 1) {
    const next = new Map<string, number>();
    for (const [key, rows] of grouped) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const row of rows) {
        const profile = competitionProfiles.get(row.game.poolKey);
        const opponentKey = `${row.game.poolKey}|${row.opponentTeamId}`;
        const opponentStrength = strengths.get(opponentKey) ?? 50;
        const margin = clamp(normalizedMargin(row), -params.marginCap, params.marginCap);
        const marginValue = 50 + margin / params.marginScale;
        const opponentAdjustment = clamp((opponentStrength - 50) * 0.16, -params.opponentAdjustmentMax, params.opponentAdjustmentMax);
        const competitionAdjustment = profile
          ? clamp((profile.strengthRating - 70) * 0.12, -params.competitionAdjustmentMax, params.competitionAdjustmentMax)
          : 0;
        const gameValue = clamp(marginValue + opponentAdjustment + competitionAdjustment, 20, 85);
        const weight = recencyWeight(row.game.gameDate, asOfDate, params);
        weightedSum += gameValue * weight;
        totalWeight += weight;
      }
      const value = totalWeight ? weightedSum / totalWeight : 50;
      observed.set(key, value);
      effectiveWeights.set(key, totalWeight);
      next.set(key, value);
    }
    strengths = next;
  }

  const results: TeamTpiV2Result[] = [];
  for (const [key, rows] of grouped) {
    const observedRating = observed.get(key) ?? 50;
    const effectiveGameWeight = effectiveWeights.get(key) ?? 0;
    const rosterValues = rows.map((row) => row.rosterStrength).filter((value): value is number => value !== null);
    const rosterStrength = rosterValues.length ? average(rosterValues) : null;
    const rosterReliability = Math.min(1, effectiveGameWeight / 8);
    const rosterWeight = rosterStrength === null ? 0 : params.rosterWeightMax * rosterReliability;
    const blendedObserved = observedRating * (1 - rosterWeight) + (rosterStrength ?? 50) * rosterWeight;
    const shrinkageReliability = effectiveGameWeight / (effectiveGameWeight + params.shrinkageGames);
    const rating = 50 + (blendedObserved - 50) * shrinkageReliability;
    const opponents = new Set(rows.map((row) => row.opponentTeamId));
    const confidence = clamp(
      Math.min(1, effectiveGameWeight / 10) * 0.65 + Math.min(1, opponents.size / 5) * 0.35,
      0,
      1
    );
    results.push({
      teamId: rows[0].teamId,
      teamName: rows[0].teamName,
      poolKey: rows[0].game.poolKey,
      ageGroup: rows[0].game.ageGroup,
      gender: rows[0].game.gender,
      rating: Number(rating.toFixed(2)),
      observedRating: Number(observedRating.toFixed(2)),
      rosterStrength: rosterStrength === null ? null : Number(rosterStrength.toFixed(2)),
      verifiedGames: rows.length,
      verifiedOpponents: opponents.size,
      effectiveGameWeight: Number(effectiveGameWeight.toFixed(2)),
      confidence: Number(confidence.toFixed(3)),
      uncertainty: Number((14 * (1 - confidence) + 2).toFixed(2))
    });
  }

  return results.sort((left, right) =>
    left.poolKey.localeCompare(right.poolKey) || right.rating - left.rating || left.teamName.localeCompare(right.teamName)
  );
}
