"use client";

import type { ReactNode } from "react";

import { SegmentedControl } from "@/components/public/SegmentedControl";
import type { PublicCoverageAgeGroup } from "@/lib/public-rankings-coverage";

const ageGroups: PublicCoverageAgeGroup[] = ["U13", "U16", "U19"];
const genders = ["Boys", "Girls"] as const;

const filterSelectClass =
  "min-h-10 w-full min-w-[8.5rem] rounded-sm border border-line-500 bg-white px-3 py-2 text-sm font-semibold text-court-900 outline-none focus:border-hardwood-600";

const filterInputClass =
  "min-h-10 w-full min-w-[12rem] rounded-sm border border-line-500 bg-white px-3 py-2 text-sm font-medium text-court-900 outline-none placeholder:text-court-400 focus:border-hardwood-600";

function FilterField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-court-500">{label}</span>
      {children}
    </label>
  );
}

type TeamsToolbarProps = {
  ageGroup: PublicCoverageAgeGroup;
  gender: "Boys" | "Girls";
  query: string;
  viewMode: "national" | "competition";
  nationalEnabled: boolean;
  leagueId: string;
  region: string;
  leagueOptions: Array<{ id: string; name: string }>;
  regionOptions: string[];
  minimumGames: number;
  maxGamesPlayed: number;
  showCompetitionFilters: boolean;
  filtersActive: boolean;
  onAgeGroupChange: (group: PublicCoverageAgeGroup) => void;
  onGenderChange: (gender: "Boys" | "Girls") => void;
  onQueryChange: (value: string) => void;
  onViewModeChange: (mode: "national" | "competition") => void;
  onLeagueChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onMinimumGamesChange: (value: number) => void;
  onClear: () => void;
  lastUpdated?: string | null;
};

function formatTrustDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function TeamsToolbar(props: TeamsToolbarProps) {
  const isNational = props.viewMode === "national";
  const lastUpdatedLabel = props.lastUpdated ? formatTrustDate(props.lastUpdated) : null;
  const subtitle = isNational
    ? lastUpdatedLabel
      ? `National program board · TPI-v1 · Updated ${lastUpdatedLabel}`
      : "National program board · TPI-v1"
    : lastUpdatedLabel
      ? `Updated ${lastUpdatedLabel}`
      : null;

  return (
    <section className="bg-paper-500">
      <div className="container-px py-6 md:py-8">
        <div className="mx-auto max-w-[74rem]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-hardwood-600">
            <span aria-hidden="true" className="inline-block h-4 w-1 bg-hardwood-600" />
            Philippines Youth Basketball
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold uppercase leading-[1.02] tracking-tight text-court-900">
            {isNational ? "National Team Rankings" : "Team Standings"}
          </h1>
          <p className="mt-2 text-sm font-medium text-court-500">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="sticky top-20 z-40 bg-paper-500">
        <div className="container-px pb-4">
          <div className="mx-auto max-w-[74rem]">
            <div className="hidden flex-wrap items-end gap-3 lg:flex">
              <FilterField label="Search" className="min-w-[14rem] flex-1">
                <input
                  value={props.query}
                  onChange={(event) => props.onQueryChange(event.target.value)}
                  className={filterInputClass}
                  placeholder={isNational ? "Program, city, region" : "Team, program, league"}
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
                <select
                  value={props.gender}
                  onChange={(event) => props.onGenderChange(event.target.value as "Boys" | "Girls")}
                  className={filterSelectClass}
                >
                  {genders.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </FilterField>

              {props.nationalEnabled ? (
                <FilterField label="View">
                  <div className="flex h-10 items-center">
                    <SegmentedControl
                      options={[
                        { value: "national" as const, label: "National" },
                        { value: "competition" as const, label: "Competition" },
                      ]}
                      value={props.viewMode}
                      onChange={props.onViewModeChange}
                    />
                  </div>
                </FilterField>
              ) : null}

              {props.showCompetitionFilters ? (
                <>
                  <FilterField label="League">
                    <select value={props.leagueId} onChange={(event) => props.onLeagueChange(event.target.value)} className={filterSelectClass}>
                      <option value="All">All leagues</option>
                      {props.leagueOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
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

                  <FilterField label={`Min. games: ${props.minimumGames}`} className="w-36">
                    <div className="flex h-7 items-center overflow-visible px-0.5 pb-0.5">
                      <input
                        type="range"
                        min={1}
                        max={props.maxGamesPlayed}
                        step={1}
                        value={props.minimumGames}
                        onChange={(event) => props.onMinimumGamesChange(Number(event.target.value))}
                        className="h-2 w-full accent-hardwood-600"
                      />
                    </div>
                  </FilterField>
                </>
              ) : null}

              {props.filtersActive ? (
                <button type="button" onClick={props.onClear} className="pb-2 text-sm font-semibold text-court-500 hover:text-court-900">
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 lg:hidden">
              <p className="text-sm font-semibold text-court-600">
                {props.ageGroup} · {props.gender}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
