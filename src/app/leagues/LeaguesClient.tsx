"use client";

import { useMemo, useState } from "react";
import type { PublicAgeGroup, PublicLeagueRow } from "@/lib/public-site-data";
import { LeagueGrid } from "@/components/sections";
import { EmptyState } from "@/components/ui";
import { FilterBar, FilterControlClass, FilterField } from "@/components/public/FilterBar";

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
  const controlClass = FilterControlClass();

  return (
    <section className="container-px py-8">
      <div className="mb-8 -mx-5 sm:-mx-8 lg:-mx-12 xl:-mx-16">
        <FilterBar summary={`${filtered.length} competitions shown`}>
          <FilterField label="Search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search league name" className={controlClass} />
          </FilterField>
          <FilterField label="Age Group">
            <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as "All" | PublicAgeGroup)} className={controlClass}>
              {ageOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </FilterField>
          <FilterField label="Region">
            <select value={region} onChange={(event) => setRegion(event.target.value)} className={controlClass}>
              <option>All</option>
              {regions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </FilterField>
          <span className="hidden lg:block" />
          <span className="hidden lg:block" />
        </FilterBar>
      </div>
      {filtered.length ? <LeagueGrid leagues={filtered} /> : <EmptyState icon="leagues" title="No leagues listed" />}
    </section>
  );
}
