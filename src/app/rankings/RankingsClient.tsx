"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AgeGroup, Gender, Position } from "@/lib/mock-data";
import { ageGroups, eligibilityMinimum, genders, getPlayersByFilters, players, positions, regions } from "@/lib/mock-data";
import { LeaderboardPreview } from "@/components/sections";
import { EmptyState } from "@/components/ui";

const minGameStops = [8, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function normalizedAge(value: string | null): AgeGroup {
  const upper = value?.toUpperCase();
  return upper === "U13" || upper === "U16" || upper === "U19" ? upper : "U19";
}

function normalizedGender(value: string | null): Gender {
  return value?.toLowerCase() === "girls" ? "Girls" : "Boys";
}

export function RankingsClient() {
  const params = useSearchParams();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(normalizedAge(params.get("age")));
  const [gender, setGender] = useState<Gender>(normalizedGender(params.get("gender")));
  const [region, setRegion] = useState("All");
  const [city, setCity] = useState("All");
  const [minIndex, setMinIndex] = useState(1);
  const [position, setPosition] = useState<"All" | Position>("All");

  const defaultMinimum = eligibilityMinimum(gender);
  const minimumGames = Math.max(minGameStops[minIndex], defaultMinimum);
  const cityOptions = useMemo(() => {
    const scoped = region === "All" ? players : players.filter((player) => player.region === region);
    return Array.from(new Set(scoped.map((player) => player.city))).sort();
  }, [region]);

  const filteredPlayers = useMemo(() => getPlayersByFilters({ ageGroup, gender, region, city, minimumGames, position }), [ageGroup, city, gender, minimumGames, position, region]);

  return (
    <main className="bg-surface-50 pb-20 pt-28">
      <section className="container-px">
        <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Full National Rankings</p>
              <h1 className="mt-2 font-display text-stat-md text-navy-800">Player Rankings</h1>
            </div>
            <div className="inline-flex rounded-full border border-surface-300 bg-surface-50 p-1">
              {genders.map((item) => (
                <button key={item} onClick={() => { setGender(item); setMinIndex(item === "Girls" ? 0 : 1); }} className={`rounded-full px-6 py-2 font-semibold ${gender === item ? "bg-navy-800 text-white" : "text-ink-600 hover:text-navy-800"}`}>{item}</button>
              ))}
            </div>
          </div>
          <p className="mt-3 font-mono text-mono-sm uppercase text-ink-400">Minimum {defaultMinimum} verified games required to rank</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1.3fr]">
            <section>
              <p className="mb-3 font-mono text-mono-sm uppercase text-ink-500">Age Group</p>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map((group) => (
                  <button key={group} onClick={() => setAgeGroup(group)} className={`rounded-full px-4 py-2 font-mono text-mono-sm ${ageGroup === group ? "bg-navy-800 text-white" : "bg-surface-100 text-ink-600"}`}>{group}</button>
                ))}
              </div>
            </section>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              Region
              <select value={region} onChange={(event) => { setRegion(event.target.value); setCity("All"); }} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
                <option>All</option>
                {regions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              City
              <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
                <option>All</option>
                {cityOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-3 font-mono text-mono-sm uppercase text-ink-500">
              {minimumGames === 100 ? "Min. 100+ games" : `Min. ${minimumGames} games`}
              <input type="range" min={0} max={minGameStops.length - 1} step={1} value={minIndex} onChange={(event) => setMinIndex(Number(event.target.value))} className="accent-navy-800" />
            </label>
            <section>
              <p className="mb-3 font-mono text-mono-sm uppercase text-ink-500">Position</p>
              <div className="flex flex-wrap gap-2">
                {(["All", ...positions] as Array<"All" | Position>).map((item) => (
                  <button key={item} onClick={() => setPosition(item)} className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${position === item ? "bg-navy-800 text-white" : "bg-surface-100 text-ink-600"}`}>{item}</button>
                ))}
              </div>
            </section>
          </div>
          <button onClick={() => { setRegion("All"); setCity("All"); setMinIndex(gender === "Girls" ? 0 : 1); setPosition("All"); }} className="mt-5 font-mono text-mono-sm uppercase text-ink-500 hover:text-amber-600">
            Clear filters
          </button>
        </div>
      </section>

      <section className="container-px mt-8">
        <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
          <p className="font-mono text-mono-sm uppercase text-ink-500">Showing {filteredPlayers.length} players · {ageGroup} {gender} · {region} · Updated Monday</p>
        </div>
        {filteredPlayers.length ? <LeaderboardPreview players={filteredPlayers.slice(0, 100)} ageGroup={ageGroup} gender={gender} showPositionRank={position !== "All"} /> : <EmptyState icon="players" title="No players ranked yet" />}
      </section>
    </main>
  );
}
