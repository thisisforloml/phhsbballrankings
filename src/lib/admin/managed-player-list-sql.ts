import { type AgeGroup, Prisma, ProgramType, type ProgramType as ProgramTypeEnum } from "@prisma/client";

import type { ManagedPlayerListFilters } from "@/lib/admin/managed-player-list-query";
import { birthDateRangeForMarch31Bracket } from "@/lib/admin/managed-player-list-query";

function searchSql(search: string): Prisma.Sql | null {
  const query = search.trim();
  if (!query) return null;

  const pattern = `%${query}%`;
  const lowered = query.toLowerCase();
  const clauses: Prisma.Sql[] = [
    Prisma.sql`p."displayName" ILIKE ${pattern}`,
    Prisma.sql`p."firstName" ILIKE ${pattern}`,
    Prisma.sql`p."lastName" ILIKE ${pattern}`,
    Prisma.sql`p.city ILIKE ${pattern}`,
    Prisma.sql`p.hometown ILIKE ${pattern}`,
    Prisma.sql`p.region ILIKE ${pattern}`,
    Prisma.sql`p."schoolOverride" ILIKE ${pattern}`,
    Prisma.sql`pr."fullName" ILIKE ${pattern}`,
    Prisma.sql`pr.abbreviation ILIKE ${pattern}`,
  ];

  if (lowered.includes("boy")) clauses.push(Prisma.sql`p.gender = 'BOYS'`);
  if (lowered.includes("girl")) clauses.push(Prisma.sql`p.gender = 'GIRLS'`);

  for (const bracket of ["U13", "U16", "U19", "Unknown"] as const) {
    if (lowered.includes(bracket.toLowerCase())) {
      clauses.push(displayAgeBracketSql(bracket));
    }
  }

  return Prisma.sql`(${Prisma.join(clauses, " OR ")})`;
}

function displayAgeBracketSql(bracket: "U13" | "U16" | "U19" | "Unknown"): Prisma.Sql {
  if (bracket === "Unknown") {
    return Prisma.sql`((p."ageGroupOverride" IS NULL OR p."ageGroupOverride" = '') AND p."birthDate" IS NULL)`;
  }

  const range = birthDateRangeForMarch31Bracket(bracket);
  if (!range) {
    return Prisma.sql`p."ageGroupOverride" = ${bracket}`;
  }

  return Prisma.sql`(
    p."ageGroupOverride" = ${bracket}
    OR (
      (p."ageGroupOverride" IS NULL OR p."ageGroupOverride" = '')
      AND p."birthDate" IS NOT NULL
      AND p."birthDate" >= ${range.gte}
      AND p."birthDate" <= ${range.lte}
    )
  )`;
}

function programSql(program: string): Prisma.Sql | null {
  if (program === "All") return null;
  if (program === "Program pending") {
    return Prisma.sql`(p."schoolOverride" IS NULL AND p."currentProgramId" IS NULL)`;
  }

  return Prisma.sql`(
    p."schoolOverride" ILIKE ${program}
    OR (
      (p."schoolOverride" IS NULL OR p."schoolOverride" = '')
      AND (
        pr."fullName" ILIKE ${program}
        OR pr.abbreviation ILIKE ${program}
      )
    )
    OR (
      (p."schoolOverride" IS NULL OR p."schoolOverride" = '')
      AND pr.type IS NOT NULL
      AND pr.type::text <> ${ProgramType.SCHOOL}
      AND pr."fullName" ILIKE ${program}
    )
  )`;
}

export function buildManagedPlayerListSqlWhere(filters: ManagedPlayerListFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`p."deletedAt" IS NULL`];

  const searchClause = searchSql(filters.search);
  if (searchClause) clauses.push(searchClause);

  if (filters.gender !== "All") {
    clauses.push(Prisma.sql`p.gender = ${filters.gender}::"PlayerGender"`);
  }

  const programClause = programSql(filters.program);
  if (programClause) clauses.push(programClause);

  if (filters.ageBracket !== "All") {
    clauses.push(displayAgeBracketSql(filters.ageBracket as "U13" | "U16" | "U19" | "Unknown"));
  }

  return Prisma.join(clauses, " AND ");
}

export type ManagedPlayerListSqlRow = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender: "BOYS" | "GIRLS";
  schoolOverride: string | null;
  birthDate: Date | null;
  ageGroupOverride: string | null;
  city: string;
  hometown: string | null;
  region: string;
  currentProgramId: string | null;
  position: string | null;
  heightCm: number | null;
  classYearOverride: number | null;
  photoUrl: string | null;
  commitmentStatus: "UNDECLARED" | "COMMITTED";
  committedUniversity: string | null;
  programFullName: string | null;
  programAbbreviation: string | null;
  programType: ProgramTypeEnum | null;
  filteredCount: number;
};

export function mapManagedPlayerListSqlRow(
  row: ManagedPlayerListSqlRow,
  currentRatings: Array<{ ageGroup: AgeGroup; adjustedRating: unknown; verifiedGameCount: number }> = [],
) {
  return {
    id: row.id,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender,
    schoolOverride: row.schoolOverride,
    birthDate: row.birthDate,
    ageGroupOverride: row.ageGroupOverride,
    city: row.city,
    hometown: row.hometown,
    region: row.region,
    currentProgramId: row.currentProgramId,
    position: row.position,
    heightCm: row.heightCm,
    classYearOverride: row.classYearOverride,
    photoUrl: row.photoUrl,
    commitmentStatus: row.commitmentStatus,
    committedUniversity: row.committedUniversity,
    currentProgram:
      row.programFullName && row.programType
        ? {
            fullName: row.programFullName,
            abbreviation: row.programAbbreviation,
            type: row.programType,
          }
        : null,
    currentRatings,
  };
}
