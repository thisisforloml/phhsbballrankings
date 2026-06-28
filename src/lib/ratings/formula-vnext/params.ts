import type { FormulaVnextParams } from "./types";
import { FORMULA_VNEXT_POLICY_ID } from "./types";

/** Initial shadow parameters — calibrated by scripts/rating-reformulation-calibration.ts */
export const DEFAULT_FORMULA_VNEXT_PARAMS: FormulaVnextParams = {
  policyVersionId: FORMULA_VNEXT_POLICY_ID,
  // Governance convention: tier 1 is strongest. Keep this shadow-only until
  // calibration and explicit production recompute approval.
  leagueTierWeight: { 1: 1.4, 2: 1.25, 3: 1.1, 4: 1.0 },
  opponentRatingNeutral: 50,
  opponentSlope: 1 / 400,
  opponentFactorMin: 0.85,
  opponentFactorMax: 1.15,
  teamSlope: 1 / 500,
  teamFactorMin: 0.9,
  teamFactorMax: 1.1,
  playingUpPerYear: 0.08,
  playingUpFactorMax: 1.24,
  playingDownPerYear: 0.06,
  playingDownFactorMin: 0.88,
  advancedBonusMin: -5,
  advancedBonusMax: 10,
  recencyWeight14d: 1.0,
  recencyWeight31d: 0.8,
  recencyWeightOlder: 0.6,
  shrinkagePriorGamesBoys: 10,
  shrinkagePriorGamesGirls: 5
};

export function mergeFormulaVnextParams(
  overrides: Partial<FormulaVnextParams> = {}
): FormulaVnextParams {
  return { ...DEFAULT_FORMULA_VNEXT_PARAMS, ...overrides };
}
