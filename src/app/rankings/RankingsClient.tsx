"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LatestNationalRankings, NationalRankingRow, RankingAgeGroup, RankingGender } from "@/lib/rankings";
import { EmptyState } from "@/components/ui";

const ageGroups: RankingAgeGroup[] = ["U13", "U16", "U19"];
const genders: RankingGender[] = ["Boys", "Girls"];
const minGameStops = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function normalizedAge(value: string | null): RankingAgeGroup {
  const upper = value?.toUpperCase();
  return upper === "U13" || upper === "U16" || upper === "U19" ? upper : "U19";
}

function normalizedGender(value: string | null): RankingGender {
  return value?.toLowerCase() === "girls" ? "Girls" : "Boys";
}

function eligibilityMinimum(gender: RankingGender) {
  return gender === "Girls" ? 5 : 10;
}

function formatDate(value: string | null) {
  if (!value) return "No snapshot yet";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function stars(starRating: number) {
  return `${starRating} star${starRating === 1 ? "" : "s"}`;
}

export function RankingsClient({ rankings }: { rankings: LatestNationalRankings }) {
  const params = useSearchParams();
  const [ageGroup, setAgeGroup] = useState<RankingAgeGroup>(normalizedAge(params.get("age")));
  const [gender, setGender] = useState<RankingGender>(normalizedGender(params.get("gender")));
  const [region, setRegion] = useState("All");
  const [city, setCity] = useState("All");
  const [minIndex, setMinIndex] = useState(gender === "Girls" ? 0 : 1);

  const selectedSnapshot = gender === "Girls" ? rankings.snapshots.girls : rankings.snapshots.boys;
  const rowsForAge = ageGroup === "U19" ? selectedSnapshot.rows : [];
  const defaultMinimum = eligibilityMinimum(gender);
  const minimumGames = Math.max(minGameStops[minIndex], defaultMinimum);

  const regionOptions = useMemo(
    () => Array.from(new Set(rowsForAge.map((row) => row.region))).sort(),
    [rowsForAge]
  );
  const cityOptions = useMemo(() => {
    const scoped = region === "All" ? rowsForAge : rowsForAge.filter((row) => row.region === region);
    return Array.from(new Set(scoped.map((row) => row.city))).sort();
  }, [region, rowsForAge]);

  const filteredRows = useMemo(
    () =>
      rowsForAge
        .filter((row) => region === "All" || row.region === region)
        .filter((row) => city === "All" || row.city === city)
        .filter((row) => row.verifiedGameCount >= minimumGames)
        .sort((left, right) => left.rank - right.rank),
    [city, minimumGames, region, rowsForAge]
  );

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
                <button
                  key={item}
                  onClick={() => {
                    setGender(item);
                    setMinIndex(item === "Girls" ? 0 : 1);
                    setRegion("All");
                    setCity("All");
                  }}
                  className={`rounded-full px-6 py-2 font-semibold ${gender === item ? "bg-navy-800 text-white" : "text-ink-600 hover:text-navy-800"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 font-mono text-mono-sm uppercase text-ink-400">
            Minimum {defaultMinimum} verified games required to rank
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <section>
              <p className="mb-3 font-mono text-mono-sm uppercase text-ink-500">Age Group</p>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => {
                      setAgeGroup(group);
                      setRegion("All");
                      setCity("All");
                    }}
                    className={`rounded-full px-4 py-2 font-mono text-mono-sm ${ageGroup === group ? "bg-navy-800 text-white" : "bg-surface-100 text-ink-600"}`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </section>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              Region
              <select
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value);
                  setCity("All");
                }}
                className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900"
              >
                <option>All</option>
                {regionOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              City
              <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
                <option>All</option>
                {cityOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-3 font-mono text-mono-sm uppercase text-ink-500">
              {minimumGames === 100 ? "Min. 100+ games" : `Min. ${minimumGames} games`}
              <input type="range" min={0} max={minGameStops.length - 1} step={1} value={minIndex} onChange={(event) => setMinIndex(Number(event.target.value))} className="accent-navy-800" />
            </label>
          </div>
          <button
            onClick={() => {
              setRegion("All");
              setCity("All");
              setMinIndex(gender === "Girls" ? 0 : 1);
            }}
            className="mt-5 font-mono text-mono-sm uppercase text-ink-500 hover:text-amber-600"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="container-px mt-8">
        <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
          <p className="font-mono text-mono-sm uppercase text-ink-500">
            Showing {filteredRows.length} players | {ageGroup} {gender} | {region} | Updated {formatDate(selectedSnapshot.weekOf)}
          </p>
        </div>

        {filteredRows.length ? <RankingsTable rows={filteredRows.slice(0, 100)} /> : <EmptyState icon="players" title="No players ranked yet" />}
      </section>
    </main>
  );
}

function RankingsTable({ rows }: { rows: NationalRankingRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
      <div className="hidden grid-cols-[5rem_minmax(14rem,1.4fr)_7rem_7rem_8rem_9rem_9rem] border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
        <span>Rank</span>
        <span>Player</span>
        <span>Rating</span>
        <span>Stars</span>
        <span>Games</span>
        <span>City</span>
        <span>Region</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.playerId}
          className="grid gap-3 border-b border-l-0 border-surface-200 px-4 py-4 transition-all duration-150 last:border-b-0 hover:border-l-[3px] hover:border-l-navy-800 hover:bg-navy-50 lg:grid-cols-[5rem_minmax(14rem,1.4fr)_7rem_7rem_8rem_9rem_9rem] lg:items-center"
        >
          <span className="font-mono">
            <strong className="block text-lg text-navy-800">#{row.rank}</strong>
          </span>
          <span className="grid grid-cols-[auto_1fr] items-center gap-3">
            <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-navy-100 font-mono text-mono-sm text-navy-800">
              {row.photoUrl ? <img src={row.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(row.displayName)}
            </span>
            <span>
              <strong className="block text-ink-900">{row.displayName}</strong>
              <small className="text-ink-500">{row.city} | {row.region}</small>
            </span>
          </span>
          <span className="font-display text-stat-sm text-navy-800">{row.rating.toFixed(2)}</span>
          <span className="font-semibold text-amber-600">{stars(row.starRating)}</span>
          <span className="font-mono text-ink-700">{row.verifiedGameCount}</span>
          <span className="text-ink-600">{row.city}</span>
          <span className="text-ink-600">{row.region}</span>
        </div>
      ))}
    </div>
  );
}