"use client";

import { useMemo, useState, useTransition } from "react";
import { AdminAlert } from "@/components/admin/AdminAlert";
import {
  createUrlImportSubmission,
  discoverUrlImport,
  previewUrlImportPlayerMatching,
  previewUrlImportTeamMatching
} from "@/app/admin/tools/submissions/url-import-actions";
import { UrlImportTeamMatchingStep, type TeamMappingDecision } from "@/app/admin/tools/submissions/UrlImportTeamMatchingStep";
import { UrlImportMissingTeamsStep } from "@/app/admin/tools/submissions/UrlImportMissingTeamsStep";
import { UrlImportPlayerMatchingStep, type PlayerMappingDecision } from "@/app/admin/tools/submissions/UrlImportPlayerMatchingStep";
import type {
  ExternalGameIndex,
  PlayerMatchingPreview,
  TeamMatchingPreview,
  UrlImportCreationPlan,
  UrlImportDiscovery,
  UrlImportPlayerMapping,
  UrlImportTeamMapping,
  OrganizationCreationResult
} from "@/lib/stats-import/types";
import { buildImportCreationPlan } from "@/lib/url-import-creation-plan";

const AGE_GROUPS = ["U13", "U16", "U19"] as const;

function defaultSelectedGames(games: ExternalGameIndex[]) {
  const finals = games.filter((game) => game.status === "final" && game.statsAvailable);
  return new Set((finals.length ? finals : games.filter((game) => game.statsAvailable)).map((game) => game.matchId));
}

function buildAutoPlayerMappings(preview: PlayerMatchingPreview): Record<string, PlayerMappingDecision> {
  const mappings: Record<string, PlayerMappingDecision> = {};
  for (const row of preview.players) {
    if ((row.confidenceBand === "Exact" || row.confidenceBand === "Strong Match") && row.suggestedPlayer) {
      mappings[row.playerKey] = {
        action: "mapped_existing",
        playerId: row.suggestedPlayer.playerId,
        playerName: row.suggestedPlayer.displayName
      };
      continue;
    }
    if (row.confidenceBand === "Unmatched") {
      mappings[row.playerKey] = { action: "create_on_import" };
    }
  }
  return mappings;
}

function buildAutoMappings(preview: TeamMatchingPreview): Record<string, { action: "pending" | "mapped_existing" | "create_on_import"; teamId?: string; teamName?: string }> {
  const mappings: Record<string, { action: "pending" | "mapped_existing" | "create_on_import"; teamId?: string; teamName?: string }> = {};
  for (const row of preview.teams) {
    if ((row.confidenceBand === "Exact" || row.confidenceBand === "Strong Match") && row.suggestedTeam) {
      mappings[row.aliasKey] = {
        action: "mapped_existing",
        teamId: row.suggestedTeam.teamId,
        teamName: row.suggestedTeam.teamName
      };
      continue;
    }
    if (row.confidenceBand === "Unmatched") {
      mappings[row.aliasKey] = { action: "create_on_import" };
    }
  }
  return mappings;
}

export function UrlImportClient() {
  const [url, setUrl] = useState("");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [discovery, setDiscovery] = useState<UrlImportDiscovery | null>(null);
  const [teamPreview, setTeamPreview] = useState<TeamMatchingPreview | null>(null);
  const [playerPreview, setPlayerPreview] = useState<PlayerMatchingPreview | null>(null);
  const [mappingByAlias, setMappingByAlias] = useState<Record<string, TeamMappingDecision>>({});
  const [playerMappingByKey, setPlayerMappingByKey] = useState<Record<string, PlayerMappingDecision>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [organizationCreationAudit, setOrganizationCreationAudit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDiscovering, startDiscover] = useTransition();
  const [isPreviewing, startPreview] = useTransition();
  const [isPreviewingPlayers, startPreviewPlayers] = useTransition();
  const [isImporting, startImport] = useTransition();

  const [leagueName, setLeagueName] = useState("");
  const [ageGroup, setAgeGroup] = useState<(typeof AGE_GROUPS)[number]>("U16");
  const [gender, setGender] = useState<"BOYS" | "GIRLS">("BOYS");
  const [seasonName, setSeasonName] = useState("");
  const [seasonYear, setSeasonYear] = useState(String(new Date().getFullYear()));
  const [city, setCity] = useState("Metro Manila");
  const [region, setRegion] = useState("NCR");

  const selectedCount = selected.size;
  const allSelected = discovery ? selectedCount === discovery.games.length : false;

  const sortedGames = useMemo(() => {
    if (!discovery) return [];
    return [...discovery.games].sort((left, right) => {
      const leftDate = left.gameDate ?? "";
      const rightDate = right.gameDate ?? "";
      return leftDate.localeCompare(rightDate) || left.matchId.localeCompare(right.matchId);
    });
  }, [discovery]);

  const allTeamsResolved = useMemo(() => {
    if (!teamPreview) return false;
    return teamPreview.teams.every((row) => {
      const decision = mappingByAlias[row.aliasKey];
      return decision?.action === "mapped_existing" || decision?.action === "create_on_import";
    });
  }, [mappingByAlias, teamPreview]);

  const creationPlan = useMemo<UrlImportCreationPlan | null>(() => {
    if (!teamPreview) return null;
    const mappings: UrlImportTeamMapping[] = [];
    for (const row of teamPreview.teams) {
      const decision = mappingByAlias[row.aliasKey];
      if (!decision || decision.action === "pending") continue;
      if (decision.action === "mapped_existing") {
        mappings.push({
          externalLabel: row.externalLabel,
          scheduleLabel: row.scheduleLabel ?? null,
          aliasKey: row.aliasKey,
          action: "mapped_existing",
          teamId: decision.teamId,
          teamName: decision.teamName
        });
        continue;
      }
      mappings.push({
        externalLabel: row.externalLabel,
        scheduleLabel: row.scheduleLabel ?? null,
        aliasKey: row.aliasKey,
        action: "create_on_import",
        suggestedProgramName: row.creationPreview.suggestedProgramName,
        suggestedTeamName: row.creationPreview.suggestedTeamName,
        suggestedAgeGroup: row.creationPreview.suggestedAgeGroup,
        suggestedGender: row.creationPreview.suggestedGender
      });
    }
    return buildImportCreationPlan({
      mappings,
      teamRows: teamPreview.teams,
      leagueName,
      ageGroup,
      gender
    });
  }, [teamPreview, mappingByAlias, leagueName, ageGroup, gender]);

  const teamsToCreateCount = creationPlan?.summary.teamCount ?? 0;

  const allPlayersResolved = useMemo(() => {
    if (!playerPreview) return false;
    return playerPreview.players.every((row) => {
      const decision = playerMappingByKey[row.playerKey];
      return decision?.action === "mapped_existing" || decision?.action === "create_on_import";
    });
  }, [playerMappingByKey, playerPreview]);

  function applyDiscovery(result: UrlImportDiscovery) {
    setDiscovery(result);
    setTeamPreview(null);
    setPlayerPreview(null);
    setMappingByAlias({});
    setPlayerMappingByKey({});
    setOrganizationCreationAudit("");
    setWizardStep(1);
    setSelected(defaultSelectedGames(result.games));
    setLeagueName(result.competitionTitle ?? "");
    setAgeGroup((AGE_GROUPS.includes(result.inferredAgeGroup as (typeof AGE_GROUPS)[number]) ? result.inferredAgeGroup : "U16") as (typeof AGE_GROUPS)[number]);
    setGender(result.inferredGender);
    setSeasonYear(String(result.inferredSeasonYear));
    setSeasonName("");
  }

  function onContinueFromTeamMatching() {
    if (!allTeamsResolved) return;
    setPlayerPreview(null);
    setPlayerMappingByKey({});
    setWizardStep(teamsToCreateCount > 0 ? 3 : 4);
    if (teamsToCreateCount === 0) onPreviewPlayerMatching();
  }

  function onContinueFromMissingTeams() {
    setPlayerPreview(null);
    setPlayerMappingByKey({});
    setWizardStep(4);
    onPreviewPlayerMatching();
  }

  async function onOrganizationsCreated(result: OrganizationCreationResult) {
    if (result.auditNotes) {
      setOrganizationCreationAudit((previous) => [previous, result.auditNotes].filter(Boolean).join("\n\n"));
    }
    if (!discovery) return;

    const preview = await previewUrlImportTeamMatching({
      matchIds: Array.from(selected),
      scheduleByMatchId: buildScheduleByMatchId(),
      leagueName,
      ageGroup,
      gender,
      competitionId: discovery.competitionId
    });
    setTeamPreview(preview);
    setMappingByAlias(buildAutoMappings(preview));
    setPlayerPreview(null);
    setPlayerMappingByKey({});
  }

  function onPreviewPlayerMatching() {
    if (!discovery) return;
    setError(null);
    startPreviewPlayers(async () => {
      try {
        const preview = await previewUrlImportPlayerMatching({
          matchIds: Array.from(selected),
          teamMappings: buildTeamMappingsPayload(),
          teamPreviewRows: teamPreview?.teams,
          gender
        });
        setPlayerPreview(preview);
        setPlayerMappingByKey(buildAutoPlayerMappings(preview));
        setWizardStep(4);
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Player matching preview failed.");
      }
    });
  }

  function onDiscover() {
    setError(null);
    startDiscover(async () => {
      try {
        const result = await discoverUrlImport(url);
        applyDiscovery(result);
      } catch (discoverError) {
        setDiscovery(null);
        setTeamPreview(null);
        setPlayerPreview(null);
        setMappingByAlias({});
        setPlayerMappingByKey({});
        setWizardStep(1);
        setSelected(new Set());
        setError(discoverError instanceof Error ? discoverError.message : "Discovery failed.");
      }
    });
  }

  function buildScheduleByMatchId() {
    if (!discovery) return {};
    const scheduleByMatchId: Record<string, { homeScheduleLabel?: string; awayScheduleLabel?: string }> = {};
    for (const game of discovery.games) {
      if (!selected.has(game.matchId)) continue;
      scheduleByMatchId[game.matchId] = {
        homeScheduleLabel: game.homeTeamLabel,
        awayScheduleLabel: game.awayTeamLabel
      };
    }
    return scheduleByMatchId;
  }

  function onPreviewTeamMatching() {
    if (!discovery) return;
    setError(null);
    startPreview(async () => {
      try {
        const preview = await previewUrlImportTeamMatching({
          matchIds: Array.from(selected),
          scheduleByMatchId: buildScheduleByMatchId(),
          leagueName,
          ageGroup,
          gender,
          competitionId: discovery.competitionId
        });
        setTeamPreview(preview);
        setMappingByAlias({});
        setWizardStep(2);
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Team matching preview failed.");
      }
    });
  }

  function updateMapping(aliasKey: string, decision: TeamMappingDecision) {
    setMappingByAlias((previous) => ({ ...previous, [aliasKey]: decision }));
    setPlayerPreview(null);
    setPlayerMappingByKey({});
    if (wizardStep > 2) setWizardStep(2);
  }

  function updatePlayerMapping(playerKey: string, decision: PlayerMappingDecision) {
    setPlayerMappingByKey((previous) => ({ ...previous, [playerKey]: decision }));
  }

  function acceptByBand(band: "Exact" | "Strong Match") {
    if (!teamPreview) return;
    setMappingByAlias((previous) => {
      const next = { ...previous };
      for (const row of teamPreview.teams) {
        if (row.confidenceBand !== band || !row.suggestedTeam) continue;
        next[row.aliasKey] = {
          action: "mapped_existing",
          teamId: row.suggestedTeam.teamId,
          teamName: row.suggestedTeam.teamName
        };
      }
      return next;
    });
  }

  function acceptPlayersByBand(band: "Exact" | "Strong Match") {
    if (!playerPreview) return;
    setPlayerMappingByKey((previous) => {
      const next = { ...previous };
      for (const row of playerPreview.players) {
        if (row.confidenceBand !== band || !row.suggestedPlayer) continue;
        next[row.playerKey] = {
          action: "mapped_existing",
          playerId: row.suggestedPlayer.playerId,
          playerName: row.suggestedPlayer.displayName
        };
      }
      return next;
    });
  }

  function buildPlayerMappingsPayload(): UrlImportPlayerMapping[] {
    if (!playerPreview) return [];
    const mappings: UrlImportPlayerMapping[] = [];
    for (const row of playerPreview.players) {
      const decision = playerMappingByKey[row.playerKey];
      if (!decision || decision.action === "pending") continue;
      if (decision.action === "mapped_existing") {
        mappings.push({
          playerKey: row.playerKey,
          importedName: row.importedName,
          cleanedName: row.cleanedName,
          teamLabel: row.teamLabel,
          mappedTeamId: row.mappedTeamId,
          mappedTeamName: row.mappedTeamName,
          action: "mapped_existing",
          playerId: decision.playerId,
          playerName: decision.playerName
        });
        continue;
      }
      mappings.push({
        playerKey: row.playerKey,
        importedName: row.importedName,
        cleanedName: row.cleanedName,
        teamLabel: row.teamLabel,
        mappedTeamId: row.mappedTeamId,
        mappedTeamName: row.mappedTeamName,
        action: "create_on_import"
      });
    }
    return mappings;
  }

  function buildTeamMappingsPayload(): UrlImportTeamMapping[] {
    if (!teamPreview) return [];
    const mappings: UrlImportTeamMapping[] = [];
    for (const row of teamPreview.teams) {
      const decision = mappingByAlias[row.aliasKey];
      if (!decision || decision.action === "pending") continue;
      if (decision.action === "mapped_existing") {
        mappings.push({
          externalLabel: row.externalLabel,
          scheduleLabel: row.scheduleLabel ?? null,
          aliasKey: row.aliasKey,
          action: "mapped_existing",
          teamId: decision.teamId,
          teamName: decision.teamName
        });
        continue;
      }
      mappings.push({
        externalLabel: row.externalLabel,
        scheduleLabel: row.scheduleLabel ?? null,
        aliasKey: row.aliasKey,
        action: "create_on_import",
        suggestedProgramName: row.creationPreview.suggestedProgramName,
        suggestedTeamName: row.creationPreview.suggestedTeamName,
        suggestedAgeGroup: row.creationPreview.suggestedAgeGroup,
        suggestedGender: row.creationPreview.suggestedGender
      });
    }
    return mappings;
  }

  function toggleMatch(matchId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
    setTeamPreview(null);
    setPlayerPreview(null);
    setMappingByAlias({});
    setPlayerMappingByKey({});
    if (wizardStep > 1) setWizardStep(1);
  }

  function toggleAll() {
    if (!discovery) return;
    setSelected(allSelected ? new Set() : new Set(discovery.games.map((game) => game.matchId)));
    setTeamPreview(null);
    setPlayerPreview(null);
    setMappingByAlias({});
    setPlayerMappingByKey({});
    if (wizardStep > 1) setWizardStep(1);
  }

  function onImport() {
    if (!discovery || !teamPreview || !playerPreview) return;
    setError(null);
    const formData = new FormData();
    formData.set("sourceUrl", discovery.sourceUrl);
    if (discovery.competitionId) formData.set("competitionId", discovery.competitionId);
    formData.set("leagueName", leagueName);
    formData.set("ageGroup", ageGroup);
    formData.set("gender", gender);
    formData.set("seasonName", seasonName);
    formData.set("seasonYear", seasonYear);
    formData.set("city", city);
    formData.set("region", region);
    formData.set("teamMappings", JSON.stringify(buildTeamMappingsPayload()));
    formData.set("playerMappings", JSON.stringify(buildPlayerMappingsPayload()));
    if (creationPlan) formData.set("creationPlan", JSON.stringify(creationPlan));
    if (organizationCreationAudit) formData.set("organizationCreationAudit", organizationCreationAudit);

    for (const game of discovery.games) {
      if (!selected.has(game.matchId)) continue;
      formData.append("matchId", game.matchId);
      formData.append("gameNumber", game.gameNumber);
      formData.append("gameSourceUrl", game.sourceUrl);
    }

    startImport(async () => {
      try {
        await createUrlImportSubmission(formData);
      } catch (importError) {
        if (importError instanceof Error && importError.message === "NEXT_REDIRECT") throw importError;
        setError(importError instanceof Error ? importError.message : "Import failed.");
      }
    });
  }

  return (
    <article className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-2xl text-navy-800">Import from URL</h2>
      <p className="mt-1 text-sm text-ink-600">
        Paste a StatsHub tournament page or FIBA LiveStats game link. Games are fetched from Genius Sports public feeds and saved as a draft submission for admin review.
      </p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
          StatsHub or webcast URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.statshubph.info/jcimbl2026-ml"
            className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDiscover} disabled={isDiscovering || !url.trim()} className="button secondary min-h-10 px-4 py-2 text-sm disabled:opacity-60">
            {isDiscovering ? "Discovering…" : "Discover games"}
          </button>
        </div>
      </div>

      {error ? (
        <AdminAlert variant="error" size="sm" className="mt-4 rounded-md">
          {error}
        </AdminAlert>
      ) : null}

      {discovery ? (
        <div className="mt-4 grid gap-4 border-t border-surface-200 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase ${wizardStep === 1 ? "bg-navy-900 text-white" : "bg-surface-100 text-ink-600"}`}>
              Step 1 · Discover
            </span>
            <span className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase ${wizardStep === 2 ? "bg-navy-900 text-white" : "bg-surface-100 text-ink-600"}`}>
              Step 2 · Team matching
            </span>
            <span className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase ${wizardStep === 3 ? "bg-navy-900 text-white" : teamsToCreateCount === 0 ? "bg-surface-50 text-ink-400" : "bg-surface-100 text-ink-600"}`}>
              Step 3 · Missing teams
            </span>
            <span className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase ${wizardStep === 4 ? "bg-navy-900 text-white" : "bg-surface-100 text-ink-600"}`}>
              Step 4 · Player matching
            </span>
            <span className={`rounded-md px-2.5 py-1 font-mono text-[0.68rem] font-bold uppercase ${wizardStep === 5 ? "bg-navy-900 text-white" : "bg-surface-100 text-ink-600"}`}>
              Step 5 · Create draft
            </span>
          </div>

          {wizardStep === 1 ? (
            <>
              {discovery.messages.length ? (
                <AdminAlert variant="info" size="sm" className="rounded-md">
                  {discovery.messages.join(" ")}
                </AdminAlert>
              ) : null}

              {discovery.diagnostics ? (
                <AdminAlert variant="readOnly" size="sm" className="rounded-md font-mono text-xs">
                  <p className="font-semibold normal-case">Schedule diagnostics</p>
                  <p className="mt-1 break-all">URL: {discovery.diagnostics.scheduleUrl}</p>
                  <p className="mt-1">
                    Teams {discovery.diagnostics.matchesWithTeams}/{discovery.diagnostics.discoveredMatches} ·
                    Scores {discovery.diagnostics.matchesWithScores}/{discovery.diagnostics.discoveredMatches} ·
                    Dates {discovery.diagnostics.matchesWithDates}/{discovery.diagnostics.discoveredMatches}
                  </p>
                </AdminAlert>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600 md:col-span-2">
                  League name
                  <input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
                  Age group
                  <select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as (typeof AGE_GROUPS)[number])} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900">
                    {AGE_GROUPS.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
                  Gender
                  <select value={gender} onChange={(event) => setGender(event.target.value as "BOYS" | "GIRLS")} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900">
                    <option value="BOYS">Boys</option>
                    <option value="GIRLS">Girls</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
                  Season name
                  <input value={seasonName} onChange={(event) => setSeasonName(event.target.value)} placeholder="Season 2026" className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
                  Season year
                  <input value={seasonYear} onChange={(event) => setSeasonYear(event.target.value)} inputMode="numeric" className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
                  City
                  <input value={city} onChange={(event) => setCity(event.target.value)} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
                  Region
                  <input value={region} onChange={(event) => setRegion(event.target.value)} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink-600">
                  {selectedCount} of {discovery.games.length} games selected
                  {discovery.competitionId ? ` · Competition ${discovery.competitionId}` : null}
                </p>
                <button type="button" onClick={toggleAll} className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-orange-700 hover:text-orange-800">
                  {allSelected ? "Clear selection" : "Select all"}
                </button>
              </div>

              <div className="overflow-x-auto rounded-md border border-surface-200">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="bg-navy-900 font-mono text-[0.68rem] uppercase text-white">
                    <tr>
                      <th className="w-12 px-3 py-2 text-center">Import</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Matchup</th>
                      <th className="px-3 py-2 text-center">Score</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Match ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGames.map((game) => (
                      <tr key={game.matchId} className="border-t border-surface-200">
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(game.matchId)}
                            onChange={() => toggleMatch(game.matchId)}
                            aria-label={`Import match ${game.matchId}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-ink-700">{game.gameDate ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-900">{game.homeTeamLabel} vs {game.awayTeamLabel}</td>
                        <td className="px-3 py-2 text-center font-mono text-ink-700">
                          {game.homeScore !== null && game.awayScore !== null ? `${game.homeScore}-${game.awayScore}` : "—"}
                        </td>
                        <td className="px-3 py-2 capitalize text-ink-600">{game.status}</td>
                        <td className="px-3 py-2 font-mono text-xs text-ink-500">{game.matchId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onPreviewTeamMatching}
                  disabled={isPreviewing || !selectedCount || !leagueName.trim()}
                  className="button primary min-h-10 px-4 py-2 text-sm disabled:opacity-60"
                >
                  {isPreviewing ? "Matching teams…" : `Preview team matching (${selectedCount})`}
                </button>
              </div>
            </>
          ) : null}

          {wizardStep === 2 && teamPreview ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setWizardStep(1)} className="button secondary min-h-10 px-4 py-2 text-sm">
                  Back to game selection
                </button>
              </div>

              <UrlImportTeamMatchingStep
                preview={teamPreview}
                mappingByAlias={mappingByAlias}
                onMappingChange={updateMapping}
                onAcceptExact={() => acceptByBand("Exact")}
                onAcceptStrong={() => acceptByBand("Strong Match")}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onContinueFromTeamMatching}
                  disabled={!allTeamsResolved}
                  className="button primary min-h-10 px-4 py-2 text-sm disabled:opacity-60"
                >
                  {teamsToCreateCount > 0
                    ? `Review missing teams (${teamsToCreateCount})`
                    : isPreviewingPlayers
                      ? "Loading player matching…"
                      : "Continue to player matching"}
                </button>
              </div>
            </>
          ) : null}

          {wizardStep === 3 && teamPreview && creationPlan ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setWizardStep(2)} className="button secondary min-h-10 px-4 py-2 text-sm">
                  Back to team matching
                </button>
              </div>

              <UrlImportMissingTeamsStep
                plan={creationPlan}
                city={city}
                region={region}
                onOrganizationsCreated={onOrganizationsCreated}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onContinueFromMissingTeams}
                  disabled={isPreviewingPlayers}
                  className="button primary min-h-10 px-4 py-2 text-sm disabled:opacity-60"
                >
                  {isPreviewingPlayers ? "Loading player matching…" : "Continue to player matching"}
                </button>
              </div>
            </>
          ) : null}

          {wizardStep === 4 && isPreviewingPlayers && !playerPreview ? (
            <AdminAlert variant="info" size="sm" className="rounded-md">
              Loading player rosters and matching against Peach Basket…
            </AdminAlert>
          ) : null}

          {wizardStep === 4 && playerPreview ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(teamsToCreateCount > 0 ? 3 : 2)}
                  className="button secondary min-h-10 px-4 py-2 text-sm"
                >
                  {teamsToCreateCount > 0 ? "Back to missing teams" : "Back to team matching"}
                </button>
              </div>

              <UrlImportPlayerMatchingStep
                preview={playerPreview}
                gender={gender}
                mappingByKey={playerMappingByKey}
                onMappingChange={updatePlayerMapping}
                onAcceptExact={() => acceptPlayersByBand("Exact")}
                onAcceptStrong={() => acceptPlayersByBand("Strong Match")}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWizardStep(5)}
                  disabled={!allPlayersResolved}
                  className="button primary min-h-10 px-4 py-2 text-sm disabled:opacity-60"
                >
                  Continue to create draft
                </button>
              </div>
            </>
          ) : null}

          {wizardStep === 5 && teamPreview && playerPreview ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setWizardStep(4)} className="button secondary min-h-10 px-4 py-2 text-sm">
                  Back to player matching
                </button>
              </div>

              <AdminAlert variant="info" size="sm" className="rounded-md">
                <p className="font-semibold">Ready to create draft</p>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-500">Games selected</dt>
                    <dd className="font-medium text-ink-900">{selectedCount}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Teams mapped to existing</dt>
                    <dd className="font-medium text-ink-900">{teamPreview.teams.length - teamsToCreateCount}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Players auto matched</dt>
                    <dd className="font-medium text-ink-900">{playerPreview.diagnostics.autoMatched}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">New players</dt>
                    <dd className="font-medium text-ink-900">
                      {Object.values(playerMappingByKey).filter((decision) => decision.action === "create_on_import").length}
                    </dd>
                  </div>
                  {teamsToCreateCount > 0 ? (
                    <>
                      <div>
                        <dt className="text-ink-500">Programs to create</dt>
                        <dd className="font-medium text-ink-900">{creationPlan?.summary.programCount ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-500">Teams to create</dt>
                        <dd className="font-medium text-ink-900">{teamsToCreateCount}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
                <p className="mt-2 text-sm text-ink-600">
                  The draft will include team, player, and missing-organization notes for review. No Program, Team, or Player records are created until approved import.
                </p>
              </AdminAlert>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onImport}
                  disabled={isImporting || !allTeamsResolved || !allPlayersResolved}
                  className="button primary min-h-10 px-4 py-2 text-sm disabled:opacity-60"
                >
                  {isImporting ? "Creating draft…" : `Create draft submission (${selectedCount})`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
