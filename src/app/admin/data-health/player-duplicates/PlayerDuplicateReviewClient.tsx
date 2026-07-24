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
  { key: "Low Confidence", label: "Low confidence" },
] as const;

function programName(value: PlayerDuplicateReviewPair["left"] | PlayerDuplicateReviewPair["right"]) {
  return value.currentProgramName ?? "Unassigned";
}

function playerSearchText(value: PlayerDuplicateReviewPair["left"] | PlayerDuplicateReviewPair["right"]) {
  return [value.playerId, value.displayName, value.currentProgramName, value.parentGroupName, value.gender]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function PlayerCell({ player, label }: {
  player: PlayerDuplicateReviewPair["left"] | PlayerDuplicateReviewPair["right"];
  label: string;
}) {
  return (
    <div className="min-w-0 border border-surface-200 bg-surface-50 p-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-navy-900">{player.displayName}</p>
      <p className="mt-0.5 truncate text-sm text-ink-600">{programName(player)}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-600">
        <div><dt className="inline text-ink-400">Birth: </dt><dd className="inline">{player.birthDate ?? "-"}</dd></div>
        <div><dt className="inline text-ink-400">Height: </dt><dd className="inline">{player.heightCm ? `${player.heightCm} cm` : "-"}</dd></div>
        <div><dt className="inline text-ink-400">Games: </dt><dd className="inline">{player.verifiedGameCount}</dd></div>
        <div><dt className="inline text-ink-400">Gender: </dt><dd className="inline">{player.gender}</dd></div>
      </dl>
      <Link href={`/admin/players?player=${player.playerId}`} className="mt-2 inline-block text-xs font-semibold text-navy-700 hover:underline">
        Open record
      </Link>
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
  const chipItems = CONFIDENCE_ITEMS.map((item) => ({
    ...item,
    count: confidenceCounts[item.key] ?? 0,
  }));

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return pairs
      .filter((pair) => filters.confidence === "ALL" || pair.band === filters.confidence)
      .filter((pair) => filters.program === "ALL" || [programName(pair.left), programName(pair.right)].includes(filters.program))
      .filter((pair) => !query || `${playerSearchText(pair.left)} ${playerSearchText(pair.right)}`.includes(query));
  }, [filters, pairs]);
  const hasFilters = Boolean(filters.search.trim()) || filters.program !== "ALL" || filters.confidence !== "ALL";

  return (
    <div className="grid gap-4">
      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <AdminFilterChipBar
          items={chipItems}
          activeKey={filters.confidence}
          onSelect={(confidence) => patchFilters({ confidence })}
          aria-label="Duplicate confidence filters"
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
          resultLabel="pairs shown"
        />
      </section>

      <section className="grid gap-3">
        {filtered.map((pair) => (
          <article key={pair.pairId} className="border border-surface-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <AdminBadge variant={pair.band === "Low Confidence" ? "readOnly" : "warning"} size="sm">{pair.band}</AdminBadge>
                <span className="font-mono text-xs text-ink-600">{pair.confidence}% confidence</span>
              </div>
              <p className="text-xs text-ink-500">Review the records, then choose which identity to keep.</p>
            </div>

            <div className="grid gap-3 p-4 lg:grid-cols-2">
              <PlayerCell player={pair.left} label="Player A" />
              <PlayerCell player={pair.right} label="Player B" />
            </div>

            <div className="grid gap-3 border-t border-surface-200 px-4 py-3 text-sm lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Matching evidence</p>
                <p className="mt-1 text-ink-600">{pair.matchingSignals.join("; ") || "No strong matching evidence."}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Conflicts</p>
                <p className="mt-1 text-ink-600">{pair.conflictingSignals.join("; ") || "No detected conflicts."}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-surface-200 bg-surface-50 px-4 py-3">
              <Link
                href={`/admin/data-health/player-duplicates?canonical=${pair.left.playerId}&duplicate=${pair.right.playerId}`}
                className="button secondary"
                prefetch={false}
              >
                Keep {pair.left.displayName}
              </Link>
              <Link
                href={`/admin/data-health/player-duplicates?canonical=${pair.right.playerId}&duplicate=${pair.left.playerId}`}
                className="button secondary"
                prefetch={false}
              >
                Keep {pair.right.displayName}
              </Link>
            </div>
          </article>
        ))}

        {!filtered.length ? (
          <AdminEmptyState
            variant={pairs.length ? "no-matches" : "no-records"}
            subject="duplicate candidates"
            onClearFilters={pairs.length && hasFilters ? clearFilters : undefined}
          />
        ) : null}
      </section>
    </div>
  );
}
