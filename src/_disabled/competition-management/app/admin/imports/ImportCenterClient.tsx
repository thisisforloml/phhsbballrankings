"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ImportCenterRow } from "@/lib/admin/load-import-center";

const FILTERS = [
  "ALL",
  "PENDING",
  "NEEDS_REVIEW",
  "DUPLICATES",
  "ALIAS_SUGGESTIONS",
  "FAILED",
  "PUBLISHED",
  "RESOLVED",
] as const;

export function ImportCenterClient({
  rows,
  counts,
}: {
  rows: ImportCenterRow[];
  counts: {
    pending: number;
    needsReview: number;
    duplicates: number;
    aliasSuggestions: number;
    failed: number;
    published: number;
    resolved: number;
    total: number;
  };
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((row) => row.status === filter);
  }, [filter, rows]);

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Pending" value={counts.pending} />
        <CountCard label="Needs review" value={counts.needsReview} />
        <CountCard label="Duplicates" value={counts.duplicates} />
        <CountCard label="Published" value={counts.published} />
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === value ? "bg-navy-900 text-white" : "bg-surface-100 text-ink-700"
            }`}
          >
            {value.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      <section className="overflow-x-auto border border-surface-200 bg-white shadow-sm">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-navy-950 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white">
            <tr>
              <th className="px-4 py-2.5">Import</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Competition</th>
              <th className="px-4 py-2.5 text-center">Duplicates</th>
              <th className="px-4 py-2.5">Submitted</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {filtered.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy-900">{row.title}</p>
                  <p className="text-xs text-ink-500">{row.sourceType}</p>
                </td>
                <td className="px-4 py-3">{row.status.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-ink-700">{row.competitionName ?? row.seasonName ?? "—"}</td>
                <td className="px-4 py-3 text-center">{row.duplicateCount}</td>
                <td className="px-4 py-3 text-ink-600">{row.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  {row.submissionId ? (
                    <Link href={`/admin/submissions/${row.submissionId}`} className="font-semibold text-orange-700">
                      Open
                    </Link>
                  ) : (
                    <span className="text-ink-400">Trace only</span>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  No imports in this bucket.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-ink-500">
        Import records are synced from submissions on load. Review and publish still happen in Game Stats — this center is
        traceability only.
      </p>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-900">{value}</p>
    </article>
  );
}
