import type { EligibilityBoard } from "./types";

export const LAUNCH_POLICY_V1_ID = "launch-v1";

export const LAUNCH_POLICY_V1 = {
  policyVersionId: LAUNCH_POLICY_V1_ID,
  boysLaunchThreshold: 10,
  girlsLaunchThreshold: 5,
  matureThreshold: 15
} as const;

export type LaunchPolicy = typeof LAUNCH_POLICY_V1;

export function resolveLaunchPolicy(policyVersionId = LAUNCH_POLICY_V1_ID): LaunchPolicy {
  if (policyVersionId !== LAUNCH_POLICY_V1_ID) {
    throw new Error(`Unknown eligibility policy version: ${policyVersionId}`);
  }
  return LAUNCH_POLICY_V1;
}

export function normalizeEligibilityGender(gender: string): "Boys" | "Girls" {
  return gender === "GIRLS" || gender === "Girls" ? "Girls" : "Boys";
}

export function resolveLaunchThreshold(gender: string, policyVersionId = LAUNCH_POLICY_V1_ID): number {
  const policy = resolveLaunchPolicy(policyVersionId);
  return normalizeEligibilityGender(gender) === "Girls" ? policy.girlsLaunchThreshold : policy.boysLaunchThreshold;
}

export function leaderboardMinimumGamesForGender(gender: string, policyVersionId = LAUNCH_POLICY_V1_ID): number {
  return resolveLaunchThreshold(gender, policyVersionId);
}

export function publicBoardMinimumGames(gender: "Boys" | "Girls", policyVersionId = LAUNCH_POLICY_V1_ID): number {
  return resolveLaunchThreshold(gender, policyVersionId);
}

export function normalizeEligibilityBoard(value: string | null | undefined): EligibilityBoard | null {
  if (!value) return null;
  const normalized = value.replace("18", "19").replace("22", "19");
  if (normalized === "U13" || normalized === "U16" || normalized === "U19") return normalized;
  return null;
}
