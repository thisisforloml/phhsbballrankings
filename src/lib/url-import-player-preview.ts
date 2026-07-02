import { PlayerGender } from "@prisma/client";

import { loadPlayerExternalAliasMap } from "@/lib/player-external-alias";
import { prepareImportedPlayerName } from "@/lib/player-import-identity";
import {
  buildMatchQualityAnalytics,
  importedPlayerKey,
  loadPlayerMatchDbContext,
  matchImportedPlayer
} from "@/lib/player-import-matching";
import { canonicalPlayerName,fetchFibaMatchDataResult } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import { isInaccessibleFeedStatus } from "@/lib/stats-import/reconciliation/reconcile-game";
import type { PlayerMatchingPreview, TeamMatchPreviewRow, UrlImportTeamMapping } from "@/lib/stats-import/types";
import { externalTeamAliasKey } from "@/lib/team-import-matching";

function teamLabelFromFibaTeam(team: { shortName?: string; code?: string; name?: string }) {
  const shortName = typeof team.shortName === "string" ? team.shortName.trim() : "";
  const code = typeof team.code === "string" ? team.code.trim() : "";
  const name = typeof team.name === "string" ? team.name.trim() : "";
  return shortName || code || name || "Unknown team";
}

async function extractPlayersFromMatch(matchId: string) {
  const result = await fetchFibaMatchDataResult(matchId);
  if (!result.ok) {
    if (isInaccessibleFeedStatus(result.status)) return [];
    throw new Error(`Request failed (${result.status}) for match ${matchId}.`);
  }

  const data = result.data;
  const rows: Array<{ importedName: string; teamLabel: string }> = [];
  for (const side of ["1", "2"] as const) {
    const team = data.tm?.[side];
    if (!team) continue;
    const teamLabel = teamLabelFromFibaTeam(team);
    for (const player of Object.values(team.pl ?? {})) {
      const rawName = canonicalPlayerName(player);
      if (!rawName || rawName === "Unknown player") continue;
      rows.push({ importedName: rawName, teamLabel });
    }
  }
  return rows;
}

type ProvisionalTeamScope = {
  teamId: string;
  teamName: string;
};

function buildProvisionalTeamScopeMap(teamPreviewRows?: TeamMatchPreviewRow[]) {
  const byAliasKey = new Map<string, ProvisionalTeamScope>();
  const byExternalLabel = new Map<string, ProvisionalTeamScope>();

  for (const row of teamPreviewRows ?? []) {
    if (row.confidenceBand !== "Review Needed" || !row.suggestedTeam) continue;
    const scope = {
      teamId: row.suggestedTeam.teamId,
      teamName: row.suggestedTeam.teamName
    };
    byAliasKey.set(row.aliasKey, scope);
    byExternalLabel.set(row.externalLabel, scope);
  }

  return { byAliasKey, byExternalLabel };
}

export async function buildUrlImportPlayerMatchingPreview(input: {
  matchIds: string[];
  teamMappings: UrlImportTeamMapping[];
  teamPreviewRows?: TeamMatchPreviewRow[];
  gender: PlayerGender;
}): Promise<PlayerMatchingPreview> {
  const matchIds = Array.from(new Set(input.matchIds.map(String).filter(Boolean)));
  if (!matchIds.length) throw new Error("Select at least one game.");

  const teamMappingByLabel = new Map(input.teamMappings.map((mapping) => [mapping.externalLabel, mapping]));
  const teamMappingByAlias = new Map(input.teamMappings.map((mapping) => [mapping.aliasKey, mapping]));
  const provisionalScopes = buildProvisionalTeamScopeMap(input.teamPreviewRows);
  const playerExternalAliases = await loadPlayerExternalAliasMap("statshub-v1");

  const uniqueByKey = new Map<
    string,
    {
      playerKey: string;
      importedName: string;
      cleanedName: string;
      teamLabel: string;
      mappedTeamId: string | null;
      mappedTeamName: string | null;
      scopedTeamId: string | null;
      provisionalScopedToTeam: boolean;
      provisionalScopeTeamId: string | null;
      provisionalScopeTeamName: string | null;
      matchIds: string[];
    }
  >();

  const chunkSize = 5;
  for (let index = 0; index < matchIds.length; index += chunkSize) {
    const chunk = matchIds.slice(index, index + chunkSize);
    const fetched = await Promise.all(
      chunk.map(async (matchId) => ({
        matchId,
        rows: await extractPlayersFromMatch(matchId)
      }))
    );

    for (const item of fetched) {
      for (const row of item.rows) {
        const aliasKey = externalTeamAliasKey(row.teamLabel);
        const teamMapping =
          teamMappingByLabel.get(row.teamLabel) ??
          teamMappingByAlias.get(aliasKey) ??
          input.teamMappings.find((mapping) => mapping.externalLabel === row.teamLabel);

        const cleanedName = prepareImportedPlayerName(row.importedName);
        const playerKey = importedPlayerKey(row.teamLabel, cleanedName);
        const mappedTeamId =
          teamMapping?.action === "mapped_existing" && teamMapping.teamId ? teamMapping.teamId : null;
        const mappedTeamName =
          teamMapping?.action === "mapped_existing"
            ? teamMapping.teamName ?? null
            : teamMapping?.action === "create_on_import"
              ? teamMapping.suggestedTeamName ?? row.teamLabel
              : row.teamLabel;

        const provisionalScope: ProvisionalTeamScope | null =
          mappedTeamId
            ? null
            : provisionalScopes.byAliasKey.get(aliasKey) ??
              provisionalScopes.byExternalLabel.get(row.teamLabel) ??
              null;

        const scopedTeamId = mappedTeamId ?? provisionalScope?.teamId ?? null;
        const provisionalScopedToTeam = Boolean(!mappedTeamId && provisionalScope);
        const provisionalScopeTeamId = provisionalScopedToTeam ? provisionalScope!.teamId : null;
        const provisionalScopeTeamName = provisionalScopedToTeam ? provisionalScope!.teamName : null;

        const existing = uniqueByKey.get(playerKey);
        if (existing) {
          if (!existing.matchIds.includes(item.matchId)) existing.matchIds.push(item.matchId);
          continue;
        }

        uniqueByKey.set(playerKey, {
          playerKey,
          importedName: row.importedName,
          cleanedName,
          teamLabel: row.teamLabel,
          mappedTeamId,
          mappedTeamName,
          scopedTeamId,
          provisionalScopedToTeam,
          provisionalScopeTeamId,
          provisionalScopeTeamName,
          matchIds: [item.matchId]
        });
      }
    }
  }

  const scopedTeamIds = Array.from(
    new Set(
      Array.from(uniqueByKey.values())
        .map((item) => item.scopedTeamId)
        .filter((teamId): teamId is string => Boolean(teamId))
    )
  );

  const db = await loadPlayerMatchDbContext(scopedTeamIds, input.gender);

  const players = Array.from(uniqueByKey.values())
    .map((item) => {
      const savedAlias = playerExternalAliases.get(item.playerKey);
      const result = matchImportedPlayer(
        {
          importedName: item.importedName,
          gender: input.gender,
          scopedTeamId: item.scopedTeamId,
          provisionalScopedToTeam: item.provisionalScopedToTeam,
          savedAliasPlayerId: savedAlias?.playerId ?? null
        },
        db
      );

      return {
        playerKey: item.playerKey,
        importedName: item.importedName,
        cleanedName: item.cleanedName,
        teamLabel: item.teamLabel,
        mappedTeamId: item.mappedTeamId,
        mappedTeamName: item.mappedTeamName,
        provisionalScopedToTeam: item.provisionalScopedToTeam,
        provisionalScopeTeamId: item.provisionalScopeTeamId,
        provisionalScopeTeamName: item.provisionalScopeTeamName,
        gameCount: item.matchIds.length,
        matchIds: item.matchIds,
        confidenceBand: result.confidenceBand,
        score: result.score,
        tier: result.tier,
        method: result.method,
        matchReason: result.matchReason,
        ambiguous: result.ambiguous,
        scopedToTeam: result.scopedToTeam,
        scopedToProgram: result.scopedToProgram,
        promotedByTeamEvidence: result.promotedByTeamEvidence,
        blockedAmbiguity: result.blockedAmbiguity,
        emptyProvisionalRoster: result.emptyProvisionalRoster,
        ambiguityKind: result.ambiguityKind,
        suppressedAutoMatch: result.suppressedAutoMatch,
        candidateOnlySuggestion: result.candidateOnlySuggestion,
        reviewCandidatesShown: result.reviewCandidatesShown,
        reviewCandidatesHidden: result.reviewCandidatesHidden,
        suppressedWeakCandidates: result.suppressedWeakCandidates,
        suppressedWeakCandidateExamples: result.hiddenCandidateSamples,
        suggestedPlayer: result.suggestedPlayer,
        candidates: result.candidates.map((candidate) => ({
          playerId: candidate.playerId,
          displayName: candidate.displayName,
          score: candidate.score,
          tier: candidate.tier,
          method: candidate.method
        }))
      };
    })
    .sort(
      (left, right) =>
        left.mappedTeamName?.localeCompare(right.mappedTeamName ?? "") ||
        left.cleanedName.localeCompare(right.cleanedName)
    );

  const autoMatched = players.filter(
    (player) => player.confidenceBand === "Exact" || player.confidenceBand === "Strong Match"
  ).length;
  const needsReview = players.filter((player) => player.confidenceBand === "Review Needed").length;
  const newPlayers = players.filter((player) => player.confidenceBand === "Unmatched").length;
  const uniquePlayers = players.length;
  const autoResolutionRate = uniquePlayers ? Math.round((autoMatched / uniquePlayers) * 100) : 0;
  const aliasesResolved = players.filter((player) => player.method === "saved_alias").length;
  const provisionalScopedPlayers = players.filter((player) => player.provisionalScopedToTeam).length;
  const provisionalScopedTeams = new Set(
    players.filter((player) => player.provisionalScopeTeamId).map((player) => player.provisionalScopeTeamId)
  ).size;
  const matchQuality = buildMatchQualityAnalytics(
    players.map((player) => ({
      tier: player.tier,
      method: player.method,
      scopedToTeam: player.scopedToTeam,
      scopedToProgram: player.scopedToProgram ?? false,
      ambiguous: player.ambiguous,
      promotedByTeamEvidence: player.promotedByTeamEvidence ?? false,
      confidenceBand: player.confidenceBand,
      emptyProvisionalRoster: player.emptyProvisionalRoster ?? false,
      ambiguityKind: player.ambiguityKind,
      suppressedAutoMatch: player.suppressedAutoMatch,
      candidateOnlySuggestion: player.candidateOnlySuggestion,
      reviewCandidatesShown: player.reviewCandidatesShown,
      reviewCandidatesHidden: player.reviewCandidatesHidden,
      suppressedWeakCandidates: player.suppressedWeakCandidates
    })),
    uniquePlayers
  );

  return {
    gameCount: matchIds.length,
    uniquePlayers,
    diagnostics: {
      uniquePlayers,
      autoMatched,
      needsReview,
      newPlayers,
      autoResolutionRate,
      aliasesResolved,
      newAliasesCreated: 0,
      provisionalScopedPlayers,
      provisionalScopedTeams,
      tierCounts: matchQuality.tierCounts,
      methodCounts: matchQuality.methodCounts,
      scopedMatchRate: matchQuality.scopedMatchRate,
      programScopedMatchRate: matchQuality.programScopedMatchRate,
      promotedByTeamEvidence: matchQuality.promotedByTeamEvidence,
      blockedAmbiguity: matchQuality.blockedAmbiguity,
      emptyProvisionalRoster: matchQuality.emptyProvisionalRoster,
      suppressedAutoMatches: matchQuality.suppressedAutoMatches,
      candidateOnlySuggestions: matchQuality.candidateOnlySuggestions,
      suppressedAutoMatchesByMethod: matchQuality.suppressedAutoMatchesByMethod,
      suppressedWeakCandidates: matchQuality.suppressedWeakCandidates,
      reviewCandidatesShown: matchQuality.reviewCandidatesShown,
      reviewCandidatesHidden: matchQuality.reviewCandidatesHidden,
      ambiguityBreakdown: matchQuality.ambiguityBreakdown
    },
    players
  };
}
