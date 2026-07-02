import {
  isFirstLastOnlyMatch,
  normalizeNameForKeys
} from "@/lib/player-import-matching/name-keys";
import type { PlayerConfidenceBand } from "@/lib/stats-import/types";

/** Strip team_/program_ scope prefix from matcher method names. */
export function baseMatchMethod(method: string) {
  return method.replace(/^(team_|program_)/, "");
}

const ALIAS_EVIDENCE_BASE_METHODS = new Set([
  "saved_alias",
  "alias_exact",
  "alias_normalized",
  "name_key_alias"
]);

const STRONG_NAME_BASE_METHODS = new Set([
  "display_name_exact",
  "display_name_normalized",
  "first_last_name",
  "normalized_first_last_name",
  "multiple_exact_display_matches"
]);

const WEAK_ONLY_BASE_METHODS = new Set([
  "fuzzy_display_name",
  "first_name_only",
  "surname_only",
  "name_key_initial_last",
  "nickname_only"
]);

/**
 * Methods that may appear as review suggestions but must never auto-resolve
 * as Exact or Strong Match.
 */
export const CANDIDATE_ONLY_BASE_METHODS = new Set([
  "name_key_display",
  "name_key_alias",
  "alias_normalized",
  "name_key_first_last",
  "name_key_initial_last",
  "fuzzy_display_name",
  "first_name_only",
  "surname_only"
]);

/** Methods allowed to auto-resolve as Exact or Strong Match. */
export const AUTO_ELIGIBLE_BASE_METHODS = new Set([
  "saved_alias",
  "alias_exact",
  "display_name_exact",
  "display_name_normalized",
  "first_last_name",
  "normalized_first_last_name"
]);

function normalizeToken(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isNormalizedFirstAndLastNameMatch(
  cleanedName: string,
  firstName: string,
  lastName: string
) {
  const first = normalizeToken(firstName);
  const last = normalizeToken(lastName);
  if (!first || !last) return false;

  const tokens = normalizeNameForKeys(cleanedName)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 2) return false;

  const importedFirst = normalizeToken(tokens[0].replace(/\.$/, ""));
  const importedLast = normalizeToken(tokens[tokens.length - 1]);
  return importedFirst === first && importedLast === last;
}

export function detectWeakNameOnlyMatch(
  cleanedName: string,
  firstName: string,
  lastName: string
): "first_name_only" | "surname_only" | null {
  const first = normalizeToken(firstName);
  const last = normalizeToken(lastName);
  if (!first || !last) return null;

  const tokens = normalizeNameForKeys(cleanedName)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length !== 1) return null;

  const token = normalizeToken(tokens[0].replace(/\.$/, ""));
  if (token === first) return "first_name_only";
  if (token === last) return "surname_only";
  return null;
}

export function isCandidateOnlyMethod(method: string) {
  return CANDIDATE_ONLY_BASE_METHODS.has(baseMatchMethod(method));
}

export function isAutoEligibleMethod(method: string) {
  return AUTO_ELIGIBLE_BASE_METHODS.has(baseMatchMethod(method));
}

type ReviewCandidatePlayer = {
  displayName: string;
  firstName: string;
  lastName: string;
  aliases: Array<{ aliasName: string }>;
};

function importedFirstLastTokens(cleanedName: string) {
  const tokens = normalizeNameForKeys(cleanedName).split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  return {
    first: normalizeToken(tokens[0].replace(/\.$/, "")),
    last: normalizeToken(tokens[tokens.length - 1])
  };
}

function namePartsMatch(
  imported: { first: string; last: string },
  firstName: string,
  lastName: string
) {
  const first = normalizeToken(firstName);
  const last = normalizeToken(lastName);
  return Boolean(first && last && imported.first === first && imported.last === last);
}

export function isMeaningfulReviewCandidate(input: {
  cleanedName: string;
  player: ReviewCandidatePlayer;
  method: string;
}): boolean {
  const baseMethod = baseMatchMethod(input.method);
  const { cleanedName, player } = input;

  if (ALIAS_EVIDENCE_BASE_METHODS.has(baseMethod) || STRONG_NAME_BASE_METHODS.has(baseMethod)) {
    return true;
  }

  if (WEAK_ONLY_BASE_METHODS.has(baseMethod)) {
    return false;
  }

  if (baseMethod === "name_key_first_last") {
    return (
      isNormalizedFirstAndLastNameMatch(cleanedName, player.firstName, player.lastName) ||
      isFirstLastOnlyMatch(cleanedName, player.displayName)
    );
  }

  const imported = importedFirstLastTokens(cleanedName);
  if (!imported) return false;

  if (namePartsMatch(imported, player.firstName, player.lastName)) {
    return true;
  }

  for (const alias of player.aliases) {
    const aliasTokens = normalizeNameForKeys(alias.aliasName).split(/\s+/).filter(Boolean);
    if (aliasTokens.length >= 2) {
      const aliasFirst = aliasTokens[0].replace(/\.$/, "");
      const aliasLast = aliasTokens[aliasTokens.length - 1];
      if (namePartsMatch(imported, aliasFirst, aliasLast)) {
        return true;
      }
    }
  }

  return false;
}

export function partitionReviewCandidates(input: {
  cleanedName: string;
  candidates: Array<{ playerId: string; method: string }>;
  playersById: Map<string, ReviewCandidatePlayer>;
}) {
  const shown: typeof input.candidates = [];
  const hidden: Array<(typeof input.candidates)[number] & { suppressReason: string }> = [];

  for (const candidate of input.candidates) {
    const player = input.playersById.get(candidate.playerId);
    if (!player) continue;
    if (isMeaningfulReviewCandidate({ cleanedName: input.cleanedName, player, method: candidate.method })) {
      shown.push(candidate);
      continue;
    }
    hidden.push({
      ...candidate,
      suppressReason: baseMatchMethod(candidate.method)
    });
  }

  return { shown, hidden };
}

export function applyPrecisionAutoMatchPolicy(input: {
  confidenceBand: PlayerConfidenceBand;
  method: string;
}): {
  confidenceBand: PlayerConfidenceBand;
  suppressedAutoMatch: boolean;
  candidateOnlySuggestion: boolean;
} {
  const method = input.method;
  const candidateOnly = isCandidateOnlyMethod(method);
  const autoEligible = isAutoEligibleMethod(method);
  const wasAuto = input.confidenceBand === "Exact" || input.confidenceBand === "Strong Match";

  if (autoEligible) {
    return {
      confidenceBand: input.confidenceBand,
      suppressedAutoMatch: false,
      candidateOnlySuggestion: false
    };
  }

  if (candidateOnly || (method !== "no_match" && method !== "ambiguous_candidates" && method !== "multiple_exact_display_matches")) {
    return {
      confidenceBand: wasAuto ? "Review Needed" : input.confidenceBand === "Unmatched" ? "Unmatched" : "Review Needed",
      suppressedAutoMatch: wasAuto,
      candidateOnlySuggestion: method !== "no_match" && method !== "ambiguous_candidates"
    };
  }

  return {
    confidenceBand: wasAuto ? "Review Needed" : input.confidenceBand,
    suppressedAutoMatch: wasAuto,
    candidateOnlySuggestion: false
  };
}
