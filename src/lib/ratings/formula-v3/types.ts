import type { AgeGroup, PlayerGender } from "@prisma/client";

export const FORMULA_V3_POLICY_ID = "formula-v3.3-continuous-strength-shadow-v1";

export type FormulaV3StatLine = {
  gameStatId: string;
  gameId: string;
  gameDate: Date;
  seasonId: string;
  leagueId: string;
  leagueName: string;
  leagueTier: number;
  leagueQualityScore: number;
  competitionAgeLabel: string;
  competitionAgeGroup: AgeGroup;
  ratingAgeGroup: AgeGroup;
  playerAgeAtGame: number | null;
  gender: PlayerGender;
  playerId: string;
  displayName: string;
  teamId: string;
  opponentTeamId: string;
  minutes: number | null;
  points: number;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  rebounds: number;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
};

export type FormulaV3PoolContext = {
  key: string;
  sampleSize: number;
  trueShootingPct: number | null;
  effectiveFieldGoalPct: number | null;
};

export type FormulaV3IndependentGameScore = FormulaV3StatLine & {
  rawGameValue: number;
  baseScore: number;
  advancedScore: number | null;
  independentScore: number;
  rateScore: number | null;
  rateReliability: number;
  stabilizedIndependentScore: number;
};

export type FormulaV3ContextBreakdown = {
  opponentLineupRating: number;
  opponentTeamRating: number;
  teammateLineupRating: number;
  ownTeamRating: number;
  opponentContextReliability: number;
  teammateContextReliability: number;
  opponentLineupAdjustment: number;
  opponentTeamAdjustment: number;
  teammateLineupAdjustment: number;
  ownTeamAdjustment: number;
  totalContextAdjustment: number;
  competitionStrengthRating: number;
  competitionStrengthConfidence: number;
  competitionStrengthAdjustment: number;
  competitionAdjustedScore: number;
  playingUpYears: number;
};

export type FormulaV3GameScore = FormulaV3IndependentGameScore & FormulaV3ContextBreakdown & {
  finalGameScore: number;
  competitionEvidenceWeight: number;
  highQualityEvidence: boolean;
};

export type FormulaV3PlayerRating = {
  playerId: string;
  displayName: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  observedRating: number;
  estimatedRating: number;
  adjustedRating: number;
  verifiedGameCount: number;
  effectiveGameWeight: number;
  qualityGameEquivalent: number;
  highQualityGameEquivalent: number;
  starRating: number;
  confidence: "PROVISIONAL" | "DEVELOPING" | "ESTABLISHED";
  consistency: "STEADY" | "MIXED" | "VARIABLE";
  gameScoreStandardDeviation: number;
  ratingUncertainty: number;
  ratingLowerBound: number;
  ratingUpperBound: number;
  publicEligibilityReady: boolean;
  tierExposure: Record<string, number>;
  averageCompetitionStrengthAdjustment: number;
  averageContextAdjustment: number;
  averageOpponentLineupRating: number;
  averageOpponentTeamRating: number;
  averageTeammateLineupRating: number;
  averageOwnTeamRating: number;
};

export type FormulaV3Coverage = {
  totalStatRows: number;
  minutes: number;
  fieldGoalAttempts: number;
  threePointAttempts: number;
  freeThrowAttempts: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  foulsDrawn: number;
};
