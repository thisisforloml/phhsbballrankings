"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormState } from "react-dom";
import { Search } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { AdminPlayerEditPanel, PlayerAvatar, type ManagedPlayer } from "@/components/admin/AdminPlayerEditPanel";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";
import { updatePlayerBio, type UpdatePlayerBioState } from "./actions";

export type { ManagedPlayer };

const initialFormState: UpdatePlayerBioState = { ok: false, message: "" };
const ageBracketOptions = ["All", "U13", "U16", "U19", "Unknown"];
const FILTER_DEFAULTS = { search: "", program: "All", gender: "All", ageBracket: "All" };

function playerSearchText(player: ManagedPlayer) {
  return [player.displayName, player.firstName, player.lastName, player.school, player.hometown, player.region, player.gender, player.displayAgeBracket]
    .join(" ")
    .toLowerCase();
}

function displayRating(rating: number | null) {
  if (rating === null) return null;
  return rating.toFixed(1);
}

function MetaChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "muted" }) {
  const toneClass =
    tone === "accent"
      ? "border-orange-200 bg-orange-50 text-orange-900"
      : tone === "muted"
        ? "border-surface-200 bg-surface-100 text-ink-500"
        : "border-surface-200 bg-white text-ink-700";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

export function PlayerManagementClient({
  players,
  programs
}: {
  players: ManagedPlayer[];
  programs: Array<{ id: string; fullName: string }>;
}) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "program", "gender", "ageBracket"],
    debounceKey: "search"
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? "");
  const [state, formAction] = useFormState(updatePlayerBio, initialFormState);

  const query = filters.search;
  const schoolFilter = filters.program;
  const genderFilter = filters.gender;
  const ageBracketFilter = filters.ageBracket;

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  const schoolOptions = useMemo(() => Array.from(new Set(players.map((player) => player.school || "Unknown"))).sort(), [players]);

  const filteredPlayers = useMemo(() => {
    const value = query.trim().toLowerCase();
    return players
      .filter((player) => !value || playerSearchText(player).includes(value))
      .filter((player) => schoolFilter === "All" || (player.school || "Unknown") === schoolFilter)
      .filter((player) => genderFilter === "All" || player.gender === genderFilter)
      .filter((player) => ageBracketFilter === "All" || player.displayAgeBracket === ageBracketFilter || (!player.displayAgeBracket && ageBracketFilter === "Unknown"));
  }, [ageBracketFilter, genderFilter, players, query, schoolFilter]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0] ?? null;
  const hasActiveFilters = Boolean(query.trim()) || schoolFilter !== "All" || genderFilter !== "All" || ageBracketFilter !== "All";

  useEffect(() => {
    if (!selectedPlayer && filteredPlayers[0]) setSelectedPlayerId(filteredPlayers[0].id);
  }, [filteredPlayers, selectedPlayer]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
          <div className="relative z-10 shrink-0 border-b border-surface-200 bg-white p-3">
            <AdminFilterRow
              compact
              className="min-w-0"
              searchLabel="Search players"
              searchPlaceholder="Name, program, hometown"
              searchValue={query}
              onSearchChange={(value) => patchFilters({ search: value })}
              searchLeadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />}
              selects={[
                {
                  name: "program",
                  label: "Program",
                  value: schoolFilter,
                  options: ["All", ...schoolOptions].map((option) => ({ value: option, label: option })),
                },
                {
                  name: "gender",
                  label: "Gender",
                  value: genderFilter,
                  options: ["All", "BOYS", "GIRLS"].map((option) => ({ value: option, label: option })),
                },
                {
                  name: "ageBracket",
                  label: "Age",
                  value: ageBracketFilter,
                  options: ageBracketOptions.map((option) => ({ value: option, label: option })),
                },
              ]}
              onSelectChange={(name, value) => patchFilters({ [name]: value } as Partial<typeof FILTER_DEFAULTS>)}
              onClear={clearFilters}
              showClear={hasActiveFilters}
              resultCount={filteredPlayers.length}
              resultLabel="shown"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filteredPlayers.map((player) => {
            const selected = selectedPlayer?.id === player.id;
            const rating = displayRating(player.rating);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedPlayerId(player.id)}
                className={`flex w-full gap-3 border-b border-surface-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-50 ${selected ? "border-l-4 border-l-orange-500 bg-orange-50/40 pl-2" : "border-l-4 border-l-transparent"}`}
              >
                <PlayerAvatar photoUrl={player.photoUrl} name={player.displayName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <strong className="truncate text-sm font-semibold text-ink-900">{player.displayName}</strong>
                    <span className="shrink-0 text-[0.65rem] font-semibold uppercase text-ink-400">{player.gender === "BOYS" ? "B" : "G"}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">{player.school}</span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    <MetaChip tone="muted">{player.displayAgeBracket}</MetaChip>
                    {rating ? <MetaChip tone="accent">{rating}</MetaChip> : null}
                    {player.position ? <MetaChip>{player.position}</MetaChip> : null}
                  </span>
                </span>
              </button>
            );
          })}
          {!filteredPlayers.length ? (
            <AdminEmptyState
              variant={players.length ? "no-matches" : "no-records"}
              subject="players"
              onClearFilters={players.length && hasActiveFilters ? clearFilters : undefined}
            />
          ) : null}
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        {selectedPlayer ? (
          <AdminPlayerEditPanel key={selectedPlayer.id} player={selectedPlayer} programs={programs} formAction={formAction} state={state} onSaved={() => window.location.reload()} />
        ) : (
          <div className="rounded-lg border border-dashed border-surface-300 bg-white p-12 text-center text-sm text-ink-500">Select a player from the list.</div>
        )}
      </main>
    </div>
  );
}
