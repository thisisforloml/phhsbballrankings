import { AgeGroup, PlayerGender } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { TEAM_EVIDENCE_POLICY_V1, TEAM_THRESHOLD_POLICY_V1 } from "./constants";

export type TeamSnapshotBoardRowInput = {
  programId: string;
  rank: number;
  rating: number;
  verifiedGameCount: number;
  verifiedOpponentCount: number;
  verifiedCompetitionCount: number;
  programName: string;
  programAbbreviation: string | null;
  movement: number;
};

export type BuildTeamSnapshotBoardRowsParams = {
  ageGroup: AgeGroup;
  gender: PlayerGender;
  evaluationDate: Date;
  teamFormulaVersionId: string;
  evidencePolicyVersion?: string;
  thresholdPolicyVersion?: string;
};

export type BuildTeamSnapshotBoardRowsResult = {
  rows: TeamSnapshotBoardRowInput[];
  liveEligibleCount: number;
  excludedBelowThreshold: number;
};

export async function buildTeamSnapshotBoardRows(
  params: BuildTeamSnapshotBoardRowsParams
): Promise<BuildTeamSnapshotBoardRowsResult> {
  const evidencePolicyVersion = params.evidencePolicyVersion ?? TEAM_EVIDENCE_POLICY_V1;
  const thresholdPolicyVersion = params.thresholdPolicyVersion ?? TEAM_THRESHOLD_POLICY_V1;

  const liveRows = await prisma.programTeamRating.findMany({
    where: {
      ageGroup: params.ageGroup,
      gender: params.gender,
      teamFormulaVersionId: params.teamFormulaVersionId,
      evidencePolicyVersion,
      thresholdPolicyVersion,
      program: { deletedAt: null }
    },
    include: {
      program: { select: { id: true, fullName: true, abbreviation: true, deletedAt: true } }
    },
    orderBy: [{ rating: "desc" }, { verifiedGameCount: "desc" }, { program: { fullName: "asc" } }]
  });

  const eligible = liveRows.filter((row) => row.publicBoardEligible);
  const priorPublished = await prisma.teamRankingSnapshot.findFirst({
    where: {
      ageGroup: params.ageGroup,
      gender: params.gender,
      status: "PUBLISHED",
      teamFormulaVersionId: params.teamFormulaVersionId,
      evidencePolicyVersion,
      thresholdPolicyVersion
    },
    orderBy: { weekOf: "desc" },
    include: {
      rows: { select: { programId: true, rank: true } }
    }
  });
  const priorRank = new Map(
    priorPublished?.rows.map((row) => [row.programId, row.rank]) ?? []
  );

  const rows: TeamSnapshotBoardRowInput[] = eligible.map((row, index) => {
    const rank = index + 1;
    const prior = priorRank.get(row.programId);
    return {
      programId: row.programId,
      rank,
      rating: Number(row.rating),
      verifiedGameCount: row.verifiedGameCount,
      verifiedOpponentCount: row.verifiedOpponentCount,
      verifiedCompetitionCount: row.verifiedCompetitionCount,
      programName: row.program.fullName,
      programAbbreviation: row.program.abbreviation,
      movement: prior !== undefined ? prior - rank : 0
    };
  });

  return {
    rows,
    liveEligibleCount: eligible.length,
    excludedBelowThreshold: liveRows.length - eligible.length
  };
}
