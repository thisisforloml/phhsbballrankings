"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProgramType } from "@prisma/client";

export type ProgramListRow = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  city: string | null;
  region: string | null;
  aliases: string[];
  linkedTeamCount: number;
  activeTeamCount: number;
  legacyTeamCount: number;
  possibleDuplicateContextGroups: number;
  derivedPlayerCount: number;
  officialGameCount: number;
};

function searchText(program: ProgramListRow) {
  return [program.fullName, program.abbreviation, program.type, program.city, program.region, ...program.aliases].filter(Boolean).join(" ").toLowerCase();
}

function statusLabel(program: ProgramListRow) {
  if (program.possibleDuplicateContextGroups > 0) return "Needs review";
  if (program.linkedTeamCount >= 9) return "High team count";
  return "Clean";
}

function statusClass(program: ProgramListRow) {
  if (program.possibleDuplicateContextGroups > 0 || program.linkedTeamCount >= 9) return "bg-amber-50 text-amber-800";
  return "bg-green-50 text-green-800";
}

export function ProgramListClient({ programs }: { programs: ProgramListRow[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ProgramType | "ALL">("ALL");

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return programs
      .filter((program) => type === "ALL" || program.type === type)
      .filter((program) => !value || searchText(program).includes(value));
  }, [programs, query, type]);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
          <label className="grid gap-2 text-sm font-semibold text-ink-700">
            Search programs
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Full name, abbreviation, alias" className="rounded-md border border-surface-300 px-3 py-3" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink-700">
            Type
            <select value={type} onChange={(event) => setType(event.target.value as ProgramType | "ALL")} className="rounded-md border border-surface-300 px-3 py-3">
              <option value="ALL">All</option>
              <option value="SCHOOL">School</option>
              <option value="CLUB">Club</option>
              <option value="TEAM">Team</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.5fr_8rem_8rem_8rem_8rem_7rem_7rem_9rem] gap-3 border-b border-surface-200 px-4 py-3 font-mono text-mono-sm uppercase text-ink-500 lg:grid">
          <span>Program</span><span>Abbrev.</span><span>Type</span><span>Active</span><span>Legacy</span><span>Players</span><span>Games</span><span>Status</span>
        </div>
        {filtered.map((program) => (
          <Link key={program.id} href={`/admin/programs/${program.id}`} className="grid gap-2 border-b border-surface-200 px-4 py-4 transition last:border-b-0 hover:bg-navy-50 lg:grid-cols-[1.5fr_8rem_8rem_8rem_8rem_7rem_7rem_9rem] lg:items-center">
            <span><strong className="block text-ink-900">{program.fullName}</strong>{program.aliases.length ? <small className="text-ink-500">Aliases: {program.aliases.slice(0, 3).join(", ")}</small> : null}<small className="block text-ink-500">{[program.city, program.region].filter(Boolean).join(", ") || "Location not listed"}</small></span>
            <span className="font-mono text-sm text-ink-700">{program.abbreviation || "-"}</span>
            <span className="rounded-full bg-surface-100 px-3 py-1 text-center font-mono text-[0.65rem] uppercase text-ink-700">{program.type}</span>
            <span className="font-display text-stat-sm text-navy-800">{program.activeTeamCount}</span>
            <span className="font-display text-stat-sm text-ink-600">{program.legacyTeamCount}</span>
            <span className="font-display text-stat-sm text-navy-800">{program.derivedPlayerCount}</span>
            <span className="font-display text-stat-sm text-navy-800">{program.officialGameCount}</span>
            <span className={`rounded-full px-3 py-1 text-center font-mono text-[0.65rem] uppercase ${statusClass(program)}`}>{statusLabel(program)}</span>
          </Link>
        ))}
        {!filtered.length ? <p className="p-5 text-sm text-ink-600">No programs match these filters.</p> : null}
      </section>
    </div>
  );
}
