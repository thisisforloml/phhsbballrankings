"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { publicRankingsCoverageCopy } from "@/lib/public-rankings-coverage";
import type { RecruitingClassYearOption } from "@/lib/recruiting-class-filter";

type RecruitingClassFilterProps = {
  options: RecruitingClassYearOption[];
  activeYear: number | "all";
  includeUnknownClass: boolean;
  onSelectYear: (year: number | "all") => void;
  onToggleUnknown: (value: boolean) => void;
  embedded?: boolean;
  alwaysExpanded?: boolean;
};

export function RecruitingClassFilter({
  options,
  activeYear,
  includeUnknownClass,
  onSelectYear,
  onToggleUnknown,
  embedded = false,
  alwaysExpanded = false,
}: RecruitingClassFilterProps) {
  const filterActive = activeYear !== "all";
  const [open, setOpen] = useState(alwaysExpanded || filterActive);

  useEffect(() => {
    if (alwaysExpanded || filterActive) setOpen(true);
  }, [alwaysExpanded, filterActive]);

  if (options.length <= 1) return null;

  const activeLabel = options.find((option) => option.year === activeYear)?.label ?? "All";
  const wrapperClass = embedded ? "" : "border-b border-line-500 bg-paper-500";
  const expanded = alwaysExpanded || open;

  return (
    <section className={wrapperClass}>
      <div className={embedded ? "" : "container-px py-2"}>
        {alwaysExpanded ? (
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-court-500">
            Graduation class
            {filterActive ? <span className="normal-case text-court-800"> · {activeLabel}</span> : null}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 py-1 text-left"
            aria-expanded={expanded}
          >
            <span className="text-sm text-court-600">
              Graduation class
              {filterActive ? <span className="text-court-800"> · {activeLabel}</span> : null}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-court-400 transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        )}

        {expanded ? (
          <div className={`${alwaysExpanded ? "pt-3" : "pb-1 pt-3"}`}>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Graduation class filter">
              {options.map((option) => {
                const selected = activeYear === option.year;
                return (
                  <button
                    key={String(option.year)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => onSelectYear(option.year)}
                    title={`${option.count} players`}
                    className={`px-3 py-1.5 text-sm transition ${
                      selected
                        ? "bg-court-900 text-white"
                        : "bg-white text-court-600 ring-1 ring-line-500 hover:text-court-900"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {filterActive ? (
              <>
                <label className="mt-3 flex items-center gap-2 text-sm text-court-600">
                  <input
                    type="checkbox"
                    checked={includeUnknownClass}
                    onChange={(event) => onToggleUnknown(event.target.checked)}
                  />
                  Include unknown class year
                </label>
                <p className="mt-2 text-xs leading-5 text-court-500">
                  {publicRankingsCoverageCopy.recruitingClassFilterActive}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
