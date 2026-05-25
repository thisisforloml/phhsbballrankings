"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { updateTeamBio, type UpdateTeamState } from "./actions";

export type ManagedTeam = {
  id: string;
  name: string;
  publicSchoolName: string;
  programKey: string;
  programAbbreviation: string;
  programType: string;
  teamDisplayName: string;
  needsCleanup: boolean;
  isActiveCompetitionTeam: boolean;
  city: string;
  region: string;
  homeGames: number;
  awayGames: number;
  gameStats: number;
  historicalHomeGames: number;
  historicalAwayGames: number;
  historicalGameStats: number;
  playerCount: number;
  playerNames: string[];
  context: string;
  contexts: string[];
};

export type TeamSchoolGroup = {
  publicSchoolName: string;
  programAbbreviation: string;
  programType: string;
  teams: ManagedTeam[];
  hasSameContextDuplicate: boolean;
};

type RecordFilter = "ACTIVE" | "INACTIVE" | "NEEDS_CLEANUP";

const initialState: UpdateTeamState = { ok: false, message: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button primary w-fit disabled:opacity-60">{pending ? "Saving..." : "Save team"}</button>;
}

function teamSearchText(team: ManagedTeam) {
  return [team.name, team.publicSchoolName, team.programAbbreviation, team.programType, team.teamDisplayName, team.city, team.region, team.context, ...team.contexts].join(" ").toLowerCase();
}

export function TeamManagementClient({ teams, activeSchoolGroups }: { teams: ManagedTeam[]; activeSchoolGroups: TeamSchoolGroup[] }) {
  const [query, setQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("ACTIVE");
  const [selectedId, setSelectedId] = useState(teams.find((team) => team.isActiveCompetitionTeam)?.id ?? teams[0]?.id ?? "");
  const [state, formAction] = useFormState(updateTeamBio, initialState);

  const activeTeams = useMemo(() => teams.filter((team) => team.isActiveCompetitionTeam), [teams]);
  const inactiveTeams = useMemo(() => teams.filter((team) => !team.isActiveCompetitionTeam), [teams]);
  const sameContextDuplicateCount = activeTeams.filter((team) => team.needsCleanup).length;
  const filteredActiveGroups = useMemo(() => {
    const value = query.trim().toLowerCase();
    return activeSchoolGroups
      .map((group) => ({
        ...group,
        teams: group.teams.filter((team) => (recordFilter !== "NEEDS_CLEANUP" || team.needsCleanup) && (!value || teamSearchText(team).includes(value)))
      }))
      .filter((group) => group.teams.length > 0);
  }, [activeSchoolGroups, query, recordFilter]);
  const filteredInactiveTeams = useMemo(() => {
    const value = query.trim().toLowerCase();
    return inactiveTeams.filter((team) => !value || teamSearchText(team).includes(value));
  }, [inactiveTeams, query]);
  const selectedTeam = teams.find((team) => team.id === selectedId) ?? filteredActiveGroups[0]?.teams[0] ?? filteredInactiveTeams[0] ?? null;

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="teams" />

        <section className="container-px grid gap-6 py-8 xl:grid-cols-[minmax(28rem,1.05fr)_minmax(24rem,0.95fr)]">
          <div className="grid gap-6">
            <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <p className="label">Internal Team Records</p>
              <h1 className="mt-2 font-display text-stat-md text-navy-800">Internal Team Records</h1>
              <p className="mt-2 text-sm text-ink-600">Program Management is now the main editor. This secondary page is kept for reviewing individual Team records.</p>
              <p className="mt-4 rounded-md bg-amber-50 p-4 text-sm font-semibold text-amber-900">Use /admin/programs for normal school, club, team, and player editing. Editing here changes only the selected Team record and does not update Program groups.</p>
              <div className="mt-5 grid gap-3">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search program, team, player, city, region" className="w-full rounded-md border border-surface-300 px-3 py-3" />
                <div className="flex flex-wrap gap-2" aria-label="Record filters">
                  {[
                    { value: "ACTIVE" as const, label: `Active records (${activeTeams.length})` },
                    { value: "INACTIVE" as const, label: `Inactive records (${inactiveTeams.length})` },
                    { value: "NEEDS_CLEANUP" as const, label: `Review flags (${sameContextDuplicateCount})` }
                  ].map((filter) => (
                    <button key={filter.value} type="button" onClick={() => setRecordFilter(filter.value)} className={`rounded-full px-4 py-2 text-sm font-semibold ${recordFilter === filter.value ? "bg-navy-800 text-white" : "bg-surface-100 text-ink-700 hover:bg-surface-200"}`}>
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {recordFilter !== "INACTIVE" ? (
              <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl text-navy-800">{recordFilter === "NEEDS_CLEANUP" ? "Review Flags" : "Active Records"}</h2>
                    <p className="mt-1 text-sm text-ink-600">Active records are used by official games or stats. Inactive records are hidden unless selected above.</p>
                  </div>
                  <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${sameContextDuplicateCount ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>{sameContextDuplicateCount ? `${sameContextDuplicateCount} review flags` : "No active same-context duplicates"}</span>
                </div>
                <div className="mt-5 grid gap-4">
                  {filteredActiveGroups.map((group) => (
                    <article key={group.publicSchoolName} className="rounded-lg border border-surface-200 p-4">
                      <button type="button" onClick={() => setSelectedId(group.teams[0]?.id ?? selectedId)} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
                        <div><h3 className="font-semibold text-ink-900">{group.publicSchoolName}</h3><p className="text-xs uppercase tracking-wide text-ink-500">{group.programAbbreviation} / {group.programType}</p></div>
                        <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${group.hasSameContextDuplicate ? "bg-amber-100 text-amber-900" : "bg-green-50 text-green-800"}`}>{group.hasSameContextDuplicate ? "Needs review" : "Expected"}</span>
                      </button>
                      <div className="mt-3 rounded-md bg-surface-100 p-3 text-sm text-ink-600">Program group fields are managed in Program Management. Click an internal Team record below only when you need to edit that internal moniker.</div>
                      <div className="mt-3 grid gap-2">
                        {group.teams.map((team) => (
                          <button key={team.id} type="button" onClick={() => setSelectedId(team.id)} className={`grid gap-1 rounded-md border px-3 py-3 text-left ${selectedTeam?.id === team.id ? "border-navy-800 bg-navy-50" : "border-surface-200 bg-white hover:bg-surface-50"}`}>
                            <span className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-ink-900">{team.teamDisplayName}</strong>
                              <span className="font-mono text-mono-sm uppercase text-ink-500">{team.context}</span>
                            </span>
                            <span className="text-xs text-ink-600">{team.contexts.join(" | ")}</span>
                            <span className="text-xs text-ink-500">Games: {team.homeGames + team.awayGames} | Stat rows: {team.gameStats} | Players: {team.playerCount}</span>
                            {team.playerNames.length ? <span className="text-xs text-ink-500">Players: {team.playerNames.slice(0, 8).join(", ")}{team.playerNames.length > 8 ? ` +${team.playerNames.length - 8} more` : ""}</span> : null}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                  {!filteredActiveGroups.length ? <p className="rounded-md bg-surface-100 p-4 text-sm text-ink-600">No active records match these filters.</p> : null}
                </div>
              </section>
            ) : null}

            {recordFilter === "INACTIVE" ? (
              <details open className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer font-display text-2xl text-navy-800">Inactive Team Records ({inactiveTeams.length})</summary>
                <p className="mt-3 rounded-md bg-surface-100 p-4 text-sm text-ink-600">These records are not currently used by official games or stats. They are hidden from the normal workflow and kept only for audit/review.</p>
                <div className="mt-4 grid gap-2">
                  {filteredInactiveTeams.map((team) => (
                    <button key={team.id} type="button" onClick={() => setSelectedId(team.id)} className={`grid gap-1 rounded-md border px-3 py-3 text-left ${selectedTeam?.id === team.id ? "border-navy-800 bg-navy-50" : "border-surface-200 bg-white hover:bg-surface-50"}`}>
                      <strong className="text-ink-900">{team.teamDisplayName}</strong>
                      <span className="text-sm text-ink-600">Program: {team.publicSchoolName} ({team.programAbbreviation})</span>
                      <span className="font-mono text-mono-sm uppercase text-ink-500">{team.city}, {team.region}</span>
                      <span className="text-xs text-ink-500">Historical linked rows: home games {team.historicalHomeGames}, away games {team.historicalAwayGames}, stat rows {team.historicalGameStats}</span>
                    </button>
                  ))}
                  {!filteredInactiveTeams.length ? <p className="rounded-md bg-surface-100 p-4 text-sm text-ink-600">No inactive records match these filters.</p> : null}
                </div>
              </details>
            ) : null}
          </div>

          <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            {selectedTeam ? (
              <form action={formAction} className="grid gap-4">
                <input type="hidden" name="teamId" value={selectedTeam.id} />
                <div>
                  <p className="label">Edit Team</p>
                  <h2 className="mt-2 font-display text-3xl text-navy-800">{selectedTeam.teamDisplayName}</h2>
                  <p className="mt-1 text-sm text-ink-600">Program: {selectedTeam.publicSchoolName} ({selectedTeam.programAbbreviation})</p>
                  <p className="mt-1 text-sm text-ink-500">Internal team record: {selectedTeam.name}</p>
                  <p className="mt-1 text-sm text-ink-500">Context: {selectedTeam.context}</p>
                  {selectedTeam.isActiveCompetitionTeam ? <p className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-900">Active competition team. Separate roster records by age group or gender are expected.</p> : <p className="mt-3 rounded-md bg-surface-100 p-3 text-sm text-ink-700">Inactive record. It is not currently used by official games or stats, so do not merge/delete without a separate approved cleanup plan.</p>}
                </div>
                {state.message ? <div className={`rounded-md p-3 text-sm ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</div> : null}
                <label className="grid gap-2 text-sm font-semibold text-ink-700">Team / Moniker Name<input name="name" required maxLength={120} defaultValue={selectedTeam.name} className="rounded-md border border-surface-300 px-3 py-3" /></label>
                <label className="grid gap-2 text-sm font-semibold text-ink-700">City<input name="city" required maxLength={100} defaultValue={selectedTeam.city} className="rounded-md border border-surface-300 px-3 py-3" /><span className="text-xs font-normal text-ink-500">Required by the current Team schema. Program city can be blank after the Program model migration.</span></label>
                <label className="grid gap-2 text-sm font-semibold text-ink-700">Region<input name="region" required maxLength={100} defaultValue={selectedTeam.region} className="rounded-md border border-surface-300 px-3 py-3" /><span className="text-xs font-normal text-ink-500">Required by the current Team schema.</span></label>
                <p className="rounded-md bg-surface-100 p-3 text-sm text-ink-600">This form does not merge teams, delete teams, or modify games, stats, ratings, or snapshots.</p>
                <SaveButton />
              </form>
            ) : <p className="text-ink-500">No teams found.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
