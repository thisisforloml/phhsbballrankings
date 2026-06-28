import type { AgeGroup, PlayerGender } from "@prisma/client";
import type { RankingAgeBracket } from "@/lib/ranking-eligibility";

export const FORMULA_VNEXT_POLICY_ID = "rating-formula-vnext-shadow-v1";

export type EvidenceRole = "HOME" | "PLAYING_UP" | "PLAYING_DOWN" | "UNKNOWN";

export type FormulaVnextParams = {
  policyVersionId: string;
  /** League tier multipliers (ADR-012 pattern). */
  leagueTierWeight: Record<1 | 2 | 3 | 4, number>;
  /** Opponent strength: clamp(1 + (oppRating - 50) * opponentSlope, min, max). */
  opponentRatingNeutral: number;
  opponentSlope: number;
  opponentFactorMin: number;
  opponentFactorMax: number;
  /** Teammate context: clamp(1 - (teamAvg - playerPrior) * teamSlope, min, max). */
  teamSlope: number;
  teamFactorMin: number;
  teamFactorMax: number;
  /** Per-year playing up: 1 + yearsUp * playingUpPerYear (capped). */
  playingUpPerYear: number;
  playingUpFactorMax: number;
  /** Playing down discount per year below competition bracket. */
  playingDownPerYear: number;
  playingDownFactorMin: number;
  /** Advanced composite bonus clamp. */
  advancedBonusMin: number;
  advancedBonusMax: number;
  /** Recency weights mirror weeklyGameWeight tiers. */
  recencyWeight14d: number;
  recencyWeight31d: number;
  recencyWeightOlder: number;
  /** Bayesian shrinkage prior games (boys/girls). */
  shrinkagePriorGamesBoys: number;
  shrinkagePriorGamesGirls: number;
};

export type LoadedGameEvidence = {
  gameStatId: string;
  gameId: string;
  gameDate: Date;
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  birthDate: Date | null;
  classYearOverride: number | null;
  competitionAgeGroup: AgeGroup;
  homeBracket: RankingAgeBracket | null;
  evidenceRole: EvidenceRole;
  baseGameScore: number;
  leagueTier: 1 | 2 | 3 | 4;
  opponentProgramRating: number | null;
  teamMateAvgBaseScore: number | null;
  playerPriorRating: number | null;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
  playerEfficiencyRating: number | null;
  winShares: number | null;
  pie: number | null;
};

export type AdjustedGameScore = LoadedGameEvidence & {
  opponentFactor: number;
  teamFactor: number;
  leagueWeight: number;
  ageFactor: number;
  advancedBonus: number;
  recencyWeight: number;
  adjustedGameScore: number;
  effectiveWeight: number;
};

export type ShadowPlayerRating = {
  playerId: string;
  displayName: string;
  gender: PlayerGender;
  homeBracket: RankingAgeBracket;
  observedRating: number;
  adjustedRating: number;
  verifiedGameCount: number;
  effectiveGameWeight: number;
  starRating: number;
  ratingBasis: "DIRECT" | "PROJECTED" | "BLENDED";
  evidenceRoles: Record<EvidenceRole, number>;
  avgOpponentFactor: number;
  avgAgeFactor: number;
};

export type ShadowBoard = {
  policyVersionId: string;
  evaluationDate: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  rows: ShadowPlayerRating[];
};
