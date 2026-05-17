"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicAgeGroup, PublicGender, PublicTeamRankingRow } from "@/lib/public-site-data";
import { EmptyState, RatingBadge, WinLossPill } from "@/components/ui";

const ageGroups: PublicAgeGroup[] = ["U13", "U16", "U19"];
const genders: PublicGender[] = ["Boys", "Girls"];

export function TeamsClient({ teams }: { teams: PublicTeamRankingRow[] }) {
  const [gender, setGender] = useState<PublicGender>("Boys");
  const [ageGroup, setAgeGroup] = useState<PublicAgeGroup>("U19");
  const [region, setRegion] = useState("All");
  const [city, setCity] = useState("All");

  const regions = useMemo(() => Array.from(new Set(teams.map((team) => team.region))).sort(), [teams]);
  const cityOptions = useMemo(() => {
    const scoped = region === "All" ? teams : teams.filter((team) => team.region === region);
    return Array.from(new Set(scoped.map((team) => team.city))).sort();
  }, [region, teams]);

  const filtered = useMemo(() => teams
    .filter((team) => team.gender === gender)
    .filter((team) => team.ageGroup === ageGroup)
    .filter((team) => region === "All" || team.region === region)
    .filter((team) => city === "All" || team.city === city)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.name.localeCompare(b.name)), [ageGroup, city, gender, region, teams]);

  return (
    <section className="container-px pt-10">
      <div className="mb-8 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
          <section>
            <p className="mb-3 font-mono text-mono-sm uppercase text-ink-500">Gender</p>
            <div className="inline-flex rounded-full border border-surface-300 bg-surface-50 p-1">
              {genders.map((item) => <button key={item} onClick={() => setGender(item)} className={`rounded-full px-4 py-2 font-semibold ${gender === item ? "bg-navy-800 text-white" : "text-ink-600"}`}>{item}</button>)}
            </div>
          </section>
          <section>
            <p className="mb-3 font-mono text-mono-sm uppercase text-ink-500">Age Group</p>
            <div className="flex flex-wrap gap-2">
              {ageGroups.map((group) => <button key={group} onClick={() => setAgeGroup(group)} className={`rounded-full px-4 py-2 font-mono text-mono-sm ${ageGroup === group ? "bg-navy-800 text-white" : "bg-surface-100 text-ink-600"}`}>{group}</button>)}
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
            Hometown
            <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
              <option>All</option>
              {cityOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      {filtered.length ? (
        <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[5rem_1fr_10rem_7rem_8rem_5rem_1fr_1fr] gap-3 border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
            <span>Rank</span><span>Team</span><span>Location</span><span>Rating</span><span>Record</span><span>PPG</span><span>Top Player</span><span>League</span>
          </div>
          {filtered.map((team, index) => (
            <div key={team.id} className="grid gap-3 border-b border-l-0 border-surface-200 px-4 py-4 transition hover:border-l-[3px] hover:border-l-amber-500 hover:bg-amber-100 last:border-b-0 lg:grid-cols-[5rem_1fr_10rem_7rem_8rem_5rem_1fr_1fr] lg:items-center">
              <span className={`font-mono ${index === 0 ? "text-amber-700" : "text-ink-500"}`}>#{index + 1}</span>
              <strong className="text-ink-900" title={team.name}>{team.name}</strong>
              <span className="font-mono text-mono-sm text-ink-500">{team.city}, {team.region}</span>
              <RatingBadge rating={team.rating} />
              <span className="flex gap-2"><WinLossPill result="W" /> <strong className="font-display">{team.wins}</strong><WinLossPill result="L" /> <strong className="font-display">{team.losses}</strong></span>
              <span className="font-display text-stat-sm">{team.ppg}</span>
              {team.topPlayer ? <Link className="truncate text-navy-800" title={team.topPlayer.displayName} href={`/players/${team.topPlayer.slug}`}>{team.topPlayer.displayName} - {team.topPlayer.rating.toFixed(2)}</Link> : <span className="text-ink-400">-</span>}
              <span className="truncate text-ink-600" title={team.league}>{team.league}</span>
            </div>
          ))}
        </div>
      ) : <EmptyState icon="teams" title="No teams ranked yet" />}
    </section>
  );
}