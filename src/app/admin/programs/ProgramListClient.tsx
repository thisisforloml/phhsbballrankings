"use client";

import type { ProgramType } from "@prisma/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterChipBar } from "@/components/admin/AdminFilterChipBar";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { ProgramRoleBadge } from "@/components/admin/ProgramRoleBadge";
import { buildChildrenByParentId, flattenProgramTreeRows } from "@/lib/admin/program-hierarchy";
import type { ProgramListRow } from "@/lib/admin/program-list-row";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";

export type { ProgramListRow };

const FILTER_DEFAULTS = { search: "", type: "ALL", hierarchy: "ALL" };

const TYPE_CHIP_ITEMS = [
  { key: "ALL", label: "All" },
  { key: "SCHOOL", label: "School" },
  { key: "CLUB", label: "Club" },
  { key: "TEAM", label: "Team" },
  { key: "UNKNOWN", label: "Unknown" },
] as const;

const HIERARCHY_CHIP_ITEMS = [
  { key: "ALL", label: "All" },
  { key: "ROOTS_ONLY", label: "Independent" },
  { key: "HAS_PARENT", label: "In organization" },
  { key: "HAS_CHILDREN", label: "Organizations" },
] as const;

function searchText(program: ProgramListRow) {
  return [program.fullName, program.abbreviation, program.parentProgramFullName, program.type, program.city, program.region]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

function matchesHierarchyFilter(program: ProgramListRow, hierarchy: string) {
  if (hierarchy === "ROOTS_ONLY") return !program.parentProgramId;
  if (hierarchy === "HAS_PARENT") return Boolean(program.parentProgramId);
  if (hierarchy === "HAS_CHILDREN") return program.childProgramCount > 0;
  return true;
}

function ProgramListRowContent({
  program,
  depth = 0,
  hasChildren = false,
  collapsed = false,
  onToggle,
  treeMode = false,
}: {
  program: ProgramListRow;
  depth?: number;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  treeMode?: boolean;
}) {
  return (
  <>
    <span className="min-w-0">
      <span className="flex items-start gap-2">
        {treeMode ? (
          <span className="inline-flex w-5 shrink-0 justify-center pt-0.5">
            {hasChildren ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggle?.();
                }}
                className="rounded border border-surface-200 bg-white p-0.5 text-ink-600 hover:bg-surface-50"
                aria-label={collapsed ? "Expand related programs" : "Collapse related programs"}
              >
                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-5" />
            )}
          </span>
        ) : null}
        <span className="min-w-0" style={treeMode ? { paddingLeft: `${depth * 1.25}rem` } : undefined}>
          <span className="flex flex-wrap items-center gap-2">
            <strong className="text-ink-900">{program.fullName}</strong>
            <ProgramRoleBadge role={program.programRole} />
          </span>
          <small className="mt-1 block text-ink-500">{[program.city, program.region].filter(Boolean).join(", ") || "Location not listed"}</small>
        </span>
      </span>
    </span>
    <span className="hidden font-mono text-sm text-ink-700 lg:block">{program.abbreviation || "-"}</span>
    <span className="hidden text-sm text-ink-600 lg:block">{program.parentProgramFullName || "Independent"}</span>
    <span className="hidden border border-surface-200 bg-surface-50 px-2 py-1 text-center font-mono text-[0.65rem] uppercase text-ink-700 lg:block">{program.type}</span>
    <span className="hidden text-center font-display text-xl text-navy-900 lg:block">{program.teamCount}</span>
    <span className="hidden text-center font-display text-xl text-navy-900 lg:block">{program.derivedPlayerCount}</span>
    <span className="hidden text-center font-display text-xl text-navy-900 lg:block">{program.officialGameCount}</span>
    <AdminBadge variant={programHealthVariant(program)} shape="tag" size="tagSm" className="hidden text-center lg:inline-flex">
      {statusLabel(program)}
    </AdminBadge>
    <span className="text-right font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-orange-700">Open</span>
  </>
  );
}

export function ProgramListClient({ programs }: { programs: ProgramListRow[] }) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "type", "hierarchy"],
    debounceKey: "search",
  });

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const type = filters.type as ProgramType | "ALL";
  const hierarchy = filters.hierarchy;
  const query = filters.search;

  const typeCounts = useMemo(
    () => ({
      ALL: programs.length,
      SCHOOL: programs.filter((program) => program.type === "SCHOOL").length,
      CLUB: programs.filter((program) => program.type === "CLUB").length,
      TEAM: programs.filter((program) => program.type === "TEAM").length,
      UNKNOWN: programs.filter((program) => program.type === "UNKNOWN").length,
    }),
    [programs],
  );

  const hierarchyCounts = useMemo(
    () => ({
      ALL: programs.length,
      ROOTS_ONLY: programs.filter((program) => !program.parentProgramId).length,
      HAS_PARENT: programs.filter((program) => program.parentProgramId).length,
      HAS_CHILDREN: programs.filter((program) => program.childProgramCount > 0).length,
    }),
    [programs],
  );

  const typeChipItems = TYPE_CHIP_ITEMS.map((item) => ({
    ...item,
    count: typeCounts[item.key as keyof typeof typeCounts],
  }));

  const hierarchyChipItems = HIERARCHY_CHIP_ITEMS.map((item) => ({
    ...item,
    count: hierarchyCounts[item.key as keyof typeof hierarchyCounts],
  }));

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return programs
      .filter((program) => type === "ALL" || program.type === type)
      .filter((program) => matchesHierarchyFilter(program, hierarchy))
      .filter((program) => !value || searchText(program).includes(value));
  }, [programs, query, type, hierarchy]);

  const childrenByParentId = useMemo(
    () =>
      buildChildrenByParentId(
        programs.map((program) => ({
          id: program.id,
          fullName: program.fullName,
          abbreviation: program.abbreviation,
          parentProgramId: program.parentProgramId,
          programRole: program.programRole,
          deletedAt: null,
        })),
      ),
    [programs],
  );

  const visibleIds = useMemo(() => new Set(filtered.map((program) => program.id)), [filtered]);
  const forceExpandIds = useMemo(() => (query.trim() ? visibleIds : new Set<string>()), [query, visibleIds]);

  const treeRows = useMemo(
    () =>
      flattenProgramTreeRows(
        programs,
        visibleIds,
        childrenByParentId,
        collapsedIds,
        forceExpandIds,
      ),
    [programs, visibleIds, childrenByParentId, collapsedIds, forceExpandIds],
  );

  const hasActiveFilters = Boolean(query.trim()) || type !== "ALL" || hierarchy !== "ALL";

  const gridClassName =
    "lg:grid-cols-[minmax(20rem,1fr)_6rem_minmax(10rem,0.9fr)_7rem_5rem_6rem_6rem_9rem_6rem]";

  return (
    <div className="grid gap-3">
      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <AdminFilterChipBar
          items={typeChipItems}
          activeKey={type}
          onSelect={(key) => patchFilters({ type: key })}
          aria-label="Program type filters"
        />
        <AdminFilterChipBar
          items={hierarchyChipItems}
          activeKey={hierarchy}
          onSelect={(key) => patchFilters({ hierarchy: key })}
          aria-label="Program organization filters"
          className="mt-2"
        />
        <AdminFilterRow
          withTopDivider
          searchPlaceholder="Program, organization, abbreviation"
          searchValue={query}
          onSearchChange={(value) => patchFilters({ search: value })}
          onClear={clearFilters}
          showClear={hasActiveFilters}
          resultCount={treeRows.length}
        />
      </section>

      <section className="overflow-hidden border border-surface-200 bg-white shadow-sm">
        <div className={`hidden gap-3 border-b border-surface-200 bg-navy-950 px-4 py-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white lg:grid ${gridClassName}`}>
          <span>Organization / Program</span>
          <span>Abbrev.</span>
          <span>Organization</span>
          <span>Type</span>
          <span className="text-center">Teams</span>
          <span className="text-center">Players</span>
          <span className="text-center">Games</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>

        {treeRows.map(({ program, depth, hasChildren }) => (
          <Link
            key={program.id}
            href={`/admin/programs/${program.id}`}
            prefetch={false}
            className={`grid gap-2 border-b border-surface-200 px-4 py-3 transition last:border-b-0 hover:bg-navy-50 lg:items-center ${gridClassName}`}
          >
            <ProgramListRowContent
              program={program}
              depth={depth}
              hasChildren={hasChildren}
              collapsed={collapsedIds.has(program.id)}
              treeMode
              onToggle={() =>
                setCollapsedIds((previous) => {
                  const next = new Set(previous);
                  if (next.has(program.id)) next.delete(program.id);
                  else next.add(program.id);
                  return next;
                })
              }
            />
          </Link>
        ))}
        {!treeRows.length ? (
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
