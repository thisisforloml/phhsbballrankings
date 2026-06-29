"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatPlayerName, players } from "@/lib/mock-data";

export function ClaimPageClient() {
  const params = useSearchParams();
  const routePlayer = params.get("player") ?? "";
  const [search, setSearch] = useState(routePlayer.replace(/-/g, " "));
  const [debounced, setDebounced] = useState(search);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const matches = useMemo(() => {
    const value = debounced.trim().toLowerCase();
    if (!value) return [];
    return players
      .filter(
        (player) =>
          formatPlayerName(player).toLowerCase().includes(value) ||
          player.id.toLowerCase() === routePlayer.toLowerCase()
      )
      .slice(0, 8);
  }, [debounced, routePlayer]);
  const selected = players.find((player) => player.id === selectedId) ?? matches[0] ?? null;

  useEffect(() => {
    if (!selectedId && matches[0]) setSelectedId(matches[0].id);
  }, [matches, selectedId]);

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const playerName = selected ? formatPlayerName(selected) : String(form.get("playerName") ?? "");
    const claimantName = String(form.get("claimantName") ?? "").trim();
    const [firstName, ...rest] = playerName.trim().split(/\s+/);
    const relationship = String(form.get("relationship") ?? "").trim();
    const contactEmail = String(form.get("contactEmail") ?? "").trim();
    const contactPhone = String(form.get("contactPhone") ?? "").trim();
    const schoolTeam = String(form.get("schoolTeam") ?? "").trim();
    const details = String(form.get("details") ?? "").trim();

    const response = await fetch("/api/player-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerName,
        firstName: firstName || claimantName,
        lastName: rest.join(" ") || claimantName,
        contact: [contactEmail, contactPhone].filter(Boolean).join(" / "),
        city: selected?.city,
        region: selected?.region,
        position: selected?.position ?? undefined,
        message: [`Claimant: ${claimantName}`, `Relationship: ${relationship}`, `School/team: ${schoolTeam}`, details]
          .filter(Boolean)
          .join("\n"),
      }),
    });
    const result = (await response.json()) as { ok: boolean; message?: string };
    setPending(false);
    setStatus({
      ok: result.ok,
      message: result.ok
        ? "Claim request submitted for admin review."
        : (result.message ?? "Unable to submit claim request."),
    });
  }

  return (
    <main className="bg-surface-50 pb-24">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Profile Claim</p>
          <h1 className="mt-3 font-display text-stat-lg">Claim Your Profile</h1>
          <p className="mt-4 max-w-2xl text-white/70">
            Submit a profile claim for admin review. Claims do not change public player data until approved.
          </p>
        </div>
      </section>
      <section className="container-px grid gap-6 pt-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-3xl text-navy-800">Find Profile</h2>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Player name
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-md border border-surface-300 px-3 py-3"
              placeholder="Search player name"
            />
          </label>
          <div className="grid gap-3">
            {matches.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedId(player.id)}
                className={`rounded-md border p-4 text-left transition ${
                  selectedId === player.id
                    ? "border-navy-800 bg-navy-50"
                    : "border-surface-200 bg-surface-50 hover:border-navy-800"
                }`}
              >
                <strong className="block text-ink-900">{formatPlayerName(player)}</strong>
                <span className="text-sm text-ink-600">
                  {player.position ? `${player.position} · ` : ""}
                  {player.city}
                </span>
              </button>
            ))}
            {debounced && !matches.length ? (
              <p className="rounded-md bg-surface-100 p-4 text-ink-600">
                No matching profile found. You can still submit the claim details for admin review.
              </p>
            ) : null}
            {!debounced ? <p className="text-ink-500">Matching profiles will appear here as you type.</p> : null}
          </div>
        </section>
        <form onSubmit={submitClaim} className="h-fit grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-3xl text-navy-800">Claim Details</h2>
          {selected ? (
            <p className="rounded-md bg-navy-50 p-3 text-ink-700">
              Selected profile: <strong>{formatPlayerName(selected)}</strong>
            </p>
          ) : null}
          {status ? (
            <p
              className={`rounded-md p-4 font-semibold ${
                status.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {status.message}
            </p>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Player profile being claimed
            <input
              name="playerName"
              defaultValue={selected ? formatPlayerName(selected) : search}
              className="rounded-md border border-surface-300 px-3 py-3"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Claimant name
            <input name="claimantName" className="rounded-md border border-surface-300 px-3 py-3" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Relationship to player
            <input
              name="relationship"
              className="rounded-md border border-surface-300 px-3 py-3"
              placeholder="Self, parent, guardian, coach"
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-surface-700">
              Contact email
              <input name="contactEmail" type="email" className="rounded-md border border-surface-300 px-3 py-3" required />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-surface-700">
              Contact phone
              <input name="contactPhone" className="rounded-md border border-surface-300 px-3 py-3" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            School/team
            <input
              name="schoolTeam"
              defaultValue={selected?.school ?? ""}
              className="rounded-md border border-surface-300 px-3 py-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Proof/details message
            <textarea
              name="details"
              rows={5}
              className="rounded-md border border-surface-300 px-3 py-3"
              placeholder="Share details that help verify the claim."
              required
            />
          </label>
          <button className="button primary w-fit" type="submit" disabled={pending}>
            {pending ? "Submitting..." : "Submit Claim Request"}
          </button>
          <p className="rounded-md bg-surface-100 p-4 text-sm text-ink-600">
            Admin review is available in the existing administrator requests dashboard.
          </p>
        </form>
      </section>
    </main>
  );
}
