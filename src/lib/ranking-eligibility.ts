export function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function getRankingSeasonYear(asOfDate = new Date()): number {
  const month = asOfDate.getUTCMonth() + 1;
  return month >= 6 ? asOfDate.getUTCFullYear() : asOfDate.getUTCFullYear() - 1;
}

export function getClassYear(birthDate: Date | null): number | null {
  if (!birthDate) return null;

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth() + 1;

  return birthMonth >= 1 && birthMonth <= 3 ? birthYear + 19 : birthYear + 20;
}

export function getEffectiveClassYear(birthDate: Date | null, classYearOverride: number | null | undefined = null): number | null {
  return classYearOverride ?? getClassYear(birthDate);
}

export function isRankingEligibleByClassYear(birthDate: Date | null, snapshotDate: Date, classYearOverride: number | null | undefined = null): boolean {
  const classYear = getEffectiveClassYear(birthDate, classYearOverride);
  if (classYear === null) return true;

  const exclusionStart = new Date(Date.UTC(classYear, 5, 1));
  return getMonthStart(snapshotDate).getTime() < exclusionStart.getTime();
}

export function formatClassYear(birthDate: Date | null): string | null {
  const classYear = getClassYear(birthDate);
  return classYear === null ? null : `Class of ${classYear}`;
}


export type RankingAgeBracket = "U13" | "U16" | "U19" | "OUT_OF_RANGE";

export function getCalendarAge(birthDate: Date | null, asOfDate = new Date()): number | null {
  if (!birthDate) return null;
  let age = asOfDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = asOfDate.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOfDate.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function getAgeBracketFromAge(age: number | null): RankingAgeBracket | null {
  if (age === null) return null;
  if (age <= 13) return "U13";
  if (age >= 14 && age <= 16) return "U16";
  if (age >= 17 && age <= 19) return "U19";
  return "OUT_OF_RANGE";
}

/** Calendar-age bracket as of the evaluation date (public boards and eligibility). */
export function getRankingAgeBracket(birthDate: Date | null, asOfDate = new Date()): RankingAgeBracket | null {
  return getAgeBracketFromAge(getCalendarAge(birthDate, asOfDate));
}

/** Season audit helper: age as of March 31 for the ranking season year. */
export function getAgeAsOfMarch31(birthDate: Date | null, year = getRankingSeasonYear()): number | null {
  if (!birthDate) return null;

  let age = year - birthDate.getUTCFullYear();
  const birthdayInYear = new Date(Date.UTC(year, birthDate.getUTCMonth(), birthDate.getUTCDate()));
  const cutoff = new Date(Date.UTC(year, 2, 31));

  if (birthdayInYear.getTime() > cutoff.getTime()) age -= 1;
  return age;
}

/** Season audit helper: bracket frozen at March 31 of the ranking season year. */
export function getAgeBracketAsOfMarch31(birthDate: Date | null, year = getRankingSeasonYear()): RankingAgeBracket | null {
  return getAgeBracketFromAge(getAgeAsOfMarch31(birthDate, year));
}

export function getCurrentRankingAgeBracket(
  birthDate: Date | null,
  asOfDate = new Date(),
  classYearOverride: number | null | undefined = null,
  ratingAgeGroup: "U13" | "U16" | "U19" | null = null
): RankingAgeBracket | null {
  const bracket = getRankingAgeBracket(birthDate, asOfDate);
  const appliesToU19 = bracket === "U19" || (bracket === null && ratingAgeGroup === "U19");
  if (appliesToU19 && !isRankingEligibleByClassYear(birthDate, asOfDate, classYearOverride)) return "OUT_OF_RANGE";
  return bracket;
}
