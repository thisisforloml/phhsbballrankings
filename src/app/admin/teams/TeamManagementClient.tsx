"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateTeamBio, type UpdateTeamState } from "./actions";

export type ManagedTeam = {
  id: string;
  name: string;
  city: string;
  region: string;
  homeGames: number;
  awayGames: number;
  gameStats: number;
};

const initialState: UpdateTeamState = { ok: false, message: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button primary w-fit disabled:opacity-60">{pending ? "Saving..." : "Save team"}</button>;
}

export function TeamManagementClient({ teams }: { teams: ManagedTeam[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(teams[0]?.id ?? "");
  const [state, formAction] = useFormState(updateTeamBio, initialState);

  const filteredTeams = useMemo(() => {
    const value = query.trim().toLowerCase();
    return teams.filter((team) => !value || [team.name, team.city, team.region].join(" ").toLowerCase().includes(value));
  }, [query, teams]);
  const selectedTeam = teams.find((team) => team.id === selectedId) ?? filteredTeams[0] ?? null;

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Admin Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <Link href="/admin" className="rounded-md px-3 py-2 hover:bg-white/10">Dashboard</Link>
            <Link href="/admin/players" className="rounded-md px-3 py-2 hover:bg-white/10">Players</Link>
            <Link href="/admin/teams" className="rounded-md bg-white/10 px-3 py-2 text-amber-300">Teams</Link>
            <Link href="/admin/submissions" className="rounded-md px-3 py-2 hover:bg-white/10">Submissions</Link>
            <Link href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</Link>
          </nav>
        </aside>

        <section className="container-px grid gap-6 py-8 xl:grid-cols-[minmax(22rem,0.9fr)_1fr]">
          <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <p className="label">Team Management</p>
            <h1 className="mt-2 font-display text-stat-md text-navy-800">Teams</h1>
            <p className="mt-2 text-sm text-ink-600">Edit existing Team name, city, and region fields only. This does not merge teams or alter games, stats, ratings, or snapshots.</p>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team, city, region" className="mt-5 w-full rounded-md border border-surface-300 px-3 py-3" />
            <div className="mt-5 max-h-[34rem] overflow-auto rounded-md border border-surface-200">
              {filteredTeams.map((team) => (
                <button key={team.id} type="button" onClick={() => setSelectedId(team.id)} className={`grid w-full gap-1 border-b border-surface-200 px-4 py-3 text-left last:border-b-0 ${selectedTeam?.id === team.id ? "bg-navy-50" : "bg-white hover:bg-surface-50"}`}>
                  <strong className="text-ink-900">{team.name}</strong>
                  <span className="font-mono text-mono-sm uppercase text-ink-500">{team.city}, {team.region}</span>
                  <span className="text-xs text-ink-500">Games: {team.homeGames + team.awayGames} | Stat rows: {team.gameStats}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            {selectedTeam ? (
              <form action={formAction} className="grid gap-4">
                <input type="hidden" name="teamId" value={selectedTeam.id} />
                <div>
                  <p className="label">Edit Team</p>
                  <h2 className="mt-2 font-display text-3xl text-navy-800">{selectedTeam.name}</h2>
                </div>
                {state.message ? <div className={`rounded-md p-3 text-sm ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</div> : null}
                <label className="grid gap-2 text-sm font-semibold text-ink-700">Team name<input name="name" required maxLength={120} defaultValue={selectedTeam.name} className="rounded-md border border-surface-300 px-3 py-3" /></label>
                <label className="grid gap-2 text-sm font-semibold text-ink-700">City<input name="city" required maxLength={100} defaultValue={selectedTeam.city} className="rounded-md border border-surface-300 px-3 py-3" /></label>
                <label className="grid gap-2 text-sm font-semibold text-ink-700">Region<input name="region" required maxLength={100} defaultValue={selectedTeam.region} className="rounded-md border border-surface-300 px-3 py-3" /></label>
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">There is no separate school display-name schema field yet. Public pages currently normalize UAAP school names with a display mapping.</p>
                <SaveButton />
              </form>
            ) : <p className="text-ink-500">No teams found.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
