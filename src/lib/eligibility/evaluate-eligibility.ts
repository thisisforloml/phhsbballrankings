import {
  getCurrentRankingAgeBracket,
  getRankingAgeBracket,
  isRankingEligibleByClassYear,
  type RankingAgeBracket
} from "@/lib/ranking-eligibility";

import { LAUNCH_POLICY_V1_ID, normalizeEligibilityBoard, normalizeEligibilityGender, resolveLaunchPolicy, resolveLaunchThreshold } from "./launch-policy";
import { satisfiesPendingPublicPath } from "./pending-public-policy";
import type {
  AgeVerificationStatus,
  ClassYearStatus,
  CompetitionTrustLevel,
  EligibilityBoard,
  EligibilityInput,
  EligibilityVerdict,
  EligibilityVerdictType,
  ExclusionReason,
  ProvisionalReason
} from "./types";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function deriveAgeVerificationStatus(input: EligibilityInput, override?: AgeVerificationStatus): AgeVerificationStatus {
  if (override) return override;
  return input.birthDate ? "VERIFIED" : "PENDING";
}

function buildVerdict(
  input: EligibilityInput,
  evaluationDate: Date,
  policyVersionId: string,
  fields: {
    verdict: EligibilityVerdictType;
    provisionalReason?: ProvisionalReason | null;
    exclusionReason?: ExclusionReason | null;
    precedenceRule: string;
    competitionTrustLevel: CompetitionTrustLevel;
    classYearStatus: ClassYearStatus;
    competitionAgeGroup: RankingAgeBracket | null;
    gamesQualified: number;
    matureEligible?: boolean;
    publicRankAllowed?: boolean;
    snapshotEligible?: boolean;
    ageVerificationStatus?: AgeVerificationStatus;
  }
): EligibilityVerdict {
  const ageVerificationStatus = deriveAgeVerificationStatus(input, fields.ageVerificationStatus);
  const publicRankAllowed = fields.publicRankAllowed ?? fields.verdict === "RANKED";
  const snapshotEligible = fields.snapshotEligible ?? fields.verdict === "RANKED";
  const matureThreshold = resolveLaunchPolicy(policyVersionId).matureThreshold;

  return {
    verdict: fields.verdict,
    provisionalReason: fields.provisionalReason ?? null,
    exclusionReason: fields.exclusionReason ?? null,
    ageVerificationStatus,
    publicRankAllowed,
    snapshotEligible,
    matureEligible: fields.matureEligible ?? (fields.gamesQualified >= matureThreshold && fields.verdict === "RANKED"),
    ratingAgeGroup: input.ratingAgeGroup,
    evaluatedBoard: input.evaluatedBoard,
    evaluationDate: isoDate(evaluationDate),
    formulaVersionId: input.formulaVersionId ?? null,
    policyVersionId,
    competitionAgeGroup: fields.competitionAgeGroup,
    competitionTrustLevel: fields.competitionTrustLevel,
    classYearStatus: fields.classYearStatus,
    gamesQualified: fields.gamesQualified,
    verifiedGameCount: input.verifiedGameCount,
    precedenceRule: fields.precedenceRule
  };
}

function deriveClassYearStatus(
  birthDate: Date | null,
  classYearOverride: number | null | undefined,
  evaluatedBoard: EligibilityBoard,
  evaluationDate: Date
): ClassYearStatus {
  if (!birthDate && classYearOverride == null) return "UNKNOWN";
  if (evaluatedBoard === "U19" && !isRankingEligibleByClassYear(birthDate, evaluationDate, classYearOverride)) return "GRADUATED";
  return "ELIGIBLE";
}

function provisional(
  input: EligibilityInput,
  evaluationDate: Date,
  policyVersionId: string,
  reason: ProvisionalReason,
  precedenceRule: string,
  context: {
    competitionTrustLevel: CompetitionTrustLevel;
    classYearStatus: ClassYearStatus;
    competitionAgeGroup: RankingAgeBracket | null;
    gamesQualified: number;
  },
  overrides?: {
    publicRankAllowed?: boolean;
    snapshotEligible?: boolean;
    ageVerificationStatus?: AgeVerificationStatus;
  }
): EligibilityVerdict {
  return buildVerdict(input, evaluationDate, policyVersionId, {
    verdict: "PROVISIONAL",
    provisionalReason: reason,
    precedenceRule,
    ...context,
    ...overrides
  });
}

function hidden(
  input: EligibilityInput,
  evaluationDate: Date,
  policyVersionId: string,
  reason: ExclusionReason,
  precedenceRule: string,
  context: {
    competitionTrustLevel: CompetitionTrustLevel;
    classYearStatus: ClassYearStatus;
    competitionAgeGroup: RankingAgeBracket | null;
    gamesQualified: number;
  }
): EligibilityVerdict {
  return buildVerdict(input, evaluationDate, policyVersionId, {
    verdict: "HIDDEN",
    exclusionReason: reason,
    precedenceRule,
    publicRankAllowed: false,
    snapshotEligible: false,
    ...context
  });
}

function former(
  input: EligibilityInput,
  evaluationDate: Date,
  policyVersionId: string,
  precedenceRule: string,
  context: {
    competitionTrustLevel: CompetitionTrustLevel;
    classYearStatus: ClassYearStatus;
    competitionAgeGroup: RankingAgeBracket | null;
    gamesQualified: number;
  }
): EligibilityVerdict {
  return buildVerdict(input, evaluationDate, policyVersionId, {
    verdict: "FORMER",
    exclusionReason: "GRADUATED",
    precedenceRule,
    publicRankAllowed: false,
    snapshotEligible: false,
    ...context
  });
}

export function evaluateEligibility(input: EligibilityInput): EligibilityVerdict {
  const evaluationDate = input.evaluationDate ?? new Date();
  const policyVersionId = input.policyVersionId ?? LAUNCH_POLICY_V1_ID;
  const gamesQualified = input.gamesQualified ?? input.verifiedGameCount;
  const threshold = resolveLaunchThreshold(input.gender, policyVersionId);
  const trustLevel = input.competitionTrustLevel ?? "STANDARD";
  const competitionAgeGroup = getRankingAgeBracket(input.birthDate, evaluationDate);
  const classYearStatus = deriveClassYearStatus(input.birthDate, input.classYearOverride, input.evaluatedBoard, evaluationDate);
  const computedBracket = getCurrentRankingAgeBracket(
    input.birthDate,
    evaluationDate,
    input.classYearOverride,
    input.evaluatedBoard
  );
  const context = {
    competitionTrustLevel: trustLevel,
    classYearStatus,
    competitionAgeGroup,
    gamesQualified
  };

  if (input.rankingInactive) {
    return hidden(input, evaluationDate, policyVersionId, "RANKING_INACTIVE", "P1", context);
  }

  if (input.frozenVerdict === "FORMER") {
    return former(input, evaluationDate, policyVersionId, "P5", context);
  }

  if (
    input.evaluatedBoard === "U19"
    && classYearStatus === "GRADUATED"
    && (input.birthDate || input.classYearOverride != null)
  ) {
    return former(input, evaluationDate, policyVersionId, "P2", context);
  }

  if (input.birthDate && computedBracket === "OUT_OF_RANGE") {
    return hidden(input, evaluationDate, policyVersionId, "OUT_OF_BRACKET", "P3", context);
  }

  if (gamesQualified <= 0) {
    return hidden(input, evaluationDate, policyVersionId, "ZERO_GAMES", "P6", context);
  }

  if (!input.hasTargetBoardRating) {
    return hidden(input, evaluationDate, policyVersionId, "NO_RATING_BASIS", "P8", context);
  }

  const overrideBoard = normalizeEligibilityBoard(input.ageGroupOverride);
  if (
    overrideBoard === input.evaluatedBoard
    && input.ratingAgeGroup
    && input.ratingAgeGroup !== input.evaluatedBoard
  ) {
    return provisional(input, evaluationDate, policyVersionId, "OVERRIDE_CROSS_BRACKET", "P14", context, {
      publicRankAllowed: false,
      snapshotEligible: false
    });
  }

  if (!input.birthDate) {
    if (trustLevel === "UNTRUSTED") {
      return hidden(input, evaluationDate, policyVersionId, "UNTRUSTED_UNKNOWN_DOB", "P11", context);
    }
    if ((input.dobEscalationTier ?? 0) >= 2) {
      return hidden(input, evaluationDate, policyVersionId, "UNTRUSTED_UNKNOWN_DOB", "P13", context);
    }
    if (gamesQualified < threshold) {
      return provisional(input, evaluationDate, policyVersionId, "BELOW_THRESHOLD", "P7", context, {
        publicRankAllowed: false,
        snapshotEligible: false
      });
    }

    const pendingPublic = satisfiesPendingPublicPath(input, evaluationDate, gamesQualified, policyVersionId);
    return provisional(input, evaluationDate, policyVersionId, "UNKNOWN_DOB", "P12", context, {
      publicRankAllowed: pendingPublic,
      snapshotEligible: pendingPublic,
      ageVerificationStatus: "PENDING"
    });
  }

  if (computedBracket && computedBracket !== "OUT_OF_RANGE" && computedBracket !== input.evaluatedBoard) {
    return hidden(input, evaluationDate, policyVersionId, "OUT_OF_BRACKET", "P3", context);
  }

  if (gamesQualified < threshold) {
    return provisional(input, evaluationDate, policyVersionId, "BELOW_THRESHOLD", "P7", context, {
      publicRankAllowed: false,
      snapshotEligible: false,
      ageVerificationStatus: "VERIFIED"
    });
  }

  return buildVerdict(input, evaluationDate, policyVersionId, {
    verdict: "RANKED",
    precedenceRule: gamesQualified >= resolveLaunchPolicy(policyVersionId).matureThreshold ? "P10" : "P9",
    matureEligible: gamesQualified >= resolveLaunchPolicy(policyVersionId).matureThreshold,
    ageVerificationStatus: "VERIFIED",
    publicRankAllowed: true,
    snapshotEligible: true,
    ...context
  });
}

export function isPublicBoardVisible(verdict: EligibilityVerdict): boolean {
  return verdict.publicRankAllowed;
}

export function isPublicBoardRanked(verdict: EligibilityVerdict): boolean {
  return verdict.verdict === "RANKED" && verdict.publicRankAllowed;
}

export function shouldShowAgeUnverifiedBadge(verdict: EligibilityVerdict): boolean {
  return verdict.ageVerificationStatus === "PENDING" && verdict.publicRankAllowed;
}

export function evaluateBoardEligibility(
  inputs: EligibilityInput[]
): Array<{ input: EligibilityInput; verdict: EligibilityVerdict }> {
  return inputs.map((input) => ({ input, verdict: evaluateEligibility(input) }));
}

export function buildEligibilityInput(params: {
  playerId: string;
  gender: "Boys" | "Girls" | "BOYS" | "GIRLS";
  birthDate: Date | null;
  firstRankingEligibilityAt?: Date | null;
  classYearOverride?: number | null;
  ageGroupOverride?: string | null;
  ratingAgeGroup: EligibilityBoard;
  verifiedGameCount: number;
  evaluatedBoard: EligibilityBoard;
  formulaVersionId?: string | null;
  evaluationDate?: Date;
  competitionTrustLevel?: CompetitionTrustLevel;
  dobEscalationTier?: number;
}): EligibilityInput {
  return {
    playerId: params.playerId,
    gender: normalizeEligibilityGender(params.gender),
    birthDate: params.birthDate,
    firstRankingEligibilityAt: params.firstRankingEligibilityAt ?? null,
    classYearOverride: params.classYearOverride,
    ageGroupOverride: params.ageGroupOverride,
    ratingAgeGroup: params.ratingAgeGroup,
    verifiedGameCount: params.verifiedGameCount,
    hasTargetBoardRating: true,
    evaluatedBoard: params.evaluatedBoard,
    evaluationDate: params.evaluationDate,
    formulaVersionId: params.formulaVersionId ?? null,
    policyVersionId: LAUNCH_POLICY_V1_ID,
    competitionTrustLevel: params.competitionTrustLevel,
    dobEscalationTier: params.dobEscalationTier
  };
}
