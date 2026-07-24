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
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const duplicateOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return players
      .filter((player) => player.id !== canonicalPlayerId)
      .filter((player) => !normalizedQuery || optionLabel(player).toLocaleLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [canonicalPlayerId, players, query]);

  function toggleDuplicate(playerId: string) {
    setSelectedDuplicateIds((current) => (
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : current.length < 10 ? [...current, playerId] : current
    ));
  }

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-navy-900">Manual merge</h2>
          <p className="mt-1 text-sm text-ink-600">Keep one profile and select up to 10 duplicates. Nothing changes until confirmation.</p>
        </div>
        {selectedDuplicateIds.length ? (
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
            {selectedDuplicateIds.length} selected
          </span>
        ) : null}
      </div>

      <form action="/admin/data-health/player-duplicates" method="get" className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <input type="hidden" name="mode" value="manual" />
        <input type="hidden" name="duplicates" value={selectedDuplicateIds.join(",")} />

        <label className="grid content-start gap-1.5 text-sm font-semibold text-ink-800">
          Profile to keep
          <select
            name="canonical"
            value={canonicalPlayerId}
            onChange={(event) => {
              const nextId = event.target.value;
              setCanonicalPlayerId(nextId);
              setSelectedDuplicateIds((current) => current.filter((id) => id !== nextId));
            }}
            required
            className="min-h-11 rounded-md border border-surface-300 bg-white px-3 py-2 font-normal"
          >
            <option value="">Select Player</option>
            {players.map((player) => <option key={player.id} value={player.id}>{optionLabel(player)}</option>)}
          </select>
        </label>

        <div className="grid gap-2">
          <label className="grid gap-1.5 text-sm font-semibold text-ink-800">
            Duplicate profiles
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, Program, or gender"
              className="min-h-11 rounded-md border border-surface-300 bg-white px-3 py-2 font-normal"
            />
          </label>

          <div className="max-h-72 overflow-y-auto rounded-md border border-surface-200">
            {duplicateOptions.length ? duplicateOptions.map((player) => {
              const checked = selectedDuplicateIds.includes(player.id);
              return (
                <label
                  key={player.id}
                  className={`flex cursor-pointer items-start gap-3 border-b border-surface-100 px-3 py-2.5 text-sm last:border-0 ${checked ? "bg-orange-50" : "bg-white hover:bg-surface-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDuplicate(player.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="block text-navy-900">{player.displayName}</strong>
                    <span className="text-xs text-ink-500">{player.programName ?? "Unassigned"} / {player.gender}</span>
                  </span>
                </label>
              );
            }) : (
              <p className="px-3 py-5 text-sm text-ink-500">No matching profiles.</p>
            )}
          </div>
          <p className="text-xs text-ink-500">Selected profiles remain selected when you change the search.</p>
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={!canonicalPlayerId || selectedDuplicateIds.length === 0}
            className="button secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Preview {selectedDuplicateIds.length > 1 ? `${selectedDuplicateIds.length} merges` : "merge"}
          </button>
        </div>
      </form>
    </section>
  );
}
