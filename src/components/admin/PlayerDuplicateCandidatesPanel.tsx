"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  DuplicateConfidenceBand,
  PlayerDuplicateCandidate,
  PlayerDuplicateCandidateReport,
} from "@/lib/admin/player-duplicate-detection/types";

function bandTone(band: DuplicateConfidenceBand) {
  switch (band) {
    case "Almost Certain":
      return "border-red-200 bg-red-50 text-red-800";
    case "Very Likely":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "Possible":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "Low Confidence":
      return "border-surface-200 bg-surface-100 text-ink-600";
  }
}

function SignalList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "match" | "conflict";
}) {
  if (!items.length) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
        <p className="mt-1 text-sm text-ink-500">None</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
            <span
              className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold ${
                tone === "match" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
              aria-hidden="true"
            >
              {tone === "match" ? "✓" : "✗"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CandidateRow({ candidate, targetPlayerId }: { candidate: PlayerDuplicateCandidate; targetPlayerId: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-lg border border-surface-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-navy-900">{candidate.player.displayName}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase ${bandTone(candidate.band)}`}>
              {candidate.band}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            Confidence <strong>{candidate.confidence}</strong>
            {candidate.player.currentProgramName ? ` · ${candidate.player.currentProgramName}` : ""}
          </p>
          <p className="mt-1 text-sm text-ink-500">{candidate.explanation}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-400">
          {expanded ? "Hide" : "Details"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-surface-200 px-4 py-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Player ID</dt>
              <dd className="mt-1 font-mono text-xs text-ink-800">{candidate.player.playerId}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Gender</dt>
              <dd className="mt-1 text-sm text-ink-800">{candidate.player.gender}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Birthdate</dt>
              <dd className="mt-1 text-sm text-ink-800">{candidate.player.birthDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Height</dt>
              <dd className="mt-1 text-sm text-ink-800">
                {candidate.player.heightCm ? `${candidate.player.heightCm} cm` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Program</dt>
              <dd className="mt-1 text-sm text-ink-800">{candidate.player.currentProgramName ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Organization group</dt>
              <dd className="mt-1 text-sm text-ink-800">{candidate.player.parentGroupName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Verified games</dt>
              <dd className="mt-1 text-sm text-ink-800">{candidate.player.verifiedGameCount}</dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SignalList title="Matching signals" items={candidate.matchingSignals} tone="match" />
            <SignalList title="Conflicting signals" items={candidate.conflictingSignals} tone="conflict" />
          </div>

          <p className="mt-4 text-sm text-ink-600">
            <Link href={`/admin/players?player=${candidate.player.playerId}`} className="font-semibold text-navy-800 hover:underline">
              Open player record
            </Link>
            {" · "}
            Review both records before opening the guarded merge preview.
          </p>
          <Link href={`/admin/data-health/player-duplicates?canonical=${targetPlayerId}&duplicate=${candidate.player.playerId}`} className="mt-2 inline-block text-sm font-semibold text-orange-700 hover:underline" prefetch={false}>Preview guarded merge</Link>
        </div>
      ) : null}
    </article>
  );
}

export function PlayerDuplicateCandidatesPanel({ report }: { report: PlayerDuplicateCandidateReport }) {
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const sortedCandidates = useMemo(() => {
    const rows = [...report.candidates];
    rows.sort((left, right) =>
      sortDirection === "desc"
        ? right.confidence - left.confidence || left.player.displayName.localeCompare(right.player.displayName)
        : left.confidence - right.confidence || left.player.displayName.localeCompare(right.player.displayName),
    );
    return rows;
  }, [report.candidates, sortDirection]);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Duplicate candidates</h3>
            <p className="mt-1 text-sm text-ink-600">
              {report.candidateCount} possible duplicate{report.candidateCount === 1 ? "" : "s"} detected for this player.
            </p>
          </div>
          <label className="grid gap-1 text-sm text-ink-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Sort by confidence</span>
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "desc" | "asc")}
              className="min-h-10 rounded-md border border-surface-300 bg-white px-3 py-2 text-sm"
            >
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-ink-500">
          Diagnostic only. Low-confidence matches remain visible. Future merge workflows can reuse this engine.
        </p>
      </section>

      {sortedCandidates.length === 0 ? (
        <p className="rounded-lg border border-surface-200 bg-white px-4 py-6 text-sm text-ink-600 shadow-sm">
          No duplicate candidates found for this player.
        </p>
      ) : (
        <div className="grid gap-3">
          {sortedCandidates.map((candidate) => (
            <CandidateRow key={candidate.player.playerId} candidate={candidate} targetPlayerId={report.targetPlayerId} />
          ))}
        </div>
      )}
    </div>
  );
}
