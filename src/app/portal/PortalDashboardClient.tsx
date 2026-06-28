"use client";

import { useMemo, useState } from "react";
import { Activity, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { formatPlayerName, leagues, players } from "@/lib/mock-data";

const statColumns = ["MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FGM", "FGA", "3PM", "3PA", "FTM", "FTA", "OREB", "DREB"];

export function PortalDashboardClient() {
  const [mode, setMode] = useState<"manual" | "upload">("manual");
  const [playerQuery, setPlayerQuery] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitted, setSubmitted] = useState(false);


  const suggestions = useMemo(() => {
    const value = playerQuery.trim().toLowerCase();
    if (!value) return [];
    return players.filter((player) => formatPlayerName(player).toLowerCase().includes(value)).slice(0, 5);
  }, [playerQuery]);


  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <aside className="bg-navy-800 px-5 py-8 text-white lg:min-h-[calc(100vh-5rem)]">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Organizer Portal</p>
          <nav className="mt-8 grid gap-2 font-semibold">
            <a href="#dashboard" className="rounded-md px-3 py-2 hover:bg-white/10">Dashboard</a>
            <a href="#leagues" className="rounded-md px-3 py-2 hover:bg-white/10">My Leagues</a>
            <a href="/portal/live-stats" className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-amber-300 hover:bg-white/10">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Live Stats Entry
            </a>
            <a href="#submit" className="rounded-md px-3 py-2 hover:bg-white/10">Submit Game Stats</a>
            <a href="#pending" className="rounded-md px-3 py-2 hover:bg-white/10">Pending Submissions</a>
            <a href="/portal/players" className="rounded-md px-3 py-2 hover:bg-white/10">Players</a>
            <a href="/portal/logout" className="rounded-md px-3 py-2 hover:bg-white/10">Sign out</a>
          </nav>
        </aside>
        <section className="container-px grid gap-6 py-8">
          <div id="dashboard" className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="label">Dashboard</p>
                <h1 className="font-display text-stat-md text-navy-800">League Workspace</h1>
              </div>
            <a href="/portal/live-stats" className="button primary">Live Stats Entry</a>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Metric value="0" label="Assigned leagues" />
              <Metric value="0" label="Pending submissions" />
              <Metric value="-" label="Compliance rate" />
            </div>
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <div id="leagues" className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
              <h2 className="font-display text-3xl text-navy-800">Assigned Leagues</h2>
              <EmptyState icon="leagues" title="No assigned leagues yet" />
            </div>
            <div id="pending" className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
              <h2 className="font-display text-3xl text-navy-800">Recent Activity</h2>
              <EmptyState icon="scores" title="No recent activity" />
            </div>
          </section>

          <section id="submit" className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMode("manual")} className={`button ${mode === "manual" ? "primary" : "secondary"}`}>Manual entry</button>
              <button onClick={() => setMode("upload")} className={`button ${mode === "upload" ? "primary" : "secondary"}`}>AI statsheet upload</button>
            </div>

            {submitted ? <p className="mt-5 rounded-md bg-navy-50 p-4 font-semibold text-navy-800">Submitted for Peach Basket Rankings PH review. You will be notified when this game is verified.</p> : null}

            {mode === "manual" ? (
              <div className="mt-6 grid gap-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2 text-sm font-semibold text-surface-700">Select league<select className="min-h-11 rounded-md border border-surface-200 px-3 py-2"><option>No assigned leagues</option>{leagues.map((league) => <option key={league.id}>{league.name}</option>)}</select></label>
                  <label className="grid gap-2 text-sm font-semibold text-surface-700">Game date<input className="min-h-11 rounded-md border border-surface-200 px-3 py-2" type="date" /></label>
                  <label className="grid gap-2 text-sm font-semibold text-surface-700">Home team vs away team<input className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Home team vs away team" /></label>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-surface-700">Player autocomplete<input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Type player name" /></label>
                <div className="grid gap-2">
                  {suggestions.map((player) => (
                    <div key={player.id} className="flex items-center justify-between rounded-md border border-surface-200 bg-surface-50 p-3">
                      <span>{formatPlayerName(player)} <small className="text-surface-500">confidence 94%</small></span>
                      <button className="button secondary" type="button">Use player</button>
                    </div>
                  ))}
                  {playerQuery && !suggestions.length ? <p className="text-surface-600">No match found. A stub profile tagged [Pending Verification] will be created on submission.</p> : null}
                </div>
                <StatEntryGrid />
                <button className="button secondary w-fit" type="button">Add player row</button>
                <button onClick={() => setSubmitted(true)} className="button primary w-fit">Review and submit</button>
              </div>
            ) : (
              <div className="mt-6 grid gap-5">
                <label className="grid gap-2 text-sm font-semibold text-surface-700">
                  Upload official statsheet
                  <span className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-surface-300 bg-surface-50 text-center text-surface-500">
                    <span><Upload className="mx-auto mb-3 h-7 w-7" aria-hidden="true" />PDF or typed image only</span>
                    <input className="sr-only" type="file" accept="application/pdf,image/*" />
                  </span>
                </label>
                <button className="button primary w-fit" onClick={() => { setParsing(true); window.setTimeout(() => setParsing(false), 1200); }}>Read statsheet</button>
                {parsing ? <div className="rounded-lg bg-navy-50 p-5 font-mono text-navy-800">Reading statsheet... 68%</div> : <StatEntryGrid />}
                <button onClick={() => setSubmitted(true)} className="button primary w-fit">Submit reviewed stats</button>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <span className="rounded-lg bg-navy-50 p-4">
      <strong className="block font-display text-stat-sm text-navy-800">{value}</strong>
      <small className="font-mono text-mono-sm uppercase text-surface-500">{label}</small>
    </span>
  );
}

function StatEntryGrid() {
  return (
    <div className="overflow-x-auto rounded-lg border border-surface-200">
      <div className="min-w-[72rem]">
        <div className="grid grid-cols-[12rem_9rem_repeat(15,4.5rem)] gap-2 bg-surface-100 p-3 font-mono text-mono-sm uppercase text-surface-600">
          <span>Player</span><span>Team</span>{statColumns.map((column) => <span key={column}>{column}</span>)}
        </div>
        {[1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-[12rem_9rem_repeat(15,4.5rem)] gap-2 border-t border-surface-200 p-3">
            <input className="rounded border border-surface-200 px-2" placeholder={`Player ${row}`} />
            <input className="rounded border border-surface-200 px-2" placeholder="Team" />
            {statColumns.map((column) => <input key={column} aria-label={column} className="rounded border border-surface-200 px-2" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

