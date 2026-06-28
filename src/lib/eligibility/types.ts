import type { RankingAgeBracket } from "@/lib/ranking-eligibility";

export type EligibilityBoard = "U13" | "U16" | "U19";

export type EligibilityVerdictType = "RANKED" | "PROVISIONAL" | "HIDDEN" | "FORMER";

export type AgeVerificationStatus = "VERIFIED" | "PENDING";

export type ProvisionalReason =
  | "BELOW_THRESHOLD"
  | "UNKNOWN_DOB"
  | "OVERRIDE_CROSS_BRACKET"
  | "CARRYOVER_ONLY";

export type ExclusionReason =
  | "GRADUATED"
  | "OUT_OF_BRACKET"
  | "NO_RATING_BASIS"
  | "UNTRUSTED_UNKNOWN_DOB"
  | "RANKING_INACTIVE"
  | "ZERO_GAMES";

export type ClassYearStatus = "ELIGIBLE" | "GRADUATED" | "UNKNOWN";

export type CompetitionTrustLevel = "UNTRUSTED" | "STANDARD" | "TRUSTED";

export type EligibilityInput = {
  playerId: string;
  gender: "Boys" | "Girls" | "BOYS" | "GIRLS";
  birthDate: Date | null;
  firstRankingEligibilityAt?: Date | null;
  classYearOverride?: number | null;
  ageGroupOverride?: string | null;
  ratingAgeGroup: EligibilityBoard | null;
  verifiedGameCount: number;
  gamesQualified?: number;
  hasTargetBoardRating: boolean;
  evaluatedBoard: EligibilityBoard;
  evaluationDate?: Date;
  policyVersionId?: string;
  formulaVersionId?: string | null;
  competitionTrustLevel?: CompetitionTrustLevel;
  dobEscalationTier?: number;
  rankingInactive?: boolean;
  frozenVerdict?: EligibilityVerdictType;
};

export type EligibilityVerdict = {
  verdict: EligibilityVerdictType;
  provisionalReason: ProvisionalReason | null;
  exclusionReason: ExclusionReason | null;
  ageVerificationStatus: AgeVerificationStatus;
  publicRankAllowed: boolean;
  snapshotEligible: boolean;
  matureEligible: boolean;
  ratingAgeGroup: EligibilityBoard | null;
  evaluatedBoard: EligibilityBoard;
  evaluationDate: string;
  formulaVersionId: string | null;
  policyVersionId: string;
  competitionAgeGroup: RankingAgeBracket | null;
  competitionTrustLevel: CompetitionTrustLevel;
  classYearStatus: ClassYearStatus;
  gamesQualified: number;
  verifiedGameCount: number;
  precedenceRule: string;
};
