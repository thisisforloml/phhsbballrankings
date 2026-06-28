"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ProgramType } from "@prisma/client";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminFilterChipBar } from "@/components/admin/AdminFilterChipBar";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";

export type ProgramListRow = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  city: string | null;
  region: string | null;
  aliases: string[];
  teamCount: number;
  possibleDuplicateContextGroups: number;
  derivedPlayerCount: number;
  officialGameCount: number;
};

const FILTER_DEFAULTS = { search: "", type: "ALL" };

const TYPE_CHIP_ITEMS = [
  { key: "ALL", label: "All" },
  { key: "SCHOOL", label: "School" },
  { key: "CLUB", label: "Club" },
  { key: "TEAM", label: "Team" },
  { key: "UNKNOWN", label: "Unknown" }
] as const;

function searchText(program: ProgramListRow) {
  return [program.fullName, program.abbreviation, program.type, program.city, program.region, ...program.aliases].filter(Boolean).join(" ").toLowerCase();
}

function statusLabel(program: ProgramListRow) {
  if (program.possibleDuplicateContextGroups > 0) return "Needs review";
  if (program.teamCount >= 9) return "High team count";
  return "Clean";
}

function programHealthVariant(program: ProgramListRow): "warning" | "success" {
  if (program.possibleDuplicateContextGroups > 0 || program.teamCount >= 9) return "warning";
  return "success";
}

export function ProgramListClient({ programs }: { programs: ProgramListRow[] }) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "type"],
    debounceKey: "search"
  });

  const type = filters.type as ProgramType | "ALL";
  const query = filters.search;

  const typeCounts = useMemo(() => ({
    ALL: programs.length,
    SCHOOL: programs.filter((program) => program.type === "SCHOOL").length,
    CLUB: programs.filter((program) => program.type === "CLUB").length,
    TEAM: programs.filter((program) => program.type === "TEAM").length,
    UNKNOWN: programs.filter((program) => program.type === "UNKNOWN").length
  }), [programs]);

  const chipItems = TYPE_CHIP_ITEMS.map((item) => ({
    ...item,
    count: typeCounts[item.key as keyof typeof typeCounts]
  }));

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return programs
      .filter((program) => type === "ALL" || program.type === type)
      .filter((program) => !value || searchText(program).includes(value));
  }, [programs, query, type]);

  const hasActiveFilters = Boolean(query.trim()) || type !== "ALL";

  return (
    <div className="grid gap-3">
      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <AdminFilterChipBar
          items={chipItems}
          activeKey={type}
          onSelect={(key) => patchFilters({ type: key })}
          aria-label="Program type filters"
        />
        <AdminFilterRow
          withTopDivider
          searchPlaceholder="Program, abbreviation, alias"
          searchValue={query}
          onSearchChange={(value) => patchFilters({ search: value })}
          onClear={clearFilters}
          showClear={hasActiveFilters}
          resultCount={filtered.length}
        />
      </section>

      <section className="overflow-hidden border border-surface-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(22rem,1fr)_6rem_7rem_5rem_6rem_6rem_9rem_6rem] gap-3 border-b border-surface-200 bg-navy-950 px-4 py-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white lg:grid">
          <span>Program</span><span>Abbrev.</span><span>Type</span><span className="text-center">Teams</span><span className="text-center">Players</span><span className="text-center">Games</span><span>Status</span><span className="text-right">Action</span>
        </div>
        {filtered.map((program) => (
          <Link key={program.id} href={`/admin/programs/${program.id}`} className="grid gap-2 border-b border-surface-200 px-4 py-3 transition last:border-b-0 hover:bg-navy-50 lg:grid-cols-[minmax(22rem,1fr)_6rem_7rem_5rem_6rem_6rem_9rem_6rem] lg:items-center">
            <span><strong className="block text-ink-900">{program.fullName}</strong>{program.aliases.length ? <small className="text-ink-500">Aliases: {program.aliases.slice(0, 3).join(", ")}</small> : null}<small className="block text-ink-500">{[program.city, program.region].filter(Boolean).join(", ") || "Location not listed"}</small></span>
            <span className="font-mono text-sm text-ink-700">{program.abbreviation || "-"}</span>
            <span className="border border-surface-200 bg-surface-50 px-2 py-1 text-center font-mono text-[0.65rem] uppercase text-ink-700">{program.type}</span>
            <span className="text-center font-display text-xl text-navy-900">{program.teamCount}</span>
            <span className="text-center font-display text-xl text-navy-900">{program.derivedPlayerCount}</span>
            <span className="text-center font-display text-xl text-navy-900">{program.officialGameCount}</span>
            <AdminBadge variant={programHealthVariant(program)} shape="tag" size="tagSm" className="text-center">{statusLabel(program)}</AdminBadge>
            <span className="text-right font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-orange-700">Open</span>
          </Link>
        ))}
        {!filtered.length ? (
          <AdminEmptyState
            variant={programs.length ? "no-matches" : "no-records"}
            subject="programs"
            onClearFilters={programs.length && hasActiveFilters ? clearFilters : undefined}
            className="m-4"
          />
        ) : null}
      </section>
    </div>
  );
}
