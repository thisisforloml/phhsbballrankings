"use client";

import { publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";
import type { RecruitingClassYearOption } from "@/lib/recruiting-class-filter";

type RecruitingClassFilterProps = {
  options: RecruitingClassYearOption[];
  activeYear: number | "all";
  includeUnknownClass: boolean;
  onSelectYear: (year: number | "all") => void;
  onToggleUnknown: (value: boolean) => void;
};

export function RecruitingClassFilter({
  options,
  activeYear,
  includeUnknownClass,
  onSelectYear,
  onToggleUnknown
}: RecruitingClassFilterProps) {
  if (options.length <= 1) return null;

  return (
    <section className="border-b border-line-500 bg-paper-500">
      <div className="container-px py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-court-500">Graduation class</p>
            <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Graduation class filter">
              {options.map((option) => {
                const selected = activeYear === option.year;
                return (
                  <button
                    key={String(option.year)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => onSelectYear(option.year)}
                    className={`border px-3 py-1.5 text-xs font-black ${selected ? "border-court-900 bg-court-900 text-white" : "border-line-500 bg-white text-court-700 hover:border-court-900"}`}
                  >
                    {option.label}
                    <span className="ml-1 font-semibold opacity-75">({option.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          {activeYear !== "all" ? (
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-court-600">
              <input
                type="checkbox"
                checked={includeUnknownClass}
                onChange={(event) => onToggleUnknown(event.target.checked)}
              />
              Include unknown class year
            </label>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-court-500">{publicRankingsCoverageCopy.recruitingHelper}</p>
      </div>
    </section>
  );
}
