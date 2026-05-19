"use client";

import { useMemo, useState } from "react";
import type { TeamStandingsAgeGroup, TeamStandingsData, TeamStandingsGender } from "@/lib/team-rankings";
import { EmptyState, WinLossPill } from "@/components/ui";

const ageGroups: TeamStandingsAgeGroup[] = ["U13", "U16", "U19"];
const genders: TeamStandingsGender[] = ["Boys", "Girls"];

function searchText(team: TeamStandingsData["rows"][number]) {
  return [team.displayName, team.internalTeamName, team.leagueName, team.seasonName, team.city, team.region]
    .join(" ")
    .toLowerCase();
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
      .sort((left, right) => left.rank - right.rank || left.displayName.localeCompare(right.displayName));
  }, [leagueId, query, region, scopeRows, selectedMinimumGames]);

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

  return (
    <>
      <section className="container-px">
        <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Team Rankings</p>
              <h1 className="mt-2 font-display text-stat-md text-navy-800">Rankings</h1>
            </div>
            <div className="inline-flex rounded-full border border-surface-300 bg-surface-50 p-1">
              {genders.map((item) => (
                <button
                  key={item}
                  onClick={() => updateScope(ageGroup, item)}
                  className={`rounded-full px-6 py-2 font-semibold ${gender === item ? "bg-navy-800 text-white" : "text-ink-600 hover:text-navy-800"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 font-mono text-mono-sm uppercase text-ink-400">Standings from official games</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr_1fr_1fr]">
            <section>
              <p className="mb-3 font-mono text-mono-sm uppercase text-ink-500">Age Group</p>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => updateScope(group)}
                    className={`rounded-full px-4 py-2 font-mono text-mono-sm ${ageGroup === group ? "bg-navy-800 text-white" : "bg-surface-100 text-ink-600"}`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </section>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              Search
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900"
                placeholder="Team, school, league"
              />
            </label>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              League
              <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
                <option value="All">All</option>
                {leagueOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
              Region
              <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">
                <option>All</option>
                {regionOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-3 font-mono text-mono-sm uppercase text-ink-500">
              {`Min. ${selectedMinimumGames} game${selectedMinimumGames === 1 ? "" : "s"} played`}
              <input type="range" min={1} max={maxGamesPlayed} step={1} value={selectedMinimumGames} onChange={(event) => setMinimumGames(Number(event.target.value))} className="accent-navy-800" />
            </label>
          </div>

          <button onClick={clearFilters} className="mt-5 font-mono text-mono-sm uppercase text-ink-500 hover:text-amber-600">
            Clear filters
          </button>
        </div>
      </section>

      <section className="container-px mt-8">
        <div className="mb-6 rounded-lg bg-white p-5 shadow-sm">
          <p className="font-mono text-mono-sm uppercase text-ink-500">
            Showing {filtered.length} teams | {ageGroup} {gender} | Min. {selectedMinimumGames} game{selectedMinimumGames === 1 ? "" : "s"} played
          </p>
        </div>

        {filtered.length ? (
          <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[5rem_1.2fr_1.2fr_8rem_8rem_7rem_7rem_7rem_1fr] gap-3 border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
              <span>Rank</span><span>Team</span><span>Internal team</span><span>Record</span><span>Win %</span><span title="Points Scored">PF</span><span title="Points Allowed">PA</span><span title="Point Difference">Diff</span><span>League / Season</span>
            </div>
            {filtered.map((team) => (
              <div key={team.id} className="grid gap-3 border-b border-l-0 border-surface-200 px-4 py-4 transition hover:border-l-[3px] hover:border-l-amber-500 hover:bg-amber-100 last:border-b-0 lg:grid-cols-[5rem_1.2fr_1.2fr_8rem_8rem_7rem_7rem_7rem_1fr] lg:items-center">
                <span className={`font-mono ${team.rank === 1 ? "text-amber-700" : "text-ink-500"}`}>#{team.rank}</span>
                <strong className="text-ink-900" title={team.displayName}>{team.displayName}</strong>
                <span className="text-sm text-ink-500" title={team.internalTeamName}>{team.internalTeamName}</span>
                <span className="flex gap-2"><WinLossPill result="W" /> <strong className="font-display">{team.wins}</strong><WinLossPill result="L" /> <strong className="font-display">{team.losses}</strong></span>
                <span className="font-display text-stat-sm">{team.winPercentage.toFixed(3)}</span>
                <span className="font-mono text-sm text-ink-700" title="Points Scored">{team.pointsFor}</span>
                <span className="font-mono text-sm text-ink-700" title="Points Allowed">{team.pointsAgainst}</span>
                <span className={`font-mono text-sm ${team.pointDifferential >= 0 ? "text-green-700" : "text-red-700"}`} title="Point Difference">{team.pointDifferential >= 0 ? "+" : ""}{team.pointDifferential}</span>
                <span className="truncate text-ink-600" title={`${team.leagueName} / ${team.seasonName}`}>{team.leagueName} / {team.seasonName}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState icon="teams" title="No official team standings yet" />}
      </section>
    </>
  );
}

