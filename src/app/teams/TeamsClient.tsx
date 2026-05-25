"use client";

import { useMemo, useState } from "react";
import type { TeamStandingsAgeGroup, TeamStandingsData, TeamStandingsGender } from "@/lib/team-rankings";
import { EmptyState } from "@/components/ui";
import { FilterBar, FilterControlClass, FilterField } from "@/components/public/FilterBar";
import { SectionHeader } from "@/components/public/SectionHeader";
import { TeamStandingTable } from "@/components/public/TeamStandingTable";

const ageGroups: TeamStandingsAgeGroup[] = ["U13", "U16", "U19"];
const genders: TeamStandingsGender[] = ["Boys", "Girls"];

function searchText(team: TeamStandingsData["rows"][number]) {
  return [team.displayName, team.internalTeamName, team.leagueName, team.seasonName, team.city, team.region]
    .join(" ")
    .toLowerCase();
}

function sortVisibleStandings(left: TeamStandingsData["rows"][number], right: TeamStandingsData["rows"][number]) {
  return right.wins - left.wins
    || right.winPercentage - left.winPercentage
    || right.pointDifferential - left.pointDifferential
    || right.pointsFor - left.pointsFor
    || left.displayName.localeCompare(right.displayName);
}

export function TeamsClient({ data }: { data: TeamStandingsData }) {
  const [ageGroup, setAgeGroup] = useState<TeamStandingsAgeGroup>(data.filters.default?.ageGroup ?? "U19");
  const [gender, setGender] = useState<TeamStandingsGender>(data.filters.default?.gender ?? "Boys");
  const [leagueId, setLeagueId] = useState(data.filters.default?.leagueId ?? "All");
  const [region, setRegion] = useState("All");
  const [query, setQuery] = useState("");
  const [minimumGames, setMinimumGames] = useState(1);

  const scopeRows = useMemo(() => data.rows
    .filter((team) => team.ageGroup === ageGroup)
    .filter((team) => team.gender === gender), [ageGroup, data.rows, gender]);

  const leagueOptions = useMemo(() => data.filters.leagues
    .filter((league) => data.rows.some((team) => team.leagueId === league.id && team.ageGroup === ageGroup && team.gender === gender))
    .sort((left, right) => left.name.localeCompare(right.name)), [ageGroup, data.filters.leagues, data.rows, gender]);

  const regionOptions = useMemo(() => Array.from(new Set(scopeRows.map((team) => team.region))).sort(), [scopeRows]);

  const maxGamesPlayed = Math.max(1, ...scopeRows
    .filter((team) => leagueId === "All" || team.leagueId === leagueId)
    .filter((team) => region === "All" || team.region === region)
    .map((team) => team.gamesPlayed));
  const selectedMinimumGames = Math.min(minimumGames, maxGamesPlayed);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    return scopeRows
      .filter((team) => leagueId === "All" || team.leagueId === leagueId)
      .filter((team) => region === "All" || team.region === region)
      .filter((team) => !value || searchText(team).includes(value))
      .filter((team) => team.gamesPlayed >= selectedMinimumGames)
      .sort(sortVisibleStandings);
  }, [leagueId, query, region, scopeRows, selectedMinimumGames]);
  const visibleRows = useMemo(() => filtered.map((team, index) => ({ ...team, visibleRank: index + 1 })), [filtered]);

  function updateScope(nextAgeGroup: TeamStandingsAgeGroup, nextGender = gender) {
    setAgeGroup(nextAgeGroup);
    setGender(nextGender);
    setLeagueId("All");
    setRegion("All");
    setQuery("");
    setMinimumGames(1);
  }

  function clearFilters() {
    setLeagueId("All");
    setRegion("All");
    setQuery("");
    setMinimumGames(1);
  }

  const controlClass = FilterControlClass();

  return (
    <>
      <section className="container-px border-b border-line-500 bg-court-900 py-12 text-white">
        <SectionHeader
          eyebrow="Team Rankings"
          title="Standings Board"
          description="Official team records from active game results, grouped by competition scope and current team identity."
          dark
          action={
            <div className="inline-flex border border-white/20 bg-white/10 p-1">
              {genders.map((item) => (
                <button
                  key={item}
                  onClick={() => updateScope(ageGroup, item)}
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
        summary="Standings from official games"
        action={<button onClick={clearFilters} className="text-xs font-black uppercase tracking-[0.12em] text-court-500 hover:text-hardwood-600">Clear filters</button>}
      >
            <section>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-court-500">Age Group</p>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => updateScope(group)}
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
                placeholder="Team, program, league"
              />
            </FilterField>
            <FilterField label="League">
              <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} className={controlClass}>
                <option value="All">All</option>
                {leagueOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </FilterField>
            <FilterField label="Region">
              <select value={region} onChange={(event) => setRegion(event.target.value)} className={controlClass}>
                <option>All</option>
                {regionOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </FilterField>
            <FilterField label={`Min. ${selectedMinimumGames} game${selectedMinimumGames === 1 ? "" : "s"} played`}>
              <input type="range" min={1} max={maxGamesPlayed} step={1} value={selectedMinimumGames} onChange={(event) => setMinimumGames(Number(event.target.value))} className="h-12 accent-hardwood-600" />
            </FilterField>
      </FilterBar>

      <section className="container-px mt-8">
        <div className="mb-6 border border-line-500 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-court-500">
            Showing {visibleRows.length} teams | {ageGroup} {gender} | Min. {selectedMinimumGames} game{selectedMinimumGames === 1 ? "" : "s"} played
          </p>
        </div>

        {visibleRows.length ? <TeamStandingTable rows={visibleRows} /> : <EmptyState icon="teams" title="No official team standings yet" />}
      </section>
    </>
  );
}
