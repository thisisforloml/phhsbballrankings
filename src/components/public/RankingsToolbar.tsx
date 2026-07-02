"use client";

import { type ReactNode,useEffect, useState } from "react";

import type { PublicCoverageAgeGroup } from "@/lib/public-rankings-coverage";
import type { RecruitingClassYearOption } from "@/lib/recruiting-class-filter";

const ageGroups: PublicCoverageAgeGroup[] = ["U13", "U16", "U19"];
const genders = ["Boys", "Girls"] as const;

const filterSelectClass =
  "min-h-10 w-full min-w-[8.5rem] rounded-sm border border-line-500 bg-white px-3 py-2 text-sm font-semibold text-court-900 outline-none focus:border-hardwood-600";

const filterInputClass =
  "min-h-10 w-full min-w-[12rem] rounded-sm border border-line-500 bg-white px-3 py-2 text-sm font-medium text-court-900 outline-none placeholder:text-court-400 focus:border-hardwood-600";

function formatTrustDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

type RankingsToolbarProps = {
  ageGroup: PublicCoverageAgeGroup;
  gender: "Boys" | "Girls";
  query: string;
  position: string;
  region: string;
  positionOptions: string[];
  regionOptions: string[];
  minimumGames: number;
  minGameOptions: number[];
  selectedMinIndex: number;
  recruitingOptions: RecruitingClassYearOption[];
  classYear: number | "all";
  includeUnknownClass: boolean;
  showRecruiting: boolean;
  filtersActive: boolean;
  visibleCount: number;
  lastUpdated?: string | null;
  onAgeGroupChange: (group: PublicCoverageAgeGroup) => void;
  onGenderChange: (gender: "Boys" | "Girls") => void;
  onQueryChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onMinIndexPreview: (index: number) => void;
  onMinIndexCommit: (index: number) => void;
  onClassYearChange: (year: number | "all") => void;
  onIncludeUnknownChange: (value: boolean) => void;
  onClear: () => void;
  onMobileFiltersOpen?: () => void;
};

function FilterField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-court-500">{label}</span>
      {children}
    </label>
  );
}

function MinGamesSlider({
  minimumGames,
  minGameOptions,
  selectedMinIndex,
  onPreview,
  onCommit,
}: {
  minimumGames: number;
  minGameOptions: number[];
  selectedMinIndex: number;
  onPreview: (index: number) => void;
  onCommit: (index: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState(selectedMinIndex);

  useEffect(() => {
    setDragIndex(selectedMinIndex);
  }, [selectedMinIndex]);

  const previewGames = minGameOptions[dragIndex] ?? minimumGames;

  return (
    <FilterField label={`Min. games: ${previewGames === 100 ? "100+" : previewGames}`} className="w-36">
      <div className="flex h-7 items-center overflow-visible px-0.5 pb-0.5">
        <input
          type="range"
          min={0}
          max={minGameOptions.length - 1}
          step={1}
          value={dragIndex}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDragIndex(next);
            onPreview(next);
          }}
          onPointerUp={() => onCommit(dragIndex)}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") onCommit(dragIndex);
          }}
          className="h-2 w-full accent-hardwood-600"
        />
      </div>
    </FilterField>
  );
}

function DesktopFilters(props: RankingsToolbarProps) {
  return (
    <div className="hidden flex-wrap items-end gap-3 lg:flex">
      <FilterField label="Search" className="min-w-[14rem] flex-1">
        <input
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          className={filterInputClass}
          placeholder="Name, team, hometown"
        />
      </FilterField>

      <FilterField label="Age group">
        <select
          value={props.ageGroup}
          onChange={(event) => props.onAgeGroupChange(event.target.value as PublicCoverageAgeGroup)}
          className={filterSelectClass}
        >
          {ageGroups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Gender">
        <select value={props.gender} onChange={(event) => props.onGenderChange(event.target.value as "Boys" | "Girls")} className={filterSelectClass}>
          {genders.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Position">
        <select value={props.position} onChange={(event) => props.onPositionChange(event.target.value)} className={filterSelectClass}>
          <option value="All">All positions</option>
          {props.positionOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Region">
        <select value={props.region} onChange={(event) => props.onRegionChange(event.target.value)} className={filterSelectClass}>
          <option value="All">All regions</option>
          {props.regionOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </FilterField>

      {props.showRecruiting ? (
        <FilterField label="Graduation class" className="min-w-[10rem]">
          <select
            value={props.classYear === "all" ? "all" : String(props.classYear)}
            onChange={(event) => {
              const value = event.target.value;
              props.onClassYearChange(value === "all" ? "all" : Number(value));
            }}
            className={filterSelectClass}
          >
            {props.recruitingOptions.map((option) => (
              <option key={String(option.year)} value={String(option.year)}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>
      ) : null}

      <MinGamesSlider
        minimumGames={props.minimumGames}
        minGameOptions={props.minGameOptions}
        selectedMinIndex={props.selectedMinIndex}
        onPreview={props.onMinIndexPreview}
        onCommit={props.onMinIndexCommit}
      />

      {props.filtersActive ? (
        <button type="button" onClick={props.onClear} className="pb-2 text-sm font-semibold text-court-500 hover:text-court-900">
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

export function RankingsToolbar(props: RankingsToolbarProps) {
  const lastUpdatedLabel = props.lastUpdated ? formatTrustDate(props.lastUpdated) : null;

  return (
    <section className="bg-paper-500">
      <div className="container-px py-6 md:py-8">
        <div className="mx-auto max-w-[74rem]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-hardwood-600">
            <span aria-hidden="true" className="inline-block h-4 w-1 bg-hardwood-600" />
            Philippines Youth Basketball
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold uppercase leading-[1.02] tracking-tight text-court-900">
            National Rankings
          </h1>
          {lastUpdatedLabel ? (
            <p className="mt-2 text-sm font-medium text-court-500">Updated {lastUpdatedLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="sticky top-20 z-40 bg-paper-500">
        <div className="container-px pb-4">
          <div className="mx-auto max-w-[74rem]">
            <DesktopFilters {...props} />

            <div className="flex items-center justify-between gap-3 lg:hidden">
              <p className="text-sm font-semibold text-court-600">
                {props.ageGroup} · {props.gender}
              </p>
              {props.onMobileFiltersOpen ? (
                <button
                  type="button"
                  onClick={props.onMobileFiltersOpen}
                  className="rounded-sm border border-line-500 bg-white px-3 py-2 text-sm font-semibold text-court-900"
                >
                  Filters
                </button>
              ) : null}
            </div>

            {props.showRecruiting && props.classYear !== "all" ? (
              <label className="mt-3 hidden items-center gap-2 text-sm text-court-600 lg:flex">
                <input
                  type="checkbox"
                  checked={props.includeUnknownClass}
                  onChange={(event) => props.onIncludeUnknownChange(event.target.checked)}
                  className="accent-hardwood-600"
                />
                Include unknown class year
              </label>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
