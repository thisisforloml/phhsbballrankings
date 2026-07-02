import { PlayerGender } from "@prisma/client";

import {
  normalizeImportedPlayerNameKey,
  prepareImportedPlayerName
} from "@/lib/player-import-identity";
import { type AmbiguityKind,buildMatchQualityAnalytics } from "@/lib/player-import-matching/analytics";
import {
  applyPrecisionAutoMatchPolicy,
  detectWeakNameOnlyMatch,
  isCandidateOnlyMethod,
  isNormalizedFirstAndLastNameMatch,
  partitionReviewCandidates
} from "@/lib/player-import-matching/auto-match-policy";
import {
  generatePlayerMatchKeys,
  isFirstLastOnlyMatch,
  isInitialLastMatch,
  sharedMatchKey
} from "@/lib/player-import-matching/name-keys";
import {
  buildRosterIndex,
  resolveRosterScope,
  type RosterIndex
} from "@/lib/player-import-matching/roster-index";
import {
  applyTeamScoreBonus,
  confidenceBandFromScore,
  teamEvidenceBonus,
  wasPromotedByTeamEvidence
} from "@/lib/player-import-matching/scoring";
import { prisma } from "@/lib/prisma";
import type { PlayerConfidenceBand, UrlImportPlayerMapping } from "@/lib/stats-import/types";

export type PlayerMatchTier = "T0" | "P0" | "P1" | "P2" | "P3" | "none";

export type PlayerMatchCandidate = {
  playerId: string;
  displayName: string;
  score: number;
  baseScore: number;
  tier: PlayerMatchTier;
  method: string;
};

export type PlayerMatchResult = {
  cleanedName: string;
  confidenceBand: PlayerConfidenceBand;
  score: number;
  tier: PlayerMatchTier;
  method: string;
  matchReason?: string;
  suggestedPlayer: Pick<PlayerMatchCandidate, "playerId" | "displayName"> | null;
  candidates: Array<{
    playerId: string;
    displayName: string;
    score: number;
    tier: PlayerMatchTier;
    method: string;
  }>;
  ambiguous: boolean;
  scopedToTeam: boolean;
  scopedToProgram: boolean;
  promotedByTeamEvidence: boolean;
  blockedAmbiguity: boolean;
  emptyProvisionalRoster: boolean;
  ambiguityKind?: AmbiguityKind | null;
  suppressedAutoMatch?: boolean;
  candidateOnlySuggestion?: boolean;
  reviewCandidatesShown?: number;
  reviewCandidatesHidden?: number;
  suppressedWeakCandidates?: number;
  hiddenCandidateSamples?: Array<{
    displayName: string;
    method: string;
    suppressReason: string;
    score: number;
  }>;
};

type PlayerRecord = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  aliases: Array<{ aliasName: string }>;
};

export type PlayerMatchDbContext = {
  players: PlayerRecord[];
} & RosterIndex;

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function tokenSet(value: string) {
  return new Set(
    normalizeName(value)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function fuzzySimilarity(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const tokenScore = intersection / Math.max(leftTokens.size, rightTokens.size);
  const leftKey = normalizeImportedPlayerNameKey(left);
  const rightKey = normalizeImportedPlayerNameKey(right);
  if (leftKey && rightKey && (leftKey.includes(rightKey) || rightKey.includes(leftKey))) {
    return Math.max(tokenScore, 0.9);
  }
  return tokenScore;
}

const TIER_PRIORITY: Record<PlayerMatchTier, number> = {
  T0: -1,
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  none: 99
};

function classifyAmbiguity(
  candidates: PlayerMatchCandidate[],
  scopedTeamId: string | null,
  db: PlayerMatchDbContext
): AmbiguityKind | null {
  if (candidates.length < 2) return null;
  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const topScore = sorted[0].score;
  const closeCandidates = sorted.filter((candidate) => topScore - candidate.score <= 5);
  if (closeCandidates.length < 2) return null;

  const scopedProgramId = scopedTeamId ? db.teamProgramId.get(scopedTeamId) ?? null : null;

  if (scopedTeamId) {
    const teamRoster = db.playersByTeamId.get(scopedTeamId);
    const allOnTeam = closeCandidates.every((candidate) => teamRoster?.has(candidate.playerId));
    if (allOnTeam) return "same_team";
  }

  if (scopedProgramId) {
    const programRoster = db.playersByProgramId.get(scopedProgramId);
    const allInProgram = closeCandidates.every((candidate) => programRoster?.has(candidate.playerId));
    if (allInProgram) return "same_program";
  }

  return "different_program";
}

function isAmbiguous(candidates: PlayerMatchCandidate[]) {
  if (candidates.length < 2) return false;
  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const topScore = sorted[0].score;
  const closeCandidates = sorted.filter((candidate) => topScore - candidate.score <= 5);
  const closePlayerIds = new Set(closeCandidates.map((candidate) => candidate.playerId));
  if (closePlayerIds.size <= 1) return false;
  if (topScore >= 95 && topScore - sorted[1].score >= 8) return false;
  return true;
}

function pushCandidate(bucket: Map<string, PlayerMatchCandidate>, candidate: PlayerMatchCandidate) {
  const existing = bucket.get(candidate.playerId);
  if (!existing) {
    bucket.set(candidate.playerId, candidate);
    return;
  }
  const existingTier = TIER_PRIORITY[existing.tier];
  const candidateTier = TIER_PRIORITY[candidate.tier];
  if (
    candidate.baseScore > existing.baseScore ||
    (candidate.baseScore === existing.baseScore && candidateTier < existingTier)
  ) {
    bucket.set(candidate.playerId, candidate);
  }
}

function mapResultCandidates(candidates: PlayerMatchCandidate[]) {
  return candidates.map((candidate) => ({
    playerId: candidate.playerId,
    displayName: candidate.displayName,
    score: candidate.score,
    tier: candidate.tier,
    method: candidate.method
  }));
}

function partitionMeaningfulCandidates(
  cleanedName: string,
  candidates: PlayerMatchCandidate[],
  playersById: Map<string, PlayerRecord>
) {
  const { shown, hidden } = partitionReviewCandidates({
    cleanedName,
    candidates: candidates.map((candidate) => ({ playerId: candidate.playerId, method: candidate.method })),
    playersById
  });
  const shownIds = new Set(shown.map((candidate) => candidate.playerId));
  const hiddenCandidateSamples = hidden.slice(0, 3).map((hiddenCandidate) => {
    const full = candidates.find((candidate) => candidate.playerId === hiddenCandidate.playerId);
    return {
      displayName: full?.displayName ?? "",
      method: full?.method ?? hiddenCandidate.method,
      suppressReason: hiddenCandidate.suppressReason,
      score: full?.score ?? 0
    };
  });
  return {
    shownCandidates: candidates.filter((candidate) => shownIds.has(candidate.playerId)),
    hiddenCandidates: hidden,
    reviewCandidatesShown: shown.length,
    reviewCandidatesHidden: hidden.length,
    suppressedWeakCandidates: hidden.length,
    hiddenCandidateSamples
  };
}

function scopedMethod(method: string, scopedToTeam: boolean, scopedToProgram: boolean) {
  if (scopedToTeam) return `team_${method}`;
  if (scopedToProgram) return `program_${method}`;
  return method;
}

function collectNameKeyCandidates(
  bucket: Map<string, PlayerMatchCandidate>,
  cleanedName: string,
  player: PlayerRecord,
  scopedToTeam: boolean,
  scopedToProgram: boolean
) {
  if (player.displayName === cleanedName) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 100,
      score: 100,
      tier: "P0",
      method: scopedMethod("display_name_exact", scopedToTeam, scopedToProgram)
    });
  }

  if (sharedMatchKey(cleanedName, player.displayName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 98,
      score: 98,
      tier: "P0",
      method: scopedMethod("name_key_display", scopedToTeam, scopedToProgram)
    });
  }

  if (normalizeImportedPlayerNameKey(player.displayName) === normalizeImportedPlayerNameKey(cleanedName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 98,
      score: 98,
      tier: "P0",
      method: scopedMethod("display_name_normalized", scopedToTeam, scopedToProgram)
    });
  }

  for (const alias of player.aliases) {
    if (alias.aliasName === cleanedName) {
      pushCandidate(bucket, {
        playerId: player.id,
        displayName: player.displayName,
        baseScore: 99,
        score: 99,
        tier: "P1",
        method: scopedMethod("alias_exact", scopedToTeam, scopedToProgram)
      });
    } else if (sharedMatchKey(cleanedName, alias.aliasName)) {
      pushCandidate(bucket, {
        playerId: player.id,
        displayName: player.displayName,
        baseScore: 97,
        score: 97,
        tier: "P1",
        method: scopedMethod("name_key_alias", scopedToTeam, scopedToProgram)
      });
    } else if (normalizeImportedPlayerNameKey(alias.aliasName) === normalizeImportedPlayerNameKey(cleanedName)) {
      pushCandidate(bucket, {
        playerId: player.id,
        displayName: player.displayName,
        baseScore: 97,
        score: 97,
        tier: "P1",
        method: scopedMethod("alias_normalized", scopedToTeam, scopedToProgram)
      });
    }
  }

  const fullName = `${player.firstName} ${player.lastName}`.trim();
  if (fullName && normalizeName(fullName) === normalizeName(cleanedName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 96,
      score: 96,
      tier: "P2",
      method: scopedMethod("first_last_name", scopedToTeam, scopedToProgram)
    });
  }

  if (isNormalizedFirstAndLastNameMatch(cleanedName, player.firstName, player.lastName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 96,
      score: 96,
      tier: "P2",
      method: scopedMethod("normalized_first_last_name", scopedToTeam, scopedToProgram)
    });
  }

  const weakNameMatch = detectWeakNameOnlyMatch(cleanedName, player.firstName, player.lastName);
  if (weakNameMatch) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 68,
      score: 68,
      tier: "P3",
      method: scopedMethod(weakNameMatch, scopedToTeam, scopedToProgram)
    });
  }

  if (isFirstLastOnlyMatch(cleanedName, player.displayName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 95,
      score: 95,
      tier: "P2",
      method: scopedMethod("name_key_first_last", scopedToTeam, scopedToProgram)
    });
  }

  if (fullName && isFirstLastOnlyMatch(cleanedName, fullName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 95,
      score: 95,
      tier: "P2",
      method: scopedMethod("name_key_first_last", scopedToTeam, scopedToProgram)
    });
  }

  if (isInitialLastMatch(cleanedName, player.displayName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 93,
      score: 93,
      tier: "P2",
      method: scopedMethod("name_key_initial_last", scopedToTeam, scopedToProgram)
    });
  }

  if (fullName && isInitialLastMatch(cleanedName, fullName)) {
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: 93,
      score: 93,
      tier: "P2",
      method: scopedMethod("name_key_initial_last", scopedToTeam, scopedToProgram)
    });
  }

  const similarity = fuzzySimilarity(cleanedName, player.displayName);
  if (similarity >= 0.5) {
    const fuzzyScore = Math.round(50 + similarity * 45);
    pushCandidate(bucket, {
      playerId: player.id,
      displayName: player.displayName,
      baseScore: fuzzyScore,
      score: fuzzyScore,
      tier: fuzzyScore >= 90 ? "P2" : "P3",
      method: scopedMethod("fuzzy_display_name", scopedToTeam, scopedToProgram)
    });
  }
}

export function importedPlayerKey(teamLabel: string, cleanedName: string) {
  return `${normalizeImportedPlayerNameKey(teamLabel)}::${normalizeImportedPlayerNameKey(cleanedName)}`;
}

export async function loadPlayerMatchDbContext(teamIds: string[], gender: PlayerGender): Promise<PlayerMatchDbContext> {
  const uniqueTeamIds = Array.from(new Set(teamIds.filter(Boolean)));

  const players = await prisma.player.findMany({
    where: { deletedAt: null, gender },
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      aliases: { select: { aliasName: true } }
    },
    orderBy: { displayName: "asc" }
  });

  const emptyRoster: RosterIndex = {
    playersByTeamId: new Map(),
    playersByProgramId: new Map(),
    teamProgramId: new Map(),
    playerTeamIds: new Map(),
    playerProgramIds: new Map()
  };

  if (!uniqueTeamIds.length) {
    return { players, ...emptyRoster };
  }

  const scopedTeams = await prisma.team.findMany({
    where: { id: { in: uniqueTeamIds } },
    select: { id: true, programId: true }
  });
  const teamProgramId = new Map(scopedTeams.map((team) => [team.id, team.programId]));
  const programIds = Array.from(
    new Set(scopedTeams.map((team) => team.programId).filter((programId): programId is string => Boolean(programId)))
  );

  const programTeams = programIds.length
    ? await prisma.team.findMany({
        where: { programId: { in: programIds } },
        select: { id: true, programId: true }
      })
    : [];

  for (const team of programTeams) {
    if (!teamProgramId.has(team.id)) {
      teamProgramId.set(team.id, team.programId);
    }
  }

  const rosterTeamIds = Array.from(new Set([...uniqueTeamIds, ...programTeams.map((team) => team.id)]));

  const [gameStatRows, rosterRows] = await Promise.all([
    prisma.gameStat.findMany({
      where: {
        teamId: { in: rosterTeamIds },
        game: { deletedAt: null }
      },
      distinct: ["playerId", "teamId"],
      select: { playerId: true, teamId: true }
    }),
    prisma.playerTeamSeason.findMany({
      where: {
        teamId: { in: rosterTeamIds },
        deletedAt: null
      },
      select: { playerId: true, teamId: true }
    })
  ]);

  const rosterIndex = buildRosterIndex({
    rosterRows: [...gameStatRows, ...rosterRows],
    teamProgramId
  });

  return { players, ...rosterIndex };
}

export function matchImportedPlayer(
  input: {
    importedName: string;
    gender: PlayerGender;
    scopedTeamId?: string | null;
    provisionalScopedToTeam?: boolean;
    savedAliasPlayerId?: string | null;
  },
  db: PlayerMatchDbContext
): PlayerMatchResult {
  const cleanedName = prepareImportedPlayerName(input.importedName);
  const scopedTeamId = input.scopedTeamId ?? null;
  const provisionalScopedToTeam = Boolean(input.provisionalScopedToTeam);

  if (input.savedAliasPlayerId) {
    const savedPlayer = db.players.find((player) => player.id === input.savedAliasPlayerId);
    if (savedPlayer) {
      const rosterScope = resolveRosterScope({
        scopedTeamId,
        provisionalScopedToTeam,
        roster: db
      });
      return {
        cleanedName,
        confidenceBand: "Exact",
        score: 100,
        tier: "T0",
        method: "saved_alias",
        matchReason: "Saved Alias",
        suggestedPlayer: { playerId: savedPlayer.id, displayName: savedPlayer.displayName },
        candidates: [
          {
            playerId: savedPlayer.id,
            displayName: savedPlayer.displayName,
            score: 100,
            tier: "T0",
            method: "saved_alias"
          }
        ],
        ambiguous: false,
        scopedToTeam: rosterScope.scopedToTeam,
        scopedToProgram: rosterScope.scopedToProgram,
        promotedByTeamEvidence: false,
        blockedAmbiguity: false,
        emptyProvisionalRoster: rosterScope.emptyProvisionalRoster,
        ambiguityKind: null,
        reviewCandidatesShown: 1,
        reviewCandidatesHidden: 0,
        suppressedWeakCandidates: 0
      };
    }
  }

  const rosterScope = resolveRosterScope({
    scopedTeamId,
    provisionalScopedToTeam,
    roster: db
  });
  const scopedToTeam = rosterScope.scopedToTeam;
  const scopedToProgram = rosterScope.scopedToProgram;
  const scopedContext = scopedToTeam || scopedToProgram;

  const candidatePool =
    rosterScope.playerIds && rosterScope.kind !== "global"
      ? db.players.filter((player) => rosterScope.playerIds!.has(player.id))
      : db.players;

  const bucket = new Map<string, PlayerMatchCandidate>();
  for (const player of candidatePool) {
    collectNameKeyCandidates(bucket, cleanedName, player, scopedToTeam, scopedToProgram);
  }

  const teamRoster = scopedTeamId ? db.playersByTeamId.get(scopedTeamId) : null;
  const programRoster = rosterScope.scopedProgramId
    ? db.playersByProgramId.get(rosterScope.scopedProgramId)
    : null;

  const scoredCandidates = Array.from(bucket.values()).map((candidate) => {
    const onScopedRoster = Boolean(teamRoster?.has(candidate.playerId));
    const onProgramRoster = Boolean(!onScopedRoster && programRoster?.has(candidate.playerId) && scopedToProgram);
    const bonus = teamEvidenceBonus({ onScopedRoster, onProgramRoster, provisionalScopedToTeam });
    const eligibleForBonus = !isCandidateOnlyMethod(candidate.method);
    const score = applyTeamScoreBonus(candidate.baseScore, eligibleForBonus ? bonus : 0);
    return { ...candidate, score };
  });

  const candidates = scoredCandidates.sort(
    (left, right) =>
      right.score - left.score ||
      TIER_PRIORITY[left.tier] - TIER_PRIORITY[right.tier] ||
      left.displayName.localeCompare(right.displayName)
  );

  const playersById = new Map(db.players.map((player) => [player.id, player]));
  const {
    shownCandidates,
    hiddenCandidates,
    reviewCandidatesShown,
    reviewCandidatesHidden,
    suppressedWeakCandidates,
    hiddenCandidateSamples
  } = partitionMeaningfulCandidates(cleanedName, candidates, playersById);

  const exactDisplayMatches = shownCandidates.filter(
    (candidate) => candidate.baseScore >= 100 || candidate.method.includes("display_name_exact")
  );
  if (exactDisplayMatches.length > 1) {
    const ambiguityKind = classifyAmbiguity(exactDisplayMatches, scopedTeamId, db);
    return {
      cleanedName,
      confidenceBand: "Review Needed",
      score: 84,
      tier: "none",
      method: "multiple_exact_display_matches",
      suggestedPlayer: null,
      candidates: mapResultCandidates(exactDisplayMatches),
      ambiguous: true,
      scopedToTeam,
      scopedToProgram,
      promotedByTeamEvidence: false,
      blockedAmbiguity: true,
      emptyProvisionalRoster: rosterScope.emptyProvisionalRoster,
      ambiguityKind,
      reviewCandidatesShown,
      reviewCandidatesHidden,
      suppressedWeakCandidates,
      hiddenCandidateSamples
    };
  }

  const ambiguous = isAmbiguous(shownCandidates);
  const ambiguityKind = ambiguous ? classifyAmbiguity(shownCandidates, scopedTeamId, db) : null;
  const top = candidates[0] ?? null;
  const topMeaningful = shownCandidates[0] ?? null;
  const baseScore = top?.baseScore ?? 0;
  const rawScore = ambiguous ? Math.min(top?.score ?? 0, 84) : top?.score ?? 0;
  const rawConfidenceBand = confidenceBandFromScore(rawScore, ambiguous, scopedContext);
  const policy = applyPrecisionAutoMatchPolicy({
    confidenceBand: rawConfidenceBand,
    method: ambiguous ? "ambiguous_candidates" : top?.method ?? "no_match"
  });
  let confidenceBand = policy.confidenceBand;
  let method = ambiguous ? "ambiguous_candidates" : top?.method ?? "no_match";
  let finalAmbiguous = ambiguous;

  if (
    (confidenceBand === "Review Needed" || policy.candidateOnlySuggestion) &&
    !topMeaningful &&
    hiddenCandidates.length > 0
  ) {
    confidenceBand = "Unmatched";
    method = "no_match";
    finalAmbiguous = false;
  }

  const score = policy.suppressedAutoMatch ? Math.min(rawScore, 84) : rawScore;
  const promotedByTeamEvidence = top
    ? wasPromotedByTeamEvidence(baseScore, finalAmbiguous ? score : top.score, finalAmbiguous, scopedContext) &&
      !policy.suppressedAutoMatch &&
      !isCandidateOnlyMethod(top.method)
    : false;

  const suggestedPlayer =
    topMeaningful &&
    confidenceBand !== "Unmatched" &&
    (confidenceBand === "Exact" ||
      confidenceBand === "Strong Match" ||
      confidenceBand === "Review Needed" ||
      policy.candidateOnlySuggestion)
      ? { playerId: topMeaningful.playerId, displayName: topMeaningful.displayName }
      : null;

  return {
    cleanedName,
    confidenceBand,
    score,
    tier: top?.tier ?? "none",
    method,
    suggestedPlayer,
    candidates: mapResultCandidates(shownCandidates),
    ambiguous: finalAmbiguous,
    scopedToTeam,
    scopedToProgram,
    promotedByTeamEvidence,
    blockedAmbiguity: finalAmbiguous,
    emptyProvisionalRoster: rosterScope.emptyProvisionalRoster,
    ambiguityKind: finalAmbiguous ? ambiguityKind : null,
    suppressedAutoMatch: policy.suppressedAutoMatch,
    candidateOnlySuggestion: policy.candidateOnlySuggestion,
    reviewCandidatesShown,
    reviewCandidatesHidden,
    suppressedWeakCandidates,
    hiddenCandidateSamples
  };
}

export { buildMatchQualityAnalytics, generatePlayerMatchKeys };

export function buildPlayerMappingAuditNotes(mappings: UrlImportPlayerMapping[]) {
  if (!mappings.length) return "";

  const reuseLines: string[] = [];
  const createLines: string[] = [];

  for (const mapping of mappings) {
    const teamContext = mapping.mappedTeamName ? ` (${mapping.mappedTeamName})` : mapping.teamLabel ? ` (${mapping.teamLabel})` : "";
    if (mapping.action === "mapped_existing" && mapping.playerName) {
      reuseLines.push(`- "${mapping.importedName}"${teamContext} → ${mapping.playerName} (reuse)`);
      continue;
    }
    if (mapping.action === "create_on_import") {
      createLines.push(`- ${mapping.cleanedName}${teamContext}`);
    }
  }

  const sections: string[] = [];
  if (reuseLines.length) {
    sections.push(["Player mappings (StatsHub URL import):", ...reuseLines].join("\n"));
  }
  if (createLines.length) {
    sections.push(["New players to create:", ...createLines].join("\n"));
  }
  return sections.join("\n\n");
}
