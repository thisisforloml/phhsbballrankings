import { resolveLaunchThreshold } from "./launch-policy";
import type { EligibilityInput } from "./types";

export const PENDING_ELIGIBILITY_EXPIRY_DAYS = 365;

/** Policy effective date for backfill when no qualifying game date exists. */
export const PENDING_POLICY_EFFECTIVE_DATE = new Date(Date.UTC(2026, 5, 17));

function resolveEligibilityClockStart(firstRankingEligibilityAt: Date | null | undefined): Date {
  return firstRankingEligibilityAt ?? PENDING_POLICY_EFFECTIVE_DATE;
}

export function isPendingEligibilityExpired(
  firstRankingEligibilityAt: Date | null | undefined,
  evaluationDate: Date
): boolean {
  const expiresAt = new Date(resolveEligibilityClockStart(firstRankingEligibilityAt));
  expiresAt.setUTCDate(expiresAt.getUTCDate() + PENDING_ELIGIBILITY_EXPIRY_DAYS);
  return evaluationDate.getTime() > expiresAt.getTime();
}

export function satisfiesPendingPublicPath(
  input: EligibilityInput,
  evaluationDate: Date,
  gamesQualified: number,
  policyVersionId: string
): boolean {
  if (input.birthDate) return false;
  if (input.competitionTrustLevel === "UNTRUSTED") return false;
  if ((input.dobEscalationTier ?? 0) >= 2) return false;
  if (!input.hasTargetBoardRating) return false;
  if (!input.ratingAgeGroup || input.ratingAgeGroup !== input.evaluatedBoard) return false;

  const threshold = resolveLaunchThreshold(input.gender, policyVersionId);
  if (gamesQualified < threshold) return false;
  if (isPendingEligibilityExpired(input.firstRankingEligibilityAt, evaluationDate)) return false;

  return true;
}
