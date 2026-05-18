export function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function getClassYear(birthDate: Date | null): number | null {
  if (!birthDate) return null;

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth() + 1;

  return birthMonth >= 1 && birthMonth <= 5 ? birthYear + 19 : birthYear + 20;
}

export function isRankingEligibleByClassYear(birthDate: Date | null, snapshotDate: Date): boolean {
  const classYear = getClassYear(birthDate);
  if (classYear === null) return true;

  const exclusionStart = new Date(Date.UTC(classYear, 5, 1));
  return getMonthStart(snapshotDate).getTime() < exclusionStart.getTime();
}

export function formatClassYear(birthDate: Date | null): string | null {
  const classYear = getClassYear(birthDate);
  return classYear === null ? null : `Class of ${classYear}`;
}
