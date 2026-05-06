"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPlayerName, players } from "@/lib/mock-data";

export default function ClaimPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const matches = useMemo(() => {
    const value = debounced.trim().toLowerCase();
    if (!value) return [];
    return players.filter((player) => formatPlayerName(player).toLowerCase().includes(value)).slice(0, 8);
  }, [debounced]);
  const selected = players.find((player) => player.id === selectedId);

  return (
    <main className="bg-surface-50 pb-20">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Profile Claim</p>
          <h1 className="mt-3 font-display text-stat-lg">Claim Your Profile</h1>
          <p className="mt-4 max-w-2xl text-white/70">Search for the profile created from verified game submissions, then verify ownership by email.</p>
        </div>
      </section>
      <section className="container-px grid gap-6 pt-10 lg:grid-cols-[1fr_0.8fr]">
        <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-3xl">Step 1 â€” Search</h2>
          <label className="grid gap-2 text-sm font-semibold">
            Enter your full name
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-md border border-surface-300 px-3 py-3" />
          </label>
          <div className="grid gap-3">
            {matches.map((player) => (
              <button key={player.id} type="button" onClick={() => setSelectedId(player.id)} className={`rounded-md border p-4 text-left transition ${selectedId === player.id ? "border-navy-800 bg-navy-50" : "border-surface-200 bg-surface-50 hover:border-navy-800"}`}>
                <strong className="block text-ink-900">{formatPlayerName(player)}</strong>
                <span className="text-sm text-ink-600">{player.position ? `${player.position} · ` : ""}{player.city} · {player.ageGroup}</span>
              </button>
            ))}
            {debounced && !matches.length ? <p className="rounded-md bg-surface-100 p-4 text-ink-600">Don't see your name? Your profile is created automatically when a verified league submits your stats. Contact your league organizer.</p> : null}
            {!debounced ? <p className="text-ink-500">Matching profiles will appear here as you type.</p> : null}
          </div>
        </section>
        <form onSubmit={(event) => { event.preventDefault(); setSent(true); }} className="h-fit grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-3xl">Step 2 â€” Verify</h2>
          {selected ? <p className="text-ink-600">Selected profile: <strong>{formatPlayerName(selected)}</strong></p> : <p className="text-ink-500">Select a matching profile first.</p>}
          {sent ? (
            <p className="rounded-md bg-navy-50 p-4 text-navy-800">We've sent a verification link to your email. Click the link to claim this profile.</p>
          ) : (
            <>
              <label className="grid gap-2 text-sm font-semibold">Enter your email address<input value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-md border border-surface-300 px-3 py-3" type="email" required disabled={!selected} /></label>
              <button className="button primary" type="submit" disabled={!selected}>Send Verification Link</button>
            </>
          )}
          <div className="rounded-md bg-surface-100 p-4 text-sm text-ink-600">
            After verification, players can add photo, height, weight, school, birthdate, social links, and set a password.
          </div>
        </form>
      </section>
    </main>
  );
}
