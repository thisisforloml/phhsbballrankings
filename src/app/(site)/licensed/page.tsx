"use client";

import { FormEvent, useState } from "react";

interface LicensedPlayer {
  id: string;
  displayName: string;
  gender: string;
  position: string;
  games: number;
  averages: { points: number; rebounds: number | null; assists: number | null };
  advanced: { effectiveFgPct: number | null; assistToTurnover: number | null; threePct: number | null };
  gamesByLeague: Array<{ league: string; season: string; games: Array<{ gameNumber: string | null; date: string; matchup: string; points: number; rebounds: number | null; assists: number | null; detailedStatsComplete?: boolean }> }>;
}

export default function LicensedAccessPage() {
  const [message, setMessage] = useState("");
  const [players, setPlayers] = useState<LicensedPlayer[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Checking licensed access...");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/licensed/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") })
    });
    const result = (await response.json()) as { ok: boolean; message?: string; players?: LicensedPlayer[] };
    if (!result.ok) {
      setPlayers([]);
      setMessage(result.message ?? "Access denied.");
      return;
    }
    setPlayers(result.players ?? []);
    setMessage("Licensed data unlocked.");
  }

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px grid gap-6 py-14 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Licensed Data Layer</p>
            <h1 className="mt-3 font-display text-stat-lg">Full performance database</h1>
          </div>
          <p className="text-white/70">Commercial-grade player histories, advanced metrics, league grouping, exportable reports, widgets, and trend products are gated here. Organizer accounts cannot access this area.</p>
        </div>
      </section>
      <section className="container-px pt-10">
        {!players.length ? (
          <form className="mx-auto grid max-w-xl gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
            <h2 className="font-display text-3xl text-ink-900">Premium member access</h2>
            <p className="text-ink-600">Sign in with a Premium account to unlock the licensed data layer.</p>
            <label className="grid gap-2 text-ink-700">Username<input className="rounded-md border border-surface-300 px-4 py-3" name="username" required /></label>
            <label className="grid gap-2 text-ink-700">Password<input className="rounded-md border border-surface-300 px-4 py-3" name="password" type="password" required /></label>
            <button className="button primary" type="submit">Unlock licensed data</button>
            {message ? <p className="text-ink-600">{message}</p> : null}
          </form>
        ) : (
          <section className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-ink-600">{message}</p>
              <button className="button secondary" type="button" onClick={() => setPlayers([])}>Lock data</button>
            </div>
            {players.map((player) => (
              <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm" key={player.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-3xl text-ink-900">{player.displayName}</h2>
                    <p className="text-ink-600">{player.gender} · {player.position} · {player.games} verified games</p>
                  </div>
                  <strong className="rounded-md bg-navy-800 px-4 py-3 font-display text-stat-sm text-white">{player.averages.points} PPG</strong>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <span className="rounded-lg bg-surface-100 p-4"><strong className="font-display text-stat-sm text-navy-800">{player.advanced.effectiveFgPct ?? "Pending"}</strong><small className="block font-mono text-mono-sm text-ink-500">eFG%</small></span>
                  <span className="rounded-lg bg-surface-100 p-4"><strong className="font-display text-stat-sm text-navy-800">{player.advanced.assistToTurnover ?? "Pending"}</strong><small className="block font-mono text-mono-sm text-ink-500">AST TO</small></span>
                  <span className="rounded-lg bg-surface-100 p-4"><strong className="font-display text-stat-sm text-navy-800">{player.advanced.threePct ?? "Pending"}</strong><small className="block font-mono text-mono-sm text-ink-500">3P%</small></span>
                </div>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
