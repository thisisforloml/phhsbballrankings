import type { PlayerConfidenceBand } from "@/lib/stats-import/types";
import { baseMatchMethod } from "@/lib/player-import-matching/auto-match-policy";

export type AmbiguityKind = "same_team" | "same_program" | "different_program";

export type PlayerMatchAnalyticsRow = {
  tier: string;
  method: string;
  scopedToTeam: boolean;
  scopedToProgram: boolean;
  ambiguous: boolean;
  promotedByTeamEvidence: boolean;
  confidenceBand: PlayerConfidenceBand;
  emptyProvisionalRoster: boolean;
  ambiguityKind?: AmbiguityKind | null;
  suppressedAutoMatch?: boolean;
  candidateOnlySuggestion?: boolean;
  reviewCandidatesShown?: number;
  reviewCandidatesHidden?: number;
  suppressedWeakCandidates?: number;
};

export function buildMatchQualityAnalytics(players: PlayerMatchAnalyticsRow[], uniquePlayers: number) {
  const tierCounts: Record<string, number> = {};
  const methodCounts: Record<string, number> = {};
  let promotedByTeamEvidence = 0;
  let blockedAmbiguity = 0;
  let scopedPlayers = 0;
  let scopedAutoMatched = 0;
  let programScopedPlayers = 0;
  let programScopedAutoMatched = 0;
  let emptyProvisionalRoster = 0;
  let suppressedAutoMatches = 0;
  let candidateOnlySuggestions = 0;
  let suppressedWeakCandidates = 0;
  let reviewCandidatesShown = 0;
  let reviewCandidatesHidden = 0;
  const suppressedAutoMatchesByMethod: Record<string, number> = {};
  const ambiguityBreakdown = {
    sameTeam: 0,
    sameProgram: 0,
    differentProgram: 0
  };

  for (const player of players) {
    tierCounts[player.tier] = (tierCounts[player.tier] ?? 0) + 1;
    methodCounts[player.method] = (methodCounts[player.method] ?? 0) + 1;
    if (player.promotedByTeamEvidence) promotedByTeamEvidence += 1;
    if (player.ambiguous) {
      blockedAmbiguity += 1;
      if (player.ambiguityKind === "same_team") ambiguityBreakdown.sameTeam += 1;
      else if (player.ambiguityKind === "same_program") ambiguityBreakdown.sameProgram += 1;
      else if (player.ambiguityKind === "different_program") ambiguityBreakdown.differentProgram += 1;
    }
    if (player.emptyProvisionalRoster) emptyProvisionalRoster += 1;
    if (player.suppressedAutoMatch) {
      suppressedAutoMatches += 1;
      const methodKey = baseMatchMethod(player.method);
      suppressedAutoMatchesByMethod[methodKey] = (suppressedAutoMatchesByMethod[methodKey] ?? 0) + 1;
    }
    if (player.candidateOnlySuggestion) candidateOnlySuggestions += 1;
    suppressedWeakCandidates += player.suppressedWeakCandidates ?? 0;
    reviewCandidatesShown += player.reviewCandidatesShown ?? 0;
    reviewCandidatesHidden += player.reviewCandidatesHidden ?? 0;
    if (player.scopedToTeam) {
      scopedPlayers += 1;
      if (player.confidenceBand === "Exact" || player.confidenceBand === "Strong Match") {
        scopedAutoMatched += 1;
      }
    }
    if (player.scopedToProgram) {
      programScopedPlayers += 1;
      if (player.confidenceBand === "Exact" || player.confidenceBand === "Strong Match") {
        programScopedAutoMatched += 1;
      }
    }
  }

  const topMethods = Object.entries(methodCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .reduce<Record<string, number>>((accumulator, [method, count]) => {
      accumulator[method] = count;
      return accumulator;
    }, {});

  return {
    tierCounts,
    methodCounts: topMethods,
    scopedMatchRate: scopedPlayers ? Math.round((scopedAutoMatched / scopedPlayers) * 100) : 0,
    programScopedMatchRate: programScopedPlayers
      ? Math.round((programScopedAutoMatched / programScopedPlayers) * 100)
      : 0,
    promotedByTeamEvidence,
    blockedAmbiguity,
    emptyProvisionalRoster,
    suppressedAutoMatches,
    candidateOnlySuggestions,
    suppressedAutoMatchesByMethod,
    suppressedWeakCandidates,
    reviewCandidatesShown,
    reviewCandidatesHidden,
    ambiguityBreakdown
  };
}
