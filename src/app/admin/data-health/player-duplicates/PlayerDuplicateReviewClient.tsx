"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterChipBar } from "@/components/admin/AdminFilterChipBar";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import type { PlayerDuplicateReviewPair } from "@/lib/admin/load-player-duplicate-candidates";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";

const FILTER_DEFAULTS = { search: "", program: "ALL", confidence: "ALL" };
const CONFIDENCE_ITEMS = [
  { key: "ALL", label: "All" },
  { key: "Almost Certain", label: "Almost certain" },
  { key: "Very Likely", label: "Very likely" },
  { key: "Possible", label: "Possible" },
] as const;

function programName(value: PlayerDuplicateReviewPair["left"] | PlayerDuplicateReviewPair["right"]) {
  return value.currentProgramName ?? "Unassigned";
}

function playerSearchText(value: PlayerDuplicateReviewPair["left"] | PlayerDuplicateReviewPair["right"]) {
  return [value.displayName, value.currentProgramName, value.gender].filter(Boolean).join(" ").toLowerCase();
}

function PlayerSummary({ player, label }: {
  player: PlayerDuplicateReviewPair["left"] | PlayerDuplicateReviewPair["right"];
  label: "A" | "B";
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-navy-900">
        <span className="mr-1.5 text-xs text-orange-700">{label}</span>{player.displayName}
      </p>
      <p className="truncate text-xs text-ink-500">
        {programName(player)} / {player.gender} / {player.verifiedGameCount} games
      </p>
    </div>
  );
}

export function PlayerDuplicateReviewClient({ pairs }: { pairs: PlayerDuplicateReviewPair[] }) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "program", "confidence"],
    debounceKey: "search",
  });

  const programOptions = useMemo(
    () => Array.from(new Set(pairs.flatMap((pair) => [programName(pair.left), programName(pair.right)]))).sort(),
    [pairs],
  );
  const confidenceCounts = useMemo(() => Object.fromEntries(
    CONFIDENCE_ITEMS.map((item) => [
      item.key,
      item.key === "ALL" ? pairs.length : pairs.filter((pair) => pair.band === item.key).length,
    ]),
  ), [pairs]);
  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return pairs
      .filter((pair) => filters.confidence === "ALL" || pair.band === filters.confidence)
      .filter((pair) => filters.program === "ALL" || [programName(pair.left), programName(pair.right)].includes(filters.program))
      .filter((pair) => !query || `${playerSearchText(pair.left)} ${playerSearchText(pair.right)}`.includes(query));
  }, [filters, pairs]);
  const hasFilters = Boolean(filters.search.trim()) || filters.program !== "ALL" || filters.confidence !== "ALL";

  return (
    <div className="grid gap-3">
      <section className="border border-surface-200 bg-white p-3 shadow-sm">
        <AdminFilterChipBar
          items={CONFIDENCE_ITEMS.map((item) => ({ ...item, count: confidenceCounts[item.key] ?? 0 }))}
          activeKey={filters.confidence}
          onSelect={(confidence) => patchFilters({ confidence })}
          aria-label="Match certainty filters"
        />
        <AdminFilterRow
          withTopDivider
          searchLabel="Search"
          searchPlaceholder="Player or Program"
          searchValue={filters.search}
          onSearchChange={(search) => patchFilters({ search })}
          selects={[{
            name: "program",
            label: "Program",
            value: filters.program,
            options: [{ value: "ALL", label: "All programs" }, ...programOptions.map((value) => ({ value, label: value }))],
          }]}
          onSelectChange={(name, value) => patchFilters({ [name]: value } as Partial<typeof FILTER_DEFAULTS>)}
          onClear={clearFilters}
          showClear={hasFilters}
          resultCount={filtered.length}
          resultLabel="matches"
        />
      </section>

      <section className="overflow-hidden border border-surface-200 bg-white shadow-sm">
        {filtered.map((pair) => (
          <article key={pair.pairId} className="border-b border-surface-200 p-3 last:border-b-0">
            <div className="grid items-center gap-3 lg:grid-cols-[8rem_minmax(0,1fr)_2rem_minmax(0,1fr)_auto]">
              <div className="flex items-center gap-2">
                <AdminBadge variant={pair.band === "Almost Certain" ? "success" : "warning"} size="sm">
                  {pair.band}
                </AdminBadge>
                <span className="font-mono text-xs text-ink-500">{pair.confidence}%</span>
              </div>
              <PlayerSummary player={pair.left} label="A" />
              <span className="hidden text-center text-xs font-bold text-ink-400 lg:block">/</span>
              <PlayerSummary player={pair.right} label="B" />
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                <Link
                  href={`/admin/data-health/player-duplicates?canonical=${pair.left.playerId}&duplicate=${pair.right.playerId}`}
                  className="button secondary"
                  prefetch={false}
                  title={`Keep ${pair.left.displayName}`}
                >
                  Keep A
                </Link>
                <Link
                  href={`/admin/data-health/player-duplicates?canonical=${pair.right.playerId}&duplicate=${pair.left.playerId}`}
                  className="button secondary"
                  prefetch={false}
                  title={`Keep ${pair.right.displayName}`}
                >
                  Keep B
                </Link>
              </div>
            </div>
            <details className="mt-2 text-xs text-ink-600">
              <summary className="cursor-pointer font-semibold text-navy-700">Evidence</summary>
              <div className="mt-2 grid gap-2 border-l-2 border-surface-200 pl-3 sm:grid-cols-2">
                <p><strong>Matches:</strong> {pair.matchingSignals.join(", ") || "None"}</p>
                <p><strong>Conflicts:</strong> {pair.conflictingSignals.join(", ") || "None"}</p>
              </div>
            </details>
          </article>
        ))}

        {!filtered.length ? (
          <div className="p-4">
            <AdminEmptyState
              variant={pairs.length ? "no-matches" : "no-records"}
              subject="player matches"
              onClearFilters={pairs.length && hasFilters ? clearFilters : undefined}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
