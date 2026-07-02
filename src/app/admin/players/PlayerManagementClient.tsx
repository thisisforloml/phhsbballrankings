"use client";

import { Search } from "lucide-react";
import { type ReactNode,useCallback, useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { AdminPlayerEditPanel, type ManagedPlayer,PlayerAvatar } from "@/components/admin/AdminPlayerEditPanel";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";

import { loadAdminPlayerDetail, updatePlayerBio, type UpdatePlayerBioState } from "./actions";

export type { ManagedPlayer };

const initialFormState: UpdatePlayerBioState = { ok: false, message: "" };
const ageBracketOptions = ["All", "U13", "U16", "U19", "Unknown"];
const FILTER_DEFAULTS = {
  search: "",
  program: "All",
  gender: "All",
  ageBracket: "All",
  page: "1",
  player: "",
};

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
  programs,
  schoolOptions,
  filteredCount,
  page,
  totalPages,
  pageSize,
  initialSelectedPlayerId,
}: {
  players: ManagedPlayer[];
  programs: Array<{ id: string; fullName: string }>;
  schoolOptions: string[];
  filteredCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  initialSelectedPlayerId: string;
}) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "program", "gender", "ageBracket", "page", "player"],
    debounceKey: "search",
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    () => initialSelectedPlayerId || players.find((player) => player.id === filters.player)?.id || players[0]?.id || "",
  );
  const [detailPlayer, setDetailPlayer] = useState<ManagedPlayer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [state, formAction] = useFormState(updatePlayerBio, initialFormState);

  const query = filters.search;
  const schoolFilter = filters.program;
  const genderFilter = filters.gender;
  const ageBracketFilter = filters.ageBracket;

  const patchListFilters = useCallback(
    (patch: Partial<typeof FILTER_DEFAULTS>) => {
      const resetsPage = Object.keys(patch).some((key) => key !== "page" && key !== "player");
      patchFilters(resetsPage ? { ...patch, page: "1" } : patch);
    },
    [patchFilters],
  );

  const selectPlayer = useCallback(
    (playerId: string) => {
      setSelectedPlayerId(playerId);
      patchFilters({ player: playerId });
    },
    [patchFilters],
  );

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setDetailPlayer(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void loadAdminPlayerDetail(selectedPlayerId).then((detail) => {
      if (cancelled) return;
      setDetailPlayer(detail);
      setDetailLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedPlayerId]);

  const selectedListPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0] ?? null;
  const panelPlayer = detailPlayer?.id === selectedPlayerId ? detailPlayer : null;
  const hasActiveFilters =
    Boolean(query.trim()) || schoolFilter !== "All" || genderFilter !== "All" || ageBracketFilter !== "All";

  useEffect(() => {
    const urlPlayer = filters.player;
    if (urlPlayer && players.some((player) => player.id === urlPlayer)) {
      setSelectedPlayerId(urlPlayer);
      return;
    }

    if (selectedListPlayer) return;
    if (players[0]) selectPlayer(players[0].id);
  }, [filters.player, players, selectPlayer, selectedListPlayer]);

  const rangeStart = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filteredCount);
  const showPagination = filteredCount > pageSize;

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
              onSearchChange={(value) => patchListFilters({ search: value })}
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
              onSelectChange={(name, value) => patchListFilters({ [name]: value } as Partial<typeof FILTER_DEFAULTS>)}
              onClear={clearFilters}
              showClear={hasActiveFilters}
              resultCount={filteredCount}
              resultLabel="shown"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {players.map((player) => {
              const selected = selectedListPlayer?.id === player.id;
              const rating = displayRating(player.rating);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => selectPlayer(player.id)}
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
            {!players.length ? (
              <AdminEmptyState
                variant={filteredCount || hasActiveFilters ? "no-matches" : "no-records"}
                subject="players"
                onClearFilters={hasActiveFilters ? clearFilters : undefined}
              />
            ) : null}
          </div>

          {showPagination ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-surface-200 bg-white px-3 py-2">
              <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-500">
                {rangeStart}–{rangeEnd} of {filteredCount}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => patchFilters({ page: String(page - 1) })}
                  className="border border-surface-300 px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-700 hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => patchFilters({ page: String(page + 1) })}
                  className="border border-surface-300 px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-700 hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </span>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0">
        {detailLoading && selectedListPlayer ? (
          <div className="rounded-lg border border-surface-200 bg-white p-12 text-center text-sm text-ink-500 shadow-sm">Loading player details…</div>
        ) : panelPlayer ? (
          <AdminPlayerEditPanel key={panelPlayer.id} player={panelPlayer} programs={programs} formAction={formAction} state={state} onSaved={() => window.location.reload()} />
        ) : (
          <div className="rounded-lg border border-dashed border-surface-300 bg-white p-12 text-center text-sm text-ink-500">Select a player from the list.</div>
        )}
      </main>
    </div>
  );
}
