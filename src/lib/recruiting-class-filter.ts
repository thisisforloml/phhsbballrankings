import type { NationalRankingRow } from "@/lib/rankings";

export type ClassYearFilterOptions = {
  classYear: number | "all";
  includeUnknownClass?: boolean;
};

export type RecruitingClassYearOption = {
  year: number | "all";
  label: string;
  count: number;
};

const defaultMinChipCount = 3;
const defaultMaxChips = 6;

export function parseClassYearParam(value: string | null): number | "all" {
  if (!value?.trim()) return "all";
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1990 || parsed > 2100) return "all";
  return parsed;
}

export function applyClassYearFilter(rows: NationalRankingRow[], options: ClassYearFilterOptions): NationalRankingRow[] {
  if (options.classYear === "all") return rows;

  const includeUnknown = options.includeUnknownClass ?? false;
  return rows.filter((row) => {
    if (row.effectiveClassYear === options.classYear) return true;
    return includeUnknown && row.effectiveClassYear === null;
  });
}

export function getRecruitingClassYearOptions(
  rows: NationalRankingRow[],
  config?: { minCount?: number; maxChips?: number }
): RecruitingClassYearOption[] {
  const minCount = config?.minCount ?? defaultMinChipCount;
  const maxChips = config?.maxChips ?? defaultMaxChips;
  const counts = new Map<number, number>();

  for (const row of rows) {
    if (row.effectiveClassYear == null) continue;
    counts.set(row.effectiveClassYear, (counts.get(row.effectiveClassYear) ?? 0) + 1);
  }

  const years = [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort(([left], [right]) => left - right)
    .slice(0, maxChips);

  return [
    { year: "all", label: "All", count: rows.length },
    ...years.map(([year, count]) => ({
      year,
      label: `Class of ${year}`,
      count
    }))
  ];
}

export function recruitingRankColumnLabel(gender: "Boys" | "Girls", classYear: number | "all"): string {
  if (classYear === "all") return "Rank";
  return gender === "Girls" ? "U19 Girls National Rank" : "U19 Boys National Rank";
}

export function shouldShowRecruitingSortBanner(classYear: number | "all", sortKey: string): boolean {
  return classYear !== "all" && sortKey !== "rank";
}
