import { SubmissionType, VerificationStatus } from "@prisma/client";

import { TEAM_EVIDENCE_POLICY_V1 } from "./constants";

export type TeamEvidenceGameFilter = {
  verificationStatus: VerificationStatus;
  submissionType: SubmissionType;
  deletedAt: Date | null;
  homeProgramId: string | null;
  awayProgramId: string | null;
};

/**
 * TEAM-EVIDENCE-v1-official-import
 * @see docs/planning/audits/TEAM_TR35_COMPETITION_VERIFICATION_POLICY.md
 */
export function isTeamEvidenceEligibleGame(game: TeamEvidenceGameFilter): boolean {
  if (game.deletedAt !== null) return false;
  if (game.submissionType !== SubmissionType.STAFF_MANUAL_ENTRY) return false;
  if (!game.homeProgramId || !game.awayProgramId) return false;
  return (
    game.verificationStatus === VerificationStatus.VERIFIED ||
    game.verificationStatus === VerificationStatus.SUBMITTED
  );
}

export function assertTeamEvidencePolicyVersion(version: string) {
  if (version !== TEAM_EVIDENCE_POLICY_V1) {
    throw new Error(`Unsupported team evidence policy: ${version}`);
  }
}
