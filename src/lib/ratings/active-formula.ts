import {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_POLICY_ID,
  FORMULA_V1_VERSION_NUMBER
} from "@/lib/ratings/formula-constants";
import { FORMULA_VNEXT_POLICY_ID } from "@/lib/ratings/formula-vnext";

export type ActivePlayerFormulaMode = "production-v1" | "shadow-vnext" | "shadow-tier-normalized-v1";

export type ActivePlayerFormulaConfig = {
  mode: ActivePlayerFormulaMode;
  formulaVersionNumber: number;
  policyVersionId: string;
};

const PRODUCTION_V1: ActivePlayerFormulaConfig = {
  mode: "production-v1",
  formulaVersionNumber: FORMULA_V1_VERSION_NUMBER,
  policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID
};

/**
 * Returns the active player-rating formula for public reads.
 * Production uses tier-normalized soft v1 unless PLAYER_RATING_FORMULA_MODE overrides.
 */
export function getActivePlayerFormulaConfig(): ActivePlayerFormulaConfig {
  const mode = process.env.PLAYER_RATING_FORMULA_MODE;
  if (mode === "shadow-vnext") {
    return {
      mode: "shadow-vnext",
      formulaVersionNumber: FORMULA_V1_VERSION_NUMBER,
      policyVersionId: FORMULA_VNEXT_POLICY_ID
    };
  }
  if (mode === "shadow-tier-normalized-v1") {
    return {
      mode: "shadow-tier-normalized-v1",
      formulaVersionNumber: FORMULA_V1_VERSION_NUMBER,
      policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID
    };
  }
  return PRODUCTION_V1;
}

export function isShadowVnextFormulaActive(): boolean {
  return getActivePlayerFormulaConfig().mode === "shadow-vnext";
}
