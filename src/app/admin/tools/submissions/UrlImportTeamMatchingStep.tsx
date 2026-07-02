"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { searchTeamsForImport } from "@/app/admin/tools/submissions/url-import-actions";
import { AdminAlert } from "@/components/admin/AdminAlert";
import type { TeamConfidenceBand, TeamMatchingPreview,TeamMatchPreviewRow } from "@/lib/stats-import/types";

function formatAgeGroupDisplay(ageGroup: string) {
  const normalized = ageGroup.trim().toUpperCase();
  return normalized.startsWith("U") ? normalized : `U${normalized}`;
}

function formatGenderDisplay(gender: "BOYS" | "GIRLS") {
  return gender === "GIRLS" ? "Girls" : "Boys";
}

export type TeamMappingDecision = {
  action: "pending" | "mapped_existing" | "create_on_import";
  teamId?: string;
  teamName?: string;
};

type SearchResult = Awaited<ReturnType<typeof searchTeamsForImport>>[number];

function confidenceClassName(band: TeamConfidenceBand) {
  switch (band) {
    case "Exact":
      return "border-green-200 bg-green-50 text-green-800";
    case "Strong Match":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "Review Needed":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-red-200 bg-red-50 text-red-800";
  }
}

function TeamSearchPicker(props: {
  onSelect: (team: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, startSearch] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      startSearch(async () => {
        try {
          setResults(await searchTeamsForImport(trimmed));
        } catch {
          setResults([]);
        }
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="grid gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Peach Basket teams…"
        className="min-h-9 rounded-md border border-surface-200 px-3 py-2 text-sm text-ink-900"
      />
      {isSearching ? <p className="text-xs text-ink-500">Searching…</p> : null}
      {results.length ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-surface-200">
          {results.map((team) => (
            <li key={team.id} className="border-t border-surface-200 first:border-t-0">
              <button
                type="button"
                onClick={() => props.onSelect(team)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-50"
              >
                <span className="block font-medium text-ink-900">{team.name}</span>
                <span className="block text-xs text-ink-500">
                  {[team.program?.fullName, team.city, team.region].filter(Boolean).join(" · ") || "Program not linked"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function UrlImportTeamMatchingStep(props: {
  preview: TeamMatchingPreview;
  mappingByAlias: Record<string, TeamMappingDecision>;
  onMappingChange: (aliasKey: string, decision: TeamMappingDecision) => void;
  onAcceptExact: () => void;
  onAcceptStrong: () => void;
}) {
  const [expandedAlias, setExpandedAlias] = useState<string | null>(null);
  const resolvedCount = useMemo(
    () =>
      props.preview.teams.filter((row) => {
        const decision = props.mappingByAlias[row.aliasKey];
        return decision?.action === "mapped_existing" || decision?.action === "create_on_import";
      }).length,
    [props.mappingByAlias, props.preview.teams]
  );

  return (
    <div className="grid gap-4">
      <AdminAlert variant="info" size="sm" className="rounded-md">
        <p className="font-semibold">Import readiness</p>
        <p className="mt-1 text-sm">
          {props.preview.gameCount} games · {props.preview.uniqueTeams} unique teams · {resolvedCount} of {props.preview.uniqueTeams} resolved
        </p>
        <p className="mt-1 text-sm">
          Auto matched: {props.preview.readiness.autoResolved ?? props.preview.readiness.autoMatched ?? 0} · Needs review: {props.preview.readiness.needsReview ?? 0} · Unmatched: {props.preview.readiness.unmatched}
        </p>
      </AdminAlert>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={props.onAcceptExact} className="button secondary min-h-9 px-3 py-1.5 text-sm">
          Accept all Exact
        </button>
        <button type="button" onClick={props.onAcceptStrong} className="button secondary min-h-9 px-3 py-1.5 text-sm">
          Accept all Strong Match
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-surface-200">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-navy-900 font-mono text-[0.68rem] uppercase text-white">
            <tr>
              <th className="px-3 py-2">External team</th>
              <th className="px-3 py-2">Games</th>
              <th className="px-3 py-2">Suggested Peach Basket team</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {props.preview.teams.map((row) => (
              <TeamMatchingRow
                key={row.aliasKey}
                row={row}
                decision={props.mappingByAlias[row.aliasKey] ?? { action: "pending" }}
                expanded={expandedAlias === row.aliasKey}
                onToggleExpanded={() => setExpandedAlias((current) => (current === row.aliasKey ? null : row.aliasKey))}
                onMappingChange={(decision) => props.onMappingChange(row.aliasKey, decision)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {props.preview.debugRows?.length ? (
        <AdminAlert variant="readOnly" size="sm" className="rounded-md font-mono text-xs">
          <p className="font-semibold normal-case">Matching diagnostics (development)</p>
          <ul className="mt-2 grid gap-2">
            {props.preview.debugRows.map((row) => (
              <li key={`${row.externalLabel}-${row.matchingInput}`} className="border-t border-surface-200 pt-2 first:border-t-0 first:pt-0">
                <p>external: {row.externalLabel}</p>
                <p>schedule: {row.scheduleLabel ?? "—"}</p>
                <p>matchingInput: {row.matchingInput}</p>
                <p>confidence: {row.confidenceBand}</p>
                <p>suggested: {row.suggestedTeam ?? "—"}</p>
              </li>
            ))}
          </ul>
        </AdminAlert>
      ) : null}
    </div>
  );
}

function TeamMatchingRow(props: {
  row: TeamMatchPreviewRow;
  decision: TeamMappingDecision;
  expanded: boolean;
  onToggleExpanded: () => void;
  onMappingChange: (decision: TeamMappingDecision) => void;
}) {
  const resolvedLabel =
    props.decision.action === "mapped_existing"
      ? props.decision.teamName ?? props.row.suggestedTeam?.teamName ?? "Mapped"
      : props.decision.action === "create_on_import"
        ? props.row.creationPreview.suggestedTeamName
        : null;

  const showCreationPreview = props.decision.action === "create_on_import";

  return (
    <>
      <tr className="border-t border-surface-200 align-top">
        <td className="px-3 py-3">
          <p className="font-medium text-ink-900">{props.row.externalLabel}</p>
          {props.row.scheduleLabel && props.row.scheduleLabel !== props.row.externalLabel ? (
            <p className="mt-1 text-xs text-ink-500">Schedule label: {props.row.scheduleLabel}</p>
          ) : null}
          <p className="mt-1 text-xs text-ink-500">Program: {props.row.inferredProgramName}</p>
        </td>
        <td className="px-3 py-3">
          <button type="button" onClick={props.onToggleExpanded} className="text-left text-ink-700 underline-offset-2 hover:underline">
            {props.row.gameCount} game{props.row.gameCount === 1 ? "" : "s"}
          </button>
        </td>
        <td className="px-3 py-3 text-ink-900">
          {props.row.suggestedTeam ? (
            <>
              <p>{props.row.suggestedTeam.teamName}</p>
              {props.row.inferredProgramName && props.row.inferredProgramName !== props.row.suggestedTeam.teamName ? (
                <p className="text-xs text-ink-500">Program: {props.row.inferredProgramName}</p>
              ) : props.row.suggestedTeam.programName ? (
                <p className="text-xs text-ink-500">{props.row.suggestedTeam.programName}</p>
              ) : null}
            </>
          ) : props.row.inferredProgramName ? (
            <p className="text-sm text-ink-700">{props.row.inferredProgramName}</p>
          ) : (
            <span className="text-ink-500">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${confidenceClassName(props.row.confidenceBand)}`}>
            {props.row.confidenceBand}
          </span>
          <p className="mt-1 font-mono text-[0.65rem] text-ink-500">
            {props.row.tier} · {props.row.matchReason ?? props.row.method}
          </p>
        </td>
        <td className="px-3 py-3">
          <div className="grid gap-2">
            {resolvedLabel ? <p className="text-xs font-semibold text-navy-800">{resolvedLabel}</p> : null}
            {showCreationPreview ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-2 text-xs text-blue-950">
                <p className="font-semibold uppercase tracking-[0.08em] text-blue-800">Creation preview</p>
                <dl className="mt-1 grid gap-1">
                  <div>
                    <dt className="text-blue-700">Suggested program</dt>
                    <dd className="font-medium">{props.row.creationPreview.suggestedProgramName}</dd>
                  </div>
                  <div>
                    <dt className="text-blue-700">Suggested team</dt>
                    <dd className="font-medium">{props.row.creationPreview.suggestedTeamName}</dd>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <dt className="text-blue-700">Age group</dt>
                      <dd className="font-medium">{formatAgeGroupDisplay(props.row.creationPreview.suggestedAgeGroup)}</dd>
                    </div>
                    <div>
                      <dt className="text-blue-700">Gender</dt>
                      <dd className="font-medium">{formatGenderDisplay(props.row.creationPreview.suggestedGender)}</dd>
                    </div>
                  </div>
                </dl>
              </div>
            ) : null}
            {props.row.suggestedTeam ? (
              <button
                type="button"
                onClick={() =>
                  props.onMappingChange({
                    action: "mapped_existing",
                    teamId: props.row.suggestedTeam!.teamId,
                    teamName: props.row.suggestedTeam!.teamName
                  })
                }
                className="button secondary min-h-8 px-2 py-1 text-xs"
              >
                Use suggested
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => props.onMappingChange({ action: "create_on_import" })}
              className="button secondary min-h-8 px-2 py-1 text-xs"
            >
              Create on import
            </button>
            <TeamSearchPicker
              onSelect={(team) =>
                props.onMappingChange({
                  action: "mapped_existing",
                  teamId: team.id,
                  teamName: team.name
                })
              }
            />
          </div>
        </td>
      </tr>
      {props.expanded ? (
        <tr className="border-t border-surface-100 bg-surface-50">
          <td colSpan={5} className="px-3 py-2 text-xs text-ink-600">
            Match IDs: {props.row.matchIds.join(", ")}
            {props.row.candidates.length ? (
              <span className="mt-1 block">
                Candidates: {props.row.candidates.slice(0, 5).map((candidate) => `${candidate.teamName} (${candidate.score})`).join(" · ")}
              </span>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
