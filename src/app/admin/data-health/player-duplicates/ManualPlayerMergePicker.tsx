"use client";

import { useMemo, useState } from "react";

export type PlayerMergeOption = {
  id: string;
  displayName: string;
  programName: string | null;
  gender: string;
};

function optionLabel(player: PlayerMergeOption) {
  return `${player.displayName} / ${player.programName ?? "Unassigned"} / ${player.gender}`;
}

export function ManualPlayerMergePicker({ players }: { players: PlayerMergeOption[] }) {
  const [canonicalPlayerId, setCanonicalPlayerId] = useState("");
  const [duplicatePlayerId, setDuplicatePlayerId] = useState("");
  const duplicateOptions = useMemo(
    () => players.filter((player) => player.id !== canonicalPlayerId),
    [canonicalPlayerId, players],
  );

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-navy-900">Manual duplicate review</h2>
          <p className="mt-1 text-sm text-ink-600">Choose any two active Player records. This opens a read-only impact preview first.</p>
        </div>
        <span className="font-mono text-xs text-ink-500">{players.length} active players</span>
      </div>

      <form action="/admin/data-health/player-duplicates" method="get" className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm font-semibold text-ink-800">
          Player record to keep
          <select
            name="canonical"
            value={canonicalPlayerId}
            onChange={(event) => {
              const nextId = event.target.value;
              setCanonicalPlayerId(nextId);
              if (nextId === duplicatePlayerId) setDuplicatePlayerId("");
            }}
            required
            className="min-h-11 rounded-md border border-surface-300 bg-white px-3 py-2 font-normal"
          >
            <option value="">Select Player</option>
            {players.map((player) => <option key={player.id} value={player.id}>{optionLabel(player)}</option>)}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-ink-800">
          Duplicate record to archive
          <select
            name="duplicate"
            value={duplicatePlayerId}
            onChange={(event) => setDuplicatePlayerId(event.target.value)}
            required
            className="min-h-11 rounded-md border border-surface-300 bg-white px-3 py-2 font-normal"
          >
            <option value="">Select Player</option>
            {duplicateOptions.map((player) => <option key={player.id} value={player.id}>{optionLabel(player)}</option>)}
          </select>
        </label>

        <button
          type="submit"
          disabled={!canonicalPlayerId || !duplicatePlayerId || canonicalPlayerId === duplicatePlayerId}
          className="button secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Preview merge
        </button>
      </form>
    </section>
  );
}
