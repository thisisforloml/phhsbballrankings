"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicAgeGroup, PublicLeagueRow } from "@/lib/public-site-data";
import { EmptyState } from "@/components/ui";
import { ScoutSectionLabel } from "@/components/public/ScoutSectionLabel";

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

  const hasActiveFilters = query.trim().length > 0 || ageGroup !== "All" || region !== "All";
  const controlClass =
    "min-h-10 w-full border border-white/[0.08] bg-scout-700 px-3 py-2 text-sm font-medium text-scout-50 outline-none focus:border-scout-orange";

  return (
    <section className="container-px py-6 md:py-8">
      <div className="mx-auto max-w-[74rem]">
        <div className="mb-6 grid gap-3 rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 lg:grid-cols-[1fr_9rem_9rem_auto] lg:items-end">
          <label className="grid gap-1.5">
            <ScoutSectionLabel>Search</ScoutSectionLabel>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search league name"
              className={controlClass}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright">
              <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
              Age
            </span>
            <select
              value={ageGroup}
              onChange={(event) => setAgeGroup(event.target.value as "All" | PublicAgeGroup)}
              className={controlClass}
            >
              {ageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright">
              <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
              Region
            </span>
            <select value={region} onChange={(event) => setRegion(event.target.value)} className={controlClass}>
              <option value="All">All</option>
              {regions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setAgeGroup("All");
                setRegion("All");
              }}
              className="justify-self-start text-sm font-semibold text-white/50 hover:text-white lg:justify-self-end lg:pb-2"
            >
              Clear filters
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        <p className="mb-5 text-xs font-semibold text-white/45">{filtered.length} competitions shown</p>

        {filtered.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((league) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 transition hover:border-scout-orange/40 hover:bg-scout-800"
              >
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-scout-orange-bright">
                  {league.ageGroup}
                </p>
                <h2 className="mt-1 text-lg font-bold leading-tight text-white">{league.name}</h2>
                <p className="mt-2 text-sm text-white/45">{league.gameCount} official games</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon="leagues" title="No leagues listed" />
        )}
      </div>
    </section>
  );
}
