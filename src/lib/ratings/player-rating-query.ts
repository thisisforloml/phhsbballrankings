import "server-only";

import { getActivePlayerFormulaConfig } from "@/lib/ratings/active-formula";
import {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_POLICY_ID
} from "@/lib/ratings/formula-constants";
import { FORMULA_VNEXT_POLICY_ID } from "@/lib/ratings/formula-vnext";
import { prisma } from "@/lib/prisma";

export {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_POLICY_ID
} from "@/lib/ratings/formula-constants";

export function getActivePolicyVersionId(): string {
  return getActivePlayerFormulaConfig().policyVersionId;
}

export function resolvePolicyVersionId(policyVersionId: string | null): string {
  return policyVersionId ?? getActivePolicyVersionId();
}

export async function resolveActivePlayerRatingFilter() {
  const config = getActivePlayerFormulaConfig();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: config.formulaVersionNumber },
    select: { id: true }
  });

  return {
    formulaVersionId: formulaVersion?.id ?? null,
    policyVersionId: resolvePolicyVersionId(config.policyVersionId)
  };
}

export function isVnextPolicy(policyVersionId: string): boolean {
  return policyVersionId === FORMULA_VNEXT_POLICY_ID;
}
