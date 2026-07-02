import { AgeGroup, PlayerGender } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminProgramTeamRatingRow = {
  rank: number;
  programId: string;
  programName: string;
  programDeleted: boolean;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  rating: number;
  verifiedGameCount: number;
  verifiedOpponentCount: number;
  formulaVersion: string;
  policyVersion: string;
  computedAt: string;
  publicBoardEligible: boolean;
};

export type AdminProgramTeamRatingBoardMeta = {
  ageGroup: AgeGroup;
  gender: PlayerGender;
  boardSize: number;
  publicEligibleCount: number;
  belowThresholdCount: number;
  highestRating: number | null;
  lowestRating: number | null;
  highestProgram: string | null;
  lowestProgram: string | null;
  missingProgramWarnings: Array<{ programId: string; programName: string }>;
  duplicateProgramNameWarnings: Array<{ programName: string; programIds: string[] }>;
  formulaVersions: string[];
  evidencePolicyVersions: string[];
  thresholdPolicyVersions: string[];
  latestComputedAt: string | null;
};

export type AdminProgramTeamRatingBoardIndex = {
  key: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  count: number;
};

export type AdminProgramTeamRatingBoard = {
  rows: AdminProgramTeamRatingRow[];
  meta: AdminProgramTeamRatingBoardMeta;
};

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

function formatPolicyVersion(evidence: string, threshold: string) {
  return `${evidence} · ${threshold}`;
}

export async function getProgramTeamRatingBoardIndex(): Promise<AdminProgramTeamRatingBoardIndex[]> {
  const grouped = await prisma.programTeamRating.groupBy({
    by: ["ageGroup", "gender"],
    _count: { _all: true },
    orderBy: [{ ageGroup: "asc" }, { gender: "asc" }]
  });

  return grouped.map((row) => ({
    key: `${row.ageGroup}:${row.gender}`,
    ageGroup: row.ageGroup,
    gender: row.gender,
    count: row._count._all
  }));
}

export async function getAdminProgramTeamRatingBoard(
  ageGroup: AgeGroup,
  gender: PlayerGender
): Promise<AdminProgramTeamRatingBoard> {
  const rawRows = await prisma.programTeamRating.findMany({
    where: { ageGroup, gender },
    include: {
      program: { select: { id: true, fullName: true, deletedAt: true } },
      teamFormulaVersion: { select: { slug: true } }
    },
    orderBy: [{ rating: "desc" }, { verifiedGameCount: "desc" }, { program: { fullName: "asc" } }]
  });

  const rows: AdminProgramTeamRatingRow[] = rawRows.map((row, index) => ({
    rank: index + 1,
    programId: row.programId,
    programName: row.program.fullName,
    programDeleted: row.program.deletedAt !== null,
    ageGroup: row.ageGroup,
    gender: row.gender,
    rating: toNumber(row.rating) ?? 0,
    verifiedGameCount: row.verifiedGameCount,
    verifiedOpponentCount: row.verifiedOpponentCount,
    formulaVersion: row.teamFormulaVersion.slug,
    policyVersion: formatPolicyVersion(row.evidencePolicyVersion, row.thresholdPolicyVersion),
    computedAt: row.computedAt.toISOString(),
    publicBoardEligible: row.publicBoardEligible
  }));

  const ratings = rows.map((row) => row.rating);
  const highestIdx = ratings.length ? ratings.indexOf(Math.max(...ratings)) : -1;
  const lowestIdx = ratings.length ? ratings.indexOf(Math.min(...ratings)) : -1;

  const missingProgramWarnings = rows
    .filter((row) => row.programDeleted)
    .map((row) => ({ programId: row.programId, programName: row.programName }));

  const nameGroups = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.programName.trim().toLowerCase();
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key)!.push(row.programId);
  }
  const duplicateProgramNameWarnings = [...nameGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([programName, programIds]) => ({ programName, programIds }));

  const formulaVersions = [...new Set(rows.map((row) => row.formulaVersion))];
  const evidencePolicyVersions = [...new Set(rawRows.map((row) => row.evidencePolicyVersion))];
  const thresholdPolicyVersions = [...new Set(rawRows.map((row) => row.thresholdPolicyVersion))];
  const computedAts = rawRows.map((row) => row.computedAt.getTime());
  const latestComputedAt =
    computedAts.length > 0 ? new Date(Math.max(...computedAts)).toISOString() : null;

  const publicEligibleCount = rows.filter((row) => row.publicBoardEligible).length;

  return {
    rows,
    meta: {
      ageGroup,
      gender,
      boardSize: rows.length,
      publicEligibleCount,
      belowThresholdCount: rows.length - publicEligibleCount,
      highestRating: highestIdx >= 0 ? rows[highestIdx]!.rating : null,
      lowestRating: lowestIdx >= 0 ? rows[lowestIdx]!.rating : null,
      highestProgram: highestIdx >= 0 ? rows[highestIdx]!.programName : null,
      lowestProgram: lowestIdx >= 0 ? rows[lowestIdx]!.programName : null,
      missingProgramWarnings,
      duplicateProgramNameWarnings,
      formulaVersions,
      evidencePolicyVersions,
      thresholdPolicyVersions,
      latestComputedAt
    }
  };
}

export function parseAdminTeamRatingBoardFilters(
  ageGroupParam: string | undefined,
  genderParam: string | undefined,
  boardIndex: AdminProgramTeamRatingBoardIndex[]
): { ageGroup: AgeGroup; gender: PlayerGender } {
  const validAge = Object.values(AgeGroup).includes(ageGroupParam as AgeGroup)
    ? (ageGroupParam as AgeGroup)
    : AgeGroup.U16;
  const validGender = Object.values(PlayerGender).includes(genderParam as PlayerGender)
    ? (genderParam as PlayerGender)
    : PlayerGender.BOYS;

  const match = boardIndex.find((board) => board.ageGroup === validAge && board.gender === validGender);
  if (match) return { ageGroup: match.ageGroup, gender: match.gender };
  if (boardIndex.length > 0) {
    return { ageGroup: boardIndex[0]!.ageGroup, gender: boardIndex[0]!.gender };
  }
  return { ageGroup: validAge, gender: validGender };
}

export function formatPlayerGenderLabel(gender: PlayerGender) {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}
