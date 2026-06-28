import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPlayerGenderLabel } from "./get-admin-program-team-rating-board";

export type NationalTeamRatingRow = {
  id: string;
  programId: string;
  programName: string;
  programAbbreviation: string | null;
  city: string;
  region: string;
  teamId: string | null;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  genderLabel: "Boys" | "Girls";
  rating: number;
  verifiedGameCount: number;
  verifiedOpponentCount: number;
  rank: number;
  publicBoardEligible: boolean;
  formulaVersion: string;
  computedAt: string;
};

export type NationalTeamRankingsData = {
  rows: NationalTeamRatingRow[];
  filters: {
    ageGroups: AgeGroup[];
    genders: PlayerGender[];
    default: { ageGroup: AgeGroup; gender: PlayerGender } | null;
  };
  meta: {
    formulaVersion: string;
    evidencePolicyVersion: string;
    thresholdPolicyVersion: string;
    lastComputedAt: string | null;
  };
};

function toNumber(value: { toString(): string }) {
  return Number(value);
}

export async function getNationalTeamRankings(): Promise<NationalTeamRankingsData> {
  const rawRows = await prisma.programTeamRating.findMany({
    where: {
      publicBoardEligible: true,
      program: { deletedAt: null }
    },
    include: {
      program: {
        select: {
          id: true,
          fullName: true,
          abbreviation: true,
          city: true,
          region: true,
          teams: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
            orderBy: { name: "asc" }
          }
        }
      },
      teamFormulaVersion: { select: { slug: true } }
    },
    orderBy: [{ ageGroup: "asc" }, { gender: "asc" }, { rating: "desc" }, { verifiedGameCount: "desc" }, { program: { fullName: "asc" } }]
  });

  const byBoard = new Map<string, typeof rawRows>();
  for (const row of rawRows) {
    const key = `${row.ageGroup}:${row.gender}`;
    if (!byBoard.has(key)) byBoard.set(key, []);
    byBoard.get(key)!.push(row);
  }

  const rows: NationalTeamRatingRow[] = [];
  for (const boardRows of byBoard.values()) {
    boardRows.forEach((row, index) => {
      rows.push({
        id: `${row.programId}:${row.ageGroup}:${row.gender}`,
        programId: row.programId,
        programName: row.program.fullName,
        programAbbreviation: row.program.abbreviation,
        city: row.program.city ?? "Not listed",
        region: row.program.region ?? "Not listed",
        teamId: row.program.teams[0]?.id ?? null,
        ageGroup: row.ageGroup,
        gender: row.gender,
        genderLabel: formatPlayerGenderLabel(row.gender) as "Boys" | "Girls",
        rating: toNumber(row.rating),
        verifiedGameCount: row.verifiedGameCount,
        verifiedOpponentCount: row.verifiedOpponentCount,
        rank: index + 1,
        publicBoardEligible: row.publicBoardEligible,
        formulaVersion: row.teamFormulaVersion.slug,
        computedAt: row.computedAt.toISOString()
      });
    });
  }

  const ageGroups = Array.from(new Set(rows.map((row) => row.ageGroup))).sort() as AgeGroup[];
  const genders = Array.from(new Set(rows.map((row) => row.gender))).sort() as PlayerGender[];
  const preferred =
    rows.find((row) => row.ageGroup === AgeGroup.U16 && row.gender === PlayerGender.BOYS) ??
    rows[0] ??
    null;

  const computedAts = rawRows.map((row) => row.computedAt.getTime());
  const sample = rawRows[0];

  return {
    rows,
    filters: {
      ageGroups,
      genders,
      default: preferred
        ? { ageGroup: preferred.ageGroup, gender: preferred.gender }
        : null
    },
    meta: {
      formulaVersion: sample?.teamFormulaVersion.slug ?? "TPI-v1",
      evidencePolicyVersion: sample?.evidencePolicyVersion ?? "",
      thresholdPolicyVersion: sample?.thresholdPolicyVersion ?? "",
      lastComputedAt:
        computedAts.length > 0 ? new Date(Math.max(...computedAts)).toISOString() : null
    }
  };
}
