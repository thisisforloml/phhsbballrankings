import {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_VERSION_NUMBER
} from "@/lib/ratings/formula-constants";
import { FORMULA_V3_POLICY_ID, FORMULA_V3_VERSION_NUMBER } from "@/lib/ratings/formula-v3/types";
import { FORMULA_VNEXT_POLICY_ID } from "@/lib/ratings/formula-vnext";

export type ActivePlayerFormulaMode = "production-v3" | "production-v1" | "shadow-vnext" | "shadow-tier-normalized-v1";

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

const PRODUCTION_V3: ActivePlayerFormulaConfig = {
  mode: "production-v3",
  formulaVersionNumber: FORMULA_V3_VERSION_NUMBER,
  policyVersionId: FORMULA_V3_POLICY_ID
};

/**
 * Returns the active player-rating formula for public reads.
 * Formula v3.3 is production. Set PLAYER_RATING_FORMULA_MODE=production-v1 for rollback.
 */
export function getActivePlayerFormulaConfig(): ActivePlayerFormulaConfig {
  const mode = process.env.PLAYER_RATING_FORMULA_MODE;
  if (mode === "production-v1") return PRODUCTION_V1;
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
  return PRODUCTION_V3;
}

export function getActivePolicyVersionId(): string {
  return getActivePlayerFormulaConfig().policyVersionId;
}

export function isShadowVnextFormulaActive(): boolean {
  return getActivePlayerFormulaConfig().mode === "shadow-vnext";
}
