"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, UserRound } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { updatePlayerBio, type UpdatePlayerBioState } from "./actions";

const initialFormState: UpdatePlayerBioState = {
  ok: false,
  message: ""
};

export type ManagedPlayer = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender: "BOYS" | "GIRLS";
  city: string;
  region: string;
  position: string | null;
  heightCm: number | null;
  birthDate: string;
  photoUrl: string | null;
  rating: number | null;
  verifiedGameCount: number | null;
};

function playerSearchText(player: ManagedPlayer) {
  return [player.displayName, player.firstName, player.lastName, player.city, player.region, player.gender]
    .join(" ")
    .toLowerCase();
}

function displayHeight(heightCm: number | null) {
  return heightCm === null ? "-" : `${heightCm} cm`;
}

function displayRating(rating: number | null) {
  return rating === null ? "-" : rating.toFixed(2);
}

export function PlayerManagementClient({ players }: { players: ManagedPlayer[] }) {
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? "");
  const [state, formAction] = useFormState(updatePlayerBio, initialFormState);


  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  const filteredPlayers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return players;
    return players.filter((player) => playerSearchText(player).includes(value));
  }, [players, query]);
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0] ?? null;

  useEffect(() => {
    if (!selectedPlayer && filteredPlayers[0]) {
      setSelectedPlayerId(filteredPlayers[0].id);
    }
  }, [filteredPlayers, selectedPlayer]);


  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="players" />

        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Player Management</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Edit Player Bio</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Search for a player, update editable profile fields, then save. Ratings, stats, rankings, games, leagues, and seasons are read-only here.</p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{players.length} player records</span>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(30rem,1.1fr)]">
            <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
                Search players
                <span className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-h-11 w-full rounded-md border border-surface-300 bg-white pl-10 pr-3 text-ink-900"
                    placeholder="Name, hometown, region, gender"
                  />
                </span>
              </label>

              <div className="mt-5 max-h-[42rem] overflow-y-auto rounded-md border border-surface-200">
                {filteredPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`grid w-full gap-2 border-b border-surface-200 p-4 text-left last:border-b-0 hover:bg-navy-50 ${selectedPlayer?.id === player.id ? "bg-navy-50" : "bg-white"}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <strong className="text-ink-900">{player.displayName}</strong>
                      <span className="font-mono text-mono-sm text-ink-500">{player.gender}</span>
                    </span>
                    <span className="text-sm text-ink-500">{player.city}, {player.region}</span>
                    <span className="grid grid-cols-3 gap-2 font-mono text-mono-sm text-ink-600">
                      <span>{player.position || "Position missing"}</span>
                      <span>{displayHeight(player.heightCm)}</span>
                      <span>{displayRating(player.rating)}</span>
                    </span>
                  </button>
                ))}
                {!filteredPlayers.length ? <p className="p-5 text-ink-500">No matching players.</p> : null}
              </div>
            </section>

            <section className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
              {selectedPlayer ? <PlayerEditForm key={selectedPlayer.id} player={selectedPlayer} formAction={formAction} state={state} /> : <p className="text-ink-500">Select a player to edit.</p>}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function PlayerEditForm({
  player,
  formAction,
  state
}: {
  player: ManagedPlayer;
  formAction: (payload: FormData) => void;
  state: UpdatePlayerBioState;
}) {
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="playerId" value={player.id} />
      <div className="flex items-start gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-navy-50 text-navy-800">
          <UserRound className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <p className="label">Selected Player</p>
          <h2 className="font-display text-3xl text-navy-800">{player.displayName}</h2>
          <p className="mt-1 text-ink-500">Rating {displayRating(player.rating)} - {player.verifiedGameCount ?? "-"} verified games</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Display name changes may affect the public profile URL.</p>
        <p>Birth date changes do not recalculate age group or rankings here.</p>
      </div>

      {state.message ? (
        <p className={`rounded-md p-3 font-semibold ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="displayName" label="Display name" defaultValue={player.displayName} required maxLength={120} />
        <ReadonlyField label="Gender" value={player.gender} />
        <TextField name="firstName" label="First name" defaultValue={player.firstName} required maxLength={80} />
        <TextField name="lastName" label="Last name" defaultValue={player.lastName} required maxLength={80} />
        <TextField name="city" label="Hometown" defaultValue={player.city} required maxLength={100} />
        <TextField name="region" label="Region" defaultValue={player.region} required maxLength={100} />
        <TextField name="position" label="Position" defaultValue={player.position ?? ""} maxLength={20} placeholder="Optional" />
        <label className="grid gap-2 text-sm font-semibold text-surface-700">
          Height (cm)
          <input name="heightCm" type="number" min={120} max={230} defaultValue={player.heightCm ?? ""} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Optional" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">
          Birth date
          <input name="birthDate" type="date" defaultValue={player.birthDate} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" />
        </label>
        <TextField name="photoUrl" label="Photo URL" defaultValue={player.photoUrl ?? ""} maxLength={500} placeholder="https://..." />
      </div>

      <SubmitButton />
    </form>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  required = false,
  maxLength,
  placeholder
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-surface-700">
      {label}
      <input name={name} defaultValue={defaultValue} required={required} maxLength={maxLength} placeholder={placeholder} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" />
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-surface-700">
      {label}
      <input value={value} readOnly className="min-h-11 rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-surface-500" />
    </label>
  );
}

function SubmitButton() {
  const status = useFormStatus();

  return (
    <button type="submit" className="button primary w-fit" disabled={status.pending}>
      {status.pending ? "Saving..." : "Save Player Bio"}
    </button>
  );
}


