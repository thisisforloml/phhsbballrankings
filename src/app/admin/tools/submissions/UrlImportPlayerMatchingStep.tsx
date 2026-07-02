"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { searchPlayersForImport } from "@/app/admin/tools/submissions/url-import-actions";
import { AdminAlert } from "@/components/admin/AdminAlert";
import type { PlayerConfidenceBand, PlayerMatchingPreview,PlayerMatchPreviewRow } from "@/lib/stats-import/types";

export type PlayerMappingDecision = {
  action: "pending" | "mapped_existing" | "create_on_import";
  playerId?: string;
  playerName?: string;
};

type SearchResult = Awaited<ReturnType<typeof searchPlayersForImport>>[number];

function confidenceClassName(band: PlayerConfidenceBand) {
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

function PlayerSearchPicker(props: {
  gender: "BOYS" | "GIRLS";
  teamId?: string | null;
  onSelect: (player: SearchResult) => void;
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
          setResults(await searchPlayersForImport(trimmed, props.gender, props.teamId));
        } catch {
          setResults([]);
        }
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, props.gender, props.teamId]);

  return (
    <div className="grid gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Peach Basket players…"
        className="min-h-9 rounded-md border border-surface-200 px-3 py-2 text-sm text-ink-900"
      />
      {isSearching ? <p className="text-xs text-ink-500">Searching…</p> : null}
      {results.length ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-surface-200">
          {results.map((player) => (
            <li key={player.id} className="border-t border-surface-200 first:border-t-0">
              <button
                type="button"
                onClick={() => props.onSelect(player)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-50"
              >
                <span className="block font-medium text-ink-900">{player.displayName}</span>
                <span className="block text-xs text-ink-500">
                  {[player.currentProgram?.fullName, player.city, player.region].filter(Boolean).join(" · ") || "Program not linked"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function UrlImportPlayerMatchingStep(props: {
  preview: PlayerMatchingPreview;
  gender: "BOYS" | "GIRLS";
  mappingByKey: Record<string, PlayerMappingDecision>;
  onMappingChange: (playerKey: string, decision: PlayerMappingDecision) => void;
  onAcceptExact: () => void;
  onAcceptStrong: () => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const resolvedCount = useMemo(
    () =>
      props.preview.players.filter((row) => {
        const decision = props.mappingByKey[row.playerKey];
        return decision?.action === "mapped_existing" || decision?.action === "create_on_import";
      }).length,
    [props.mappingByKey, props.preview.players]
  );

  const groupedByTeam = useMemo(() => {
    const groups = new Map<string, PlayerMatchPreviewRow[]>();
    for (const row of props.preview.players) {
      const teamName = row.mappedTeamName ?? row.teamLabel;
      const list = groups.get(teamName) ?? [];
      list.push(row);
      groups.set(teamName, list);
    }
    return Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [props.preview.players]);

  return (
    <div className="grid gap-4">
      <AdminAlert variant="info" size="sm" className="rounded-md">
        <p className="font-semibold">Player matching readiness</p>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-500">Auto matched</dt>
            <dd className="font-medium text-ink-900">{props.preview.diagnostics.autoMatched}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Needs review</dt>
            <dd className="font-medium text-ink-900">{props.preview.diagnostics.needsReview}</dd>
          </div>
          <div>
            <dt className="text-ink-500">New players</dt>
            <dd className="font-medium text-ink-900">{props.preview.diagnostics.newPlayers}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Auto-resolution rate</dt>
            <dd className="font-medium text-ink-900">{props.preview.diagnostics.autoResolutionRate}%</dd>
          </div>
          <div>
            <dt className="text-ink-500">Aliases resolved</dt>
            <dd className="font-medium text-ink-900">{props.preview.diagnostics.aliasesResolved}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Provisional team scope</dt>
            <dd className="font-medium text-ink-900">
              {props.preview.diagnostics.provisionalScopedPlayers} players · {props.preview.diagnostics.provisionalScopedTeams} teams
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-sm">
          {props.preview.uniquePlayers} unique roster players · {resolvedCount} of {props.preview.uniquePlayers} resolved
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

      <div className="grid gap-4">
        {groupedByTeam.map(([teamName, rows]) => (
          <section key={teamName} className="overflow-x-auto rounded-md border border-surface-200">
            <header className="border-b border-surface-200 bg-surface-50 px-3 py-2">
              <h3 className="font-medium text-navy-800">{teamName}</h3>
              <p className="text-xs text-ink-500">{rows.length} player{rows.length === 1 ? "" : "s"}</p>
            </header>
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-navy-900 font-mono text-[0.68rem] uppercase text-white">
                <tr>
                  <th className="px-3 py-2">Imported player</th>
                  <th className="px-3 py-2">Games</th>
                  <th className="px-3 py-2">Suggested Peach Basket player</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <PlayerMatchingRow
                    key={row.playerKey}
                    row={row}
                    gender={props.gender}
                    decision={props.mappingByKey[row.playerKey] ?? { action: "pending" }}
                    expanded={expandedKey === row.playerKey}
                    onToggleExpanded={() => setExpandedKey((current) => (current === row.playerKey ? null : row.playerKey))}
                    onMappingChange={(decision) => props.onMappingChange(row.playerKey, decision)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}

function PlayerMatchingRow(props: {
  row: PlayerMatchPreviewRow;
  gender: "BOYS" | "GIRLS";
  decision: PlayerMappingDecision;
  expanded: boolean;
  onToggleExpanded: () => void;
  onMappingChange: (decision: PlayerMappingDecision) => void;
}) {
  const resolvedLabel =
    props.decision.action === "mapped_existing"
      ? props.decision.playerName ?? props.row.suggestedPlayer?.displayName ?? "Mapped"
      : props.decision.action === "create_on_import"
        ? "Create on import"
        : null;

  return (
    <>
      <tr className="border-t border-surface-200 align-top">
        <td className="px-3 py-3">
          <p className="font-medium text-ink-900">{props.row.importedName}</p>
          {props.row.importedName !== props.row.cleanedName ? (
            <p className="mt-1 text-xs text-ink-500">Cleaned: {props.row.cleanedName}</p>
          ) : null}
          {props.row.scopedToTeam ? (
            <p className="mt-1 text-xs text-ink-500">Scoped to mapped team roster</p>
          ) : null}
          {props.row.provisionalScopedToTeam ? (
            <p className="mt-1 text-xs text-amber-800">
              Scoped to suggested team (review needed)
              {props.row.provisionalScopeTeamName ? `: ${props.row.provisionalScopeTeamName}` : ""}
            </p>
          ) : null}
        </td>
        <td className="px-3 py-3">
          <button type="button" onClick={props.onToggleExpanded} className="text-left text-ink-700 underline-offset-2 hover:underline">
            {props.row.gameCount} game{props.row.gameCount === 1 ? "" : "s"}
          </button>
        </td>
        <td className="px-3 py-3 text-ink-900">
          {props.row.suggestedPlayer ? (
            <p>{props.row.suggestedPlayer.displayName}</p>
          ) : (
            <span className="text-ink-500">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${confidenceClassName(props.row.confidenceBand)}`}>
            {props.row.confidenceBand}
          </span>
          <p className="mt-1 font-mono text-[0.65rem] text-ink-500">{props.row.tier} · {props.row.method}</p>
        </td>
        <td className="px-3 py-3">
          <div className="grid gap-2">
            {resolvedLabel ? <p className="text-xs font-semibold text-navy-800">{resolvedLabel}</p> : null}
            {props.row.suggestedPlayer ? (
              <button
                type="button"
                onClick={() =>
                  props.onMappingChange({
                    action: "mapped_existing",
                    playerId: props.row.suggestedPlayer!.playerId,
                    playerName: props.row.suggestedPlayer!.displayName
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
            <PlayerSearchPicker
              gender={props.gender}
              teamId={props.row.mappedTeamId ?? props.row.provisionalScopeTeamId}
              onSelect={(player) =>
                props.onMappingChange({
                  action: "mapped_existing",
                  playerId: player.id,
                  playerName: player.displayName
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
                Candidates: {props.row.candidates.slice(0, 5).map((candidate) => `${candidate.displayName} (${candidate.score})`).join(" · ")}
              </span>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
