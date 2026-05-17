"use client";

import { useMemo, useState } from "react";
import type { PublicAgeGroup, PublicLeagueRow } from "@/lib/public-site-data";
import { LeagueGrid } from "@/components/sections";
import { EmptyState } from "@/components/ui";

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

  return (
    <section className="container-px py-8">
      <article className="mb-8 rounded-lg border border-surface-200 border-l-[3px] border-l-navy-800 bg-navy-50 p-6 shadow-sm">
        <p className="font-mono text-label uppercase tracking-[0.12em] text-navy-800">How league quality works</p>
        <p className="mt-3 max-w-4xl leading-7 text-ink-700">
          League quality is currently displayed as context only. Formula v1 keeps leagueWeight at 1.000 until enough historical data exists for statistical calibration.
        </p>
      </article>
      <div className="mb-8 grid gap-3 rounded-lg border border-surface-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto_auto]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search league name" className="rounded-md border border-surface-300 bg-white px-4 py-3 text-ink-900 placeholder:text-ink-400" />
        <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as "All" | PublicAgeGroup)} className="rounded-md border border-surface-300 bg-white px-4 py-3 text-ink-900">
          {ageOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
        <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-md border border-surface-300 bg-white px-4 py-3 text-ink-900">
          <option>All</option>
          {regions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      {filtered.length ? <LeagueGrid leagues={filtered} /> : <EmptyState icon="leagues" title="No leagues listed" />}
    </section>
  );
}