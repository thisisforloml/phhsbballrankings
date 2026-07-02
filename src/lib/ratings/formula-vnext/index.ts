import { AgeGroup, PlayerGender } from "@prisma/client";

import { buildShadowRatings } from "./accumulation";
import { loadFormulaVnextEvidence } from "./load-evidence";
import { mergeFormulaVnextParams } from "./params";
import type { FormulaVnextParams, ShadowBoard } from "./types";

export {
  accumulatePlayerRating,
  adjustGameScore,
  buildShadowRatings
} from "./accumulation";
export {
  advancedCompositeBonus,
  ageFactor,
  deriveEvidenceRole,
  leagueTierWeight,
  opponentFactor,
  recencyWeight,
  teamFactor
} from "./context-factors";
export { loadFormulaVnextEvidence } from "./load-evidence";
export { DEFAULT_FORMULA_VNEXT_PARAMS, mergeFormulaVnextParams } from "./params";
export { resolveShadowFormulaParams } from "./resolve-params";
export type {
  AdjustedGameScore,
  EvidenceRole,
  FormulaVnextParams,
  LoadedGameEvidence,
  ShadowBoard,
  ShadowPlayerRating
} from "./types";
export { FORMULA_VNEXT_POLICY_ID } from "./types";

export async function computeShadowBoard(input: {
  ageGroup: AgeGroup;
  gender: PlayerGender;
  asOfDate?: Date;
  params?: Partial<FormulaVnextParams>;
}): Promise<ShadowBoard> {
  const asOfDate = input.asOfDate ?? new Date();
  const params = mergeFormulaVnextParams(input.params);
  const evidence = await loadFormulaVnextEvidence({ asOfDate, gender: input.gender });

  const ratings = buildShadowRatings(
    evidence.filter((row) => row.homeBracket === input.ageGroup),
    params,
    asOfDate
  );

  return {
    policyVersionId: params.policyVersionId,
    evaluationDate: asOfDate.toISOString().slice(0, 10),
    ageGroup: input.ageGroup,
    gender: input.gender,
    rows: ratings
  };
}
