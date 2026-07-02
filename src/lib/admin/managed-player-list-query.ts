import type { Prisma } from "@prisma/client";
import { ProgramType } from "@prisma/client";

import {
  getAgeBracketAsOfMarch31,
  getRankingSeasonYear,
  type RankingAgeBracket,
} from "@/lib/ranking-eligibility";

const DISPLAY_BRACKETS = ["U13", "U16", "U19", "Unknown"] as const;
type DisplayAgeBracket = (typeof DISPLAY_BRACKETS)[number];

const bracketBirthRangeCache = new Map<string, { gte: Date; lte: Date } | null>();

export function birthDateRangeForMarch31Bracket(
  bracket: Exclude<RankingAgeBracket, "OUT_OF_RANGE">,
  seasonYear = getRankingSeasonYear(),
): { gte: Date; lte: Date } | null {
  const cacheKey = `${bracket}:${seasonYear}`;
  if (bracketBirthRangeCache.has(cacheKey)) {
    return bracketBirthRangeCache.get(cacheKey) ?? null;
  }

  let min: Date | undefined;
  let max: Date | undefined;
  const start = new Date(Date.UTC(seasonYear - 25, 0, 1));
  const end = new Date(Date.UTC(seasonYear - 5, 11, 31));

  for (let time = start.getTime(); time <= end.getTime(); time += 24 * 60 * 60 * 1000) {
    const birthDate = new Date(time);
    if (getAgeBracketAsOfMarch31(birthDate, seasonYear) === bracket) {
      if (!min || birthDate < min) min = birthDate;
      if (!max || birthDate > max) max = birthDate;
    }
  }

  const range = min && max ? { gte: min, lte: max } : null;
  bracketBirthRangeCache.set(cacheKey, range);
  return range;
}
function noAgeGroupOverrideWhere(): Prisma.PlayerWhereInput {
  return { OR: [{ ageGroupOverride: null }, { ageGroupOverride: "" }] };
}

export function buildDisplayAgeBracketWhere(bracket: DisplayAgeBracket): Prisma.PlayerWhereInput {
  if (bracket === "Unknown") {
    return {
      AND: [noAgeGroupOverrideWhere(), { birthDate: null }],
    };
  }

  const birthRange = birthDateRangeForMarch31Bracket(bracket);
  const computedMatch: Prisma.PlayerWhereInput = birthRange
    ? {
        AND: [noAgeGroupOverrideWhere(), { birthDate: { gte: birthRange.gte, lte: birthRange.lte } }],
      }
    : { id: { in: [] } };

  return {
    OR: [{ ageGroupOverride: bracket }, computedMatch],
  };
}

function buildProgramFilter(program: string): Prisma.PlayerWhereInput | null {
  if (program === "All") return null;

  if (program === "Program pending") {
    return {
      schoolOverride: null,
      currentProgramId: null,
    };
  }

  return {
    OR: [
      { schoolOverride: { equals: program, mode: "insensitive" } },
      {
        AND: [
          noAgeGroupOverrideWhere(),
          {
            currentProgram: {
              OR: [
                { fullName: { equals: program, mode: "insensitive" } },
                { abbreviation: { equals: program, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
      {
        AND: [
          noAgeGroupOverrideWhere(),
          {
            currentProgram: {
              type: { not: ProgramType.SCHOOL },
              fullName: { equals: program, mode: "insensitive" },
            },
          },
        ],
      },
    ],
  };
}

function buildSearchFilter(search: string): Prisma.PlayerWhereInput | null {
  const query = search.trim();
  if (!query) return null;

  const lowered = query.toLowerCase();
  const or: Prisma.PlayerWhereInput[] = [
    { displayName: { contains: query, mode: "insensitive" } },
    { firstName: { contains: query, mode: "insensitive" } },
    { lastName: { contains: query, mode: "insensitive" } },
    { city: { contains: query, mode: "insensitive" } },
    { hometown: { contains: query, mode: "insensitive" } },
    { region: { contains: query, mode: "insensitive" } },
    { schoolOverride: { contains: query, mode: "insensitive" } },
    { currentProgram: { is: { fullName: { contains: query, mode: "insensitive" } } } },
    { currentProgram: { is: { abbreviation: { contains: query, mode: "insensitive" } } } },
  ];

  if (lowered.includes("boy")) or.push({ gender: "BOYS" });
  if (lowered.includes("girl")) or.push({ gender: "GIRLS" });

  for (const bracket of DISPLAY_BRACKETS) {
    if (lowered.includes(bracket.toLowerCase())) {
      or.push(buildDisplayAgeBracketWhere(bracket));
    }
  }

  return { OR: or };
}

export type ManagedPlayerListFilters = {
  search: string;
  program: string;
  gender: string;
  ageBracket: string;
};

export function buildManagedPlayerListWhere(filters: ManagedPlayerListFilters): Prisma.PlayerWhereInput {
  const and: Prisma.PlayerWhereInput[] = [{ deletedAt: null }];

  const searchWhere = buildSearchFilter(filters.search);
  if (searchWhere) and.push(searchWhere);

  if (filters.gender !== "All") {
    and.push({ gender: filters.gender as "BOYS" | "GIRLS" });
  }

  const programWhere = buildProgramFilter(filters.program);
  if (programWhere) and.push(programWhere);

  if (filters.ageBracket !== "All" && DISPLAY_BRACKETS.includes(filters.ageBracket as DisplayAgeBracket)) {
    and.push(buildDisplayAgeBracketWhere(filters.ageBracket as DisplayAgeBracket));
  }

  return and.length === 1 ? and[0]! : { AND: and };
}
