"use client";

import { useMemo, useState } from "react";
import type { PublicAgeGroup, PublicLeagueRow } from "@/lib/public-site-data";
import { LeagueGrid } from "@/components/sections";
import { EmptyState } from "@/components/ui";
import { FilterToolbar, FilterToolbarControlClass, FilterToolbarField, FilterToolbarRow } from "@/components/public/FilterToolbar";

const ageOptions: Array<"All" | PublicAgeGroup> = ["All", "U13", "U16", "U19"];

export function LeaguesClient({ leagues }: { leagues: PublicLeagueRow[] }) {
  const [query, setQuery] = useState("");
  const [ageGroup, setAgeGroup] = useState<"All" | PublicAgeGroup>("All");
  const [region, setRegion] = useState("All");

  const regions = useMemo(() => Array.from(new Set(leagues.map((league) => league.region))).sort(), [leagues]);
  const filtered = useMemo(() => {
    const value = query.toLowerCase();
    return leagues
      .filter((league) => !value || league.name.toLowerCase().includes(value))
      .filter((league) => ageGroup === "All" || league.ageGroup === ageGroup)
      .filter((league) => region === "All" || league.region === region);
  }, [ageGroup, leagues, query, region]);
  const controlClass = FilterToolbarControlClass();
  const hasActiveFilters = query.trim().length > 0 || ageGroup !== "All" || region !== "All";

  return (
    <section className="container-px py-6">
      <div className="mx-auto max-w-[74rem]">
        <FilterToolbar
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setAgeGroup("All");
                  setRegion("All");
                }}
                className="text-xs font-bold text-court-500 hover:text-hardwood-600"
              >
                Clear filters
              </button>
            ) : null
          }
        >
          <FilterToolbarRow>
            <FilterToolbarField label="Search" className="min-w-[14rem] flex-[1.4]">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search league name" className={controlClass} />
            </FilterToolbarField>
            <FilterToolbarField label="Age group">
              <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as "All" | PublicAgeGroup)} className={controlClass}>
                {ageOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </FilterToolbarField>
            <FilterToolbarField label="Region">
              <select value={region} onChange={(event) => setRegion(event.target.value)} className={controlClass}>
                <option>All</option>
                {regions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </FilterToolbarField>
          </FilterToolbarRow>
        </FilterToolbar>

        <p className="mb-4 mt-4 text-xs font-bold text-court-500">{filtered.length} competitions shown</p>

        {filtered.length ? <LeagueGrid leagues={filtered} /> : <EmptyState icon="leagues" title="No leagues listed" />}
      </div>
    </section>
  );
}
