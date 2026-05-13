"use client";

import { useMemo, useState } from "react";
import type { AgeGroup } from "@/lib/mock-data";
import { ageGroups, leagues, regions } from "@/lib/mock-data";
import { LeagueGrid } from "@/components/sections";
import { EmptyState } from "@/components/ui";

const ageOptions: Array<"All" | AgeGroup> = ["All", ...ageGroups];

export default function LeaguesPage() {
  const [query, setQuery] = useState("");
  const [ageGroup, setAgeGroup] = useState<"All" | AgeGroup>("All");
  const [region, setRegion] = useState("All");

  const filtered = useMemo(() => {
    const value = query.toLowerCase();
    return leagues
      .filter((league) => !value || league.name.toLowerCase().includes(value))
      .filter((league) => ageGroup === "All" || league.ageGroup === ageGroup)
      .filter((league) => region === "All" || league.region === region);
  }, [ageGroup, query, region]);

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">League Directory</p>
          <h1 className="mt-3 font-display text-stat-lg">Verified Leagues</h1>
          <p className="mt-4 max-w-2xl text-white/70">Official competitions feeding the national player registry and rankings model.</p>
        </div>
      </section>
      <section className="container-px py-8">
        <article className="mb-8 rounded-lg border border-surface-200 border-l-[3px] border-l-navy-800 bg-navy-50 p-6 shadow-sm">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-navy-800">HOW LEAGUE TIERS WORK</p>
          <p className="mt-3 max-w-4xl leading-7 text-ink-700">
            Leagues in OnCourt Rankings Philippines are scored and grouped into tiers based on governance,
            team count, games played per season, and statistical submission compliance.
            A higher tier means a player's performance in that league carries greater
            weight in their national rating. This ensures that a standout performance
            in a more competitive, better-organized league is rewarded more than the
            same numbers in a smaller, less structured one.
          </p>
        </article>
        <div className="mb-8 grid gap-3 rounded-lg border border-surface-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto_auto]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search league name" className="rounded-md border border-surface-300 bg-white px-4 py-3 text-ink-900 placeholder:text-ink-400" />
          <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as "All" | AgeGroup)} className="rounded-md border border-surface-300 bg-white px-4 py-3 text-ink-900">
            {ageOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-md border border-surface-300 bg-white px-4 py-3 text-ink-900">
            <option>All</option>
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        {filtered.length ? <LeagueGrid leagues={filtered} /> : <EmptyState icon="leagues" title="No leagues listed" />}
      </section>
    </main>
  );
}
