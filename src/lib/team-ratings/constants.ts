export const TEAM_FORMULA_SLUG_V1 = "TPI-v1";
export const TEAM_EVIDENCE_POLICY_V1 = "TEAM-EVIDENCE-v1-official-import";
export const TEAM_THRESHOLD_POLICY_V1 = "TEAM-POLICY-v1-launch";

export type TpiV1Parameters = {
  shrinkageK: number;
  halfLifeDays: number;
  maxAgeDays: number;
  boardPrior: number;
  minGames: number;
  minOpponents: number;
  passIterations: number;
  evidencePolicyVersion: string;
  thresholdPolicyVersion: string;
};

export const DEFAULT_TPI_V1_PARAMETERS: TpiV1Parameters = {
  shrinkageK: 6,
  halfLifeDays: 180,
  maxAgeDays: 540,
  boardPrior: 50,
  minGames: 8,
  minOpponents: 3,
  passIterations: 2,
  evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
  thresholdPolicyVersion: TEAM_THRESHOLD_POLICY_V1
};
