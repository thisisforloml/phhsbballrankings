"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LatestNationalRankings, NationalRankingRow, RankingAgeGroup, RankingGender } from "@/lib/rankings";
import { EmptyState } from "@/components/ui";
import { FilterBar, FilterControlClass, FilterField } from "@/components/public/FilterBar";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { RankingTable } from "@/components/public/RankingTable";
import { SectionHeader } from "@/components/public/SectionHeader";

const ageGroups: RankingAgeGroup[] = ["U13", "U16", "U19"];
const genders: RankingGender[] = ["Boys", "Girls"];
const boysMinGameStops = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const girlsMinGameStops = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const notListedPosition = "Not listed";
const positionOrder = ["G", "PG", "SG", "F", "SF", "PF", "C"];

function normalizedAge(value: string | null): RankingAgeGroup {
  const upper = value?.toUpperCase();
  return upper === "U13" || upper === "U16" || upper === "U19" ? upper : "U19";
}

function normalizedGender(value: string | null): RankingGender {
  return value?.toLowerCase() === "girls" ? "Girls" : "Boys";
}

function eligibilityMinimum(gender: RankingGender, ageGroup: RankingAgeGroup) {
  return gender === "Girls" ? 5 : 10;
}

function minGameStopsForGender(gender: RankingGender) {
  return gender === "Girls" ? girlsMinGameStops : boysMinGameStops;
}

function defaultMinIndex(gender: RankingGender, ageGroup: RankingAgeGroup) {
  const minimum = eligibilityMinimum(gender, ageGroup);
  const index = minGameStopsForGender(gender).findIndex((stop) => stop >= minimum);
  return index >= 0 ? index : 0;
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

function positionLabel(position: string | null) {
  return position?.trim() || notListedPosition;
}

function searchText(row: NationalRankingRow) {
  return [row.displayName, row.currentTeam, row.position ?? notListedPosition, row.city, row.region]
    .join(" ")
    .toLowerCase();
}

export function RankingsClient({ rankings }: { rankings: LatestNationalRankings }) {
  const params = useSearchParams();
  const initialAgeGroup = normalizedAge(params.get("age"));
  const initialGender = normalizedGender(params.get("gender"));
  const [ageGroup, setAgeGroup] = useState<RankingAgeGroup>(initialAgeGroup);
  const [gender, setGender] = useState<RankingGender>(initialGender);
  const [region, setRegion] = useState("All");
  const [position, setPosition] = useState("All");
  const [query, setQuery] = useState("");
  const [minIndex, setMinIndex] = useState(defaultMinIndex(initialGender, initialAgeGroup));

  const selectedAgeSnapshots = rankings.snapshotsByAge?.[ageGroup];
  const selectedSnapshot = selectedAgeSnapshots ? (gender === "Girls" ? selectedAgeSnapshots.girls : selectedAgeSnapshots.boys) : (gender === "Girls" ? rankings.snapshots.girls : rankings.snapshots.boys);
  const rowsForAge = selectedSnapshot.rows;
  const defaultMinimum = eligibilityMinimum(gender, ageGroup);
  const minGameOptions = minGameStopsForGender(gender);
  const selectedMinIndex = Math.min(minIndex, minGameOptions.length - 1);
  const minimumGames = Math.max(minGameOptions[selectedMinIndex], defaultMinimum);

  const regionOptions = useMemo(
    () => Array.from(new Set(rowsForAge.map((row) => row.region))).sort(),
    [rowsForAge]
  );
  const positionOptions = useMemo(
    () => Array.from(new Set(rowsForAge.map((row) => positionLabel(row.position)))).sort((left, right) => {
      if (left === notListedPosition) return 1;
      if (right === notListedPosition) return -1;

      const leftIndex = positionOrder.indexOf(left.toUpperCase());
      const rightIndex = positionOrder.indexOf(right.toUpperCase());
      if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
      if (leftIndex !== -1) return -1;
      if (rightIndex !== -1) return 1;
      return left.localeCompare(right);
    }),
    [rowsForAge]
  );

  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();

    return rowsForAge
      .filter((row) => region === "All" || row.region === region)
      .filter((row) => position === "All" || positionLabel(row.position) === position)
      .filter((row) => !value || searchText(row).includes(value))
      .filter((row) => row.verifiedGameCount >= minimumGames)
      .filter((row) => row.computedAgeBracket === null || row.computedAgeBracket === ageGroup)
      .sort((left, right) => left.rank - right.rank || right.rating - left.rating || right.verifiedGameCount - left.verifiedGameCount || left.displayName.localeCompare(right.displayName));
  }, [ageGroup, minimumGames, position, query, region, rowsForAge]);

  const controlClass = FilterControlClass();

  return (
    <PublicPageShell className="pb-20 pt-28">
      <section className="container-px border-b border-line-500 bg-court-900 py-12 text-white">
        <SectionHeader
          title="National Board"
          dark
          action={
            <div className="inline-flex border border-white/20 bg-white/10 p-1">
              {genders.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setGender(item);
                    setMinIndex(defaultMinIndex(item, ageGroup));
                    setRegion("All");
                    setPosition("All");
                    setQuery("");
                  }}
                  className={`px-6 py-2 text-sm font-black uppercase tracking-[0.08em] ${gender === item ? "bg-gold-500 text-court-900" : "text-white/72 hover:text-white"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          }
        />
      </section>

      <FilterBar
        action={
          <button
            onClick={() => {
              setRegion("All");
              setPosition("All");
              setQuery("");
              setMinIndex(defaultMinIndex(gender, ageGroup));
            }}
            className="text-xs font-black uppercase tracking-[0.12em] text-court-500 hover:text-hardwood-600"
          >
            Clear filters
          </button>
        }
      >
            <section>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-court-500">Age Group</p>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => {
                      setAgeGroup(group);
                      setMinIndex(defaultMinIndex(gender, group));
                      setRegion("All");
                      setPosition("All");
                    }}
                    className={`border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${ageGroup === group ? "border-court-900 bg-court-900 text-white" : "border-line-500 bg-white text-court-600 hover:border-court-900 hover:text-court-900"}`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </section>
            <FilterField label="Search">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={controlClass}
                placeholder="Name, team, hometown"
              />
            </FilterField>
            <FilterField label="Position">
              <select value={position} onChange={(event) => setPosition(event.target.value)} className={controlClass}>
                <option>All</option>
                {positionOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Region">
              <select value={region} onChange={(event) => setRegion(event.target.value)} className={controlClass}>
                <option>All</option>
                {regionOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label={minimumGames === 100 ? "Min. 100+ games" : `Min. ${minimumGames} games`}>
              <input type="range" min={0} max={minGameOptions.length - 1} step={1} value={selectedMinIndex} onChange={(event) => setMinIndex(Number(event.target.value))} className="h-12 accent-hardwood-600" />
            </FilterField>
      </FilterBar>

      <section className="container-px mt-8">
        <div className="mb-6 border border-line-500 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-court-500">
            Showing {filteredRows.length} players | {ageGroup} {gender} | Updated {formatDate(selectedSnapshot.weekOf)}
          </p>
        </div>

        {filteredRows.length ? <RankingTable rows={filteredRows.slice(0, 100)} /> : <EmptyState icon="players" title="No players ranked yet" />}
      </section>
    </PublicPageShell>
  );
}
