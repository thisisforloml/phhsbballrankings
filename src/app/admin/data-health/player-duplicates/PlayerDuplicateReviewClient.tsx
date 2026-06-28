"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminFilterChipBar } from "@/components/admin/AdminFilterChipBar";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";

export type DuplicatePlayer = {
  playerId: string;
  displayName: string;
  currentProgram: { programId: string; fullName: string; abbreviation: string | null } | null;
  gender: string;
  birthDate: string | null;
  classYear: number | null;
  height: number | null;
  position: string | null;
  gameStatCount: number;
  playerRatingCount: number;
  rankingSnapshotRowCount: number;
};

export type DuplicatePlayerGroup = {
  groupId: string;
  detectionType: string;
  similarityScore?: number;
  classification: "MERGE_SAFE" | "NEEDS_REVIEW" | "KEEP_SEPARATE";
  normalizedName?: string;
  playerIds: string[];
  displayNames: string[];
  players: DuplicatePlayer[];
  recommendedCanonicalPlayer: { playerId: string; displayName: string } | null;
  sourcePlayerToMergeIfSafe: Array<{ playerId: string; displayName: string }>;
  exactAffectedRecordsIfMerged: {
    gameStats: number;
    playerRatings: number;
    rankingSnapshotRows: number;
  };
};

const FILTER_DEFAULTS = { search: "", program: "ALL", classification: "ALL" };

const CLASSIFICATION_CHIP_ITEMS = [
  { key: "ALL", label: "All" },
  { key: "MERGE_SAFE", label: "MERGE_SAFE" },
  { key: "NEEDS_REVIEW", label: "NEEDS_REVIEW" },
  { key: "KEEP_SEPARATE", label: "KEEP_SEPARATE" }
] as const;

function groupSearchText(group: DuplicatePlayerGroup) {
  return [
    group.groupId,
    group.detectionType,
    group.classification,
    group.normalizedName,
    ...group.displayNames,
    ...group.playerIds,
    ...group.players.flatMap((player) => [player.displayName, player.currentProgram?.fullName, player.currentProgram?.abbreviation, player.gender, player.position])
  ].filter(Boolean).join(" ").toLowerCase();
}

function programLabel(player: DuplicatePlayer) {
  if (!player.currentProgram) return "Not set";
  return `${player.currentProgram.fullName}${player.currentProgram.abbreviation ? ` (${player.currentProgram.abbreviation})` : ""}`;
}

function formatHeight(height: number | null) {
  return height === null ? "Not listed" : `${height} cm`;
}

export function PlayerDuplicateReviewClient({ groups }: { groups: DuplicatePlayerGroup[] }) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "program", "classification"],
    debounceKey: "search"
  });

  const query = filters.search;
  const program = filters.program;
  const classification = filters.classification;

  const programOptions = useMemo(() => Array.from(new Set(groups.flatMap((group) => group.players.map((player) => programLabel(player))))).sort(), [groups]);

  const classificationCounts = useMemo(() => ({
    ALL: groups.length,
    MERGE_SAFE: groups.filter((group) => group.classification === "MERGE_SAFE").length,
    NEEDS_REVIEW: groups.filter((group) => group.classification === "NEEDS_REVIEW").length,
    KEEP_SEPARATE: groups.filter((group) => group.classification === "KEEP_SEPARATE").length
  }), [groups]);

  const chipItems = CLASSIFICATION_CHIP_ITEMS.map((item) => ({
    ...item,
    count: classificationCounts[item.key as keyof typeof classificationCounts]
  }));

  const filteredGroups = useMemo(() => {
    const value = query.trim().toLowerCase();
    return groups
      .filter((group) => classification === "ALL" || group.classification === classification)
      .filter((group) => program === "ALL" || group.players.some((player) => programLabel(player) === program))
      .filter((group) => !value || groupSearchText(group).includes(value));
  }, [classification, groups, program, query]);

  const hasActiveFilters = Boolean(query.trim()) || program !== "ALL" || classification !== "ALL";

  return (
    <div className="grid gap-4">
      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <AdminFilterChipBar
          items={chipItems}
          activeKey={classification}
          onSelect={(key) => patchFilters({ classification: key })}
          aria-label="Duplicate classification filters"
        />
        <AdminFilterRow
          withTopDivider
          searchLabel="Search players"
          searchPlaceholder="Player name, id, program"
          searchValue={query}
          onSearchChange={(value) => patchFilters({ search: value })}
          selects={[
            {
              name: "program",
              label: "Program",
              value: program,
              options: [{ value: "ALL", label: "All programs" }, ...programOptions.map((option) => ({ value: option, label: option }))]
            }
          ]}
          onSelectChange={(name, value) => patchFilters({ [name]: value } as Partial<typeof FILTER_DEFAULTS>)}
          onClear={clearFilters}
          showClear={hasActiveFilters}
          resultCount={filteredGroups.length}
          resultLabel="groups shown"
        />
      </section>

      <section className="grid gap-4">
        {filteredGroups.map((group) => (
          <article key={group.groupId} className="overflow-hidden border border-surface-200 bg-white shadow-sm">
            <div className="border-b border-surface-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label">{group.detectionType.replaceAll("_", " ")}</p>
                  <h2 className="mt-2 font-display text-2xl text-navy-800">{group.displayNames.join(" / ")}</h2>
                  <p className="mt-2 text-sm font-semibold text-amber-800">Do not change player records unless identity is verified.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminBadge variant="warning" size="sm" className="text-mono-sm">{group.classification}</AdminBadge>
                  {typeof group.similarityScore === "number" ? <span className="rounded-full bg-surface-100 px-3 py-1 font-mono text-mono-sm uppercase text-ink-600">Similarity {group.similarityScore}</span> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-2 rounded-md bg-surface-100 p-4 text-sm text-ink-700 md:grid-cols-3">
                <span>Suggested canonical: <strong>{group.recommendedCanonicalPlayer?.displayName ?? "None"}</strong></span>
                <span>GameStats affected if repaired: <strong>{group.exactAffectedRecordsIfMerged.gameStats}</strong></span>
                <span>Ranking rows affected if repaired: <strong>{group.exactAffectedRecordsIfMerged.rankingSnapshotRows}</strong></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="bg-surface-100 font-mono text-mono-sm uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Player ID</th>
                    <th className="px-4 py-3">Current Program</th>
                    <th className="px-4 py-3">Gender</th>
                    <th className="px-4 py-3">Birth Date</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Height</th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">GameStats</th>
                    <th className="px-4 py-3">Ratings</th>
                    <th className="px-4 py-3">Snapshot Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {group.players.map((player) => (
                    <tr key={player.playerId} className="border-t border-surface-200">
                      <td className="px-4 py-3 font-semibold text-ink-900">{player.displayName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-600">{player.playerId}</td>
                      <td className="px-4 py-3 text-ink-700">{programLabel(player)}</td>
                      <td className="px-4 py-3 font-mono text-xs uppercase text-ink-600">{player.gender}</td>
                      <td className="px-4 py-3 text-ink-700">{player.birthDate ?? "Not listed"}</td>
                      <td className="px-4 py-3 text-ink-700">{player.classYear ?? "Not listed"}</td>
                      <td className="px-4 py-3 text-ink-700">{formatHeight(player.height)}</td>
                      <td className="px-4 py-3 text-ink-700">{player.position ?? "Not listed"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-700">{player.gameStatCount}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-700">{player.playerRatingCount}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-700">{player.rankingSnapshotRowCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 p-4">
              <Link href={`/admin/players?search=${encodeURIComponent(group.displayNames[0] ?? "")}`} className="text-sm font-semibold text-navy-700 hover:text-navy-900">Open Player Search</Link>
              <button type="button" disabled className="button secondary cursor-not-allowed opacity-60">Repair requires approved plan</button>
            </div>
          </article>
        ))}
        {!filteredGroups.length ? (
          <AdminEmptyState
            variant={groups.length ? "no-matches" : "no-records"}
            subject="duplicate groups"
            onClearFilters={groups.length && hasActiveFilters ? clearFilters : undefined}
          />
        ) : null}
      </section>
    </div>
  );
}
