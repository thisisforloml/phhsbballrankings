import { confidenceBandForScore } from "@/lib/admin/player-duplicate-detection/confidence-band";
import {
  displayNameSimilarity,
  duplicateNameEvidence,
  normalizeDuplicateName,
} from "@/lib/admin/player-duplicate-detection/name-similarity";
import type {
  DuplicatePlayerRecord,
  DuplicateSignal,
  PlayerDuplicateCandidate,
} from "@/lib/admin/player-duplicate-detection/types";

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function birthYear(date: Date | null) {
  return date ? date.getUTCFullYear() : null;
}

function sharedValues(left: Set<string>, right: Set<string>) {
  const values: string[] = [];
  for (const value of left) {
    if (right.has(value)) values.push(value);
  }
  return values;
}

function aliasMatchesName(aliases: string[], name: string) {
  const key = normalizeDuplicateName(name);
  return aliases.some((alias) => normalizeDuplicateName(alias) === key);
}

function bestAliasSimilarity(leftAliases: string[], rightName: string, rightAliases: string[]) {
  const names = [rightName, ...rightAliases];
  let best = 0;
  for (const alias of leftAliases) {
    for (const other of names) {
      best = Math.max(best, displayNameSimilarity(alias, other));
    }
  }
  return best;
}

export function scoreDuplicatePair(
  target: DuplicatePlayerRecord,
  candidate: DuplicatePlayerRecord,
): { confidence: number; signals: DuplicateSignal[] } | null {
  if (target.id === candidate.id) return null;
  if (target.gender !== candidate.gender) return null;

  const signals: DuplicateSignal[] = [];
  let confidence = 0;

  const nameEvidence = duplicateNameEvidence(target.displayName, candidate.displayName);
  const aliasCrossMatch =
    aliasMatchesName(target.aliases, candidate.displayName) ||
    aliasMatchesName(candidate.aliases, target.displayName);
  if (!nameEvidence.hasIdentityAnchor && !aliasCrossMatch) return null;

  if (nameEvidence.exactName) {
    signals.push({
      kind: "match",
      label: "Exact display name",
      detail: target.displayName,
      weight: 78,
    });
    confidence += 78;
  } else if (nameEvidence.sharedTokenCount >= 3 && !nameEvidence.hasConflictingAdditionalNames) {
    signals.push({
      kind: "match",
      label: "Three or more shared name tokens",
      detail: `${nameEvidence.sharedTokenCount} shared names`,
      weight: 82,
    });
    confidence += 82;
  } else if (nameEvidence.middleNameVariant) {
    signals.push({
      kind: "match",
      label: "Same first and last name; middle name differs",
      detail: `${target.displayName} / ${candidate.displayName}`,
      weight: 72,
    });
    confidence += 72;
  } else if (nameEvidence.exactFirstLast) {
    signals.push({
      kind: "match",
      label: "Same first and last name",
      detail: `${target.displayName} / ${candidate.displayName}`,
      weight: 68,
    });
    confidence += 68;
  } else if (nameEvidence.fuzzyFirstLast) {
    signals.push({
      kind: "match",
      label: "Likely first/last name spelling variant",
      detail: `${target.displayName} / ${candidate.displayName}`,
      weight: 62,
    });
    confidence += 62;
  }

  if (nameEvidence.hasConflictingAdditionalNames) {
    signals.push({
      kind: "conflict",
      label: "Different additional names",
      detail: `${target.displayName} / ${candidate.displayName}`,
      weight: -35,
    });
    confidence -= 35;
  }

  if (aliasCrossMatch) {
    signals.push({
      kind: "match",
      label: "Nickname or alias overlap",
      detail: "A saved alias matches the other player's name",
      weight: nameEvidence.hasIdentityAnchor ? 18 : 70,
    });
    confidence += nameEvidence.hasIdentityAnchor ? 18 : 70;
  } else {
    const aliasSimilarity = bestAliasSimilarity(target.aliases, candidate.displayName, candidate.aliases);
    if (aliasSimilarity >= 0.9) {
      signals.push({
        kind: "match",
        label: "Nickname similarity",
        detail: `${Math.round(aliasSimilarity * 100)}% alias similarity`,
        weight: 12,
      });
      confidence += 12;
    }
  }

  if (target.birthDate && candidate.birthDate) {
    if (target.birthDate.getTime() === candidate.birthDate.getTime()) {
      signals.push({
        kind: "match",
        label: "Same birthdate",
        detail: formatDate(target.birthDate) ?? "",
        weight: 25,
      });
      confidence += 25;
    } else {
      signals.push({
        kind: "conflict",
        label: "Different birthdate",
        detail: `${formatDate(target.birthDate)} vs ${formatDate(candidate.birthDate)}`,
        weight: -30,
      });
      confidence -= 30;
    }
  } else {
    const targetYear = birthYear(target.birthDate);
    const candidateYear = birthYear(candidate.birthDate);
    if (targetYear && candidateYear && targetYear === candidateYear) {
      signals.push({
        kind: "match",
        label: "Same birth year",
        detail: String(targetYear),
        weight: 10,
      });
      confidence += 10;
    }
  }

  if (target.heightCm !== null && candidate.heightCm !== null) {
    const delta = Math.abs(target.heightCm - candidate.heightCm);
    if (delta === 0) {
      signals.push({
        kind: "match",
        label: "Same height",
        detail: `${target.heightCm} cm`,
        weight: 8,
      });
      confidence += 8;
    } else if (delta > 5) {
      signals.push({
        kind: "conflict",
        label: "Different height",
        detail: `${target.heightCm} cm vs ${candidate.heightCm} cm`,
        weight: -10,
      });
      confidence -= 10;
    }
  }

  if (target.dominantHand && candidate.dominantHand) {
    if (target.dominantHand === candidate.dominantHand) {
      signals.push({
        kind: "match",
        label: "Same dominant hand",
        detail: target.dominantHand,
        weight: 4,
      });
      confidence += 4;
    } else {
      signals.push({
        kind: "conflict",
        label: "Different dominant hand",
        detail: `${target.dominantHand} vs ${candidate.dominantHand}`,
        weight: -6,
      });
      confidence -= 6;
    }
  }

  if (target.currentProgramId && candidate.currentProgramId) {
    if (target.currentProgramId === candidate.currentProgramId) {
      signals.push({
        kind: "match",
        label: "Same current operational program",
        detail: target.currentProgramName ?? target.currentProgramId,
        weight: 15,
      });
      confidence += 15;
    } else {
      signals.push({
        kind: "conflict",
        label: "Different current program",
        detail: `${target.currentProgramName ?? "Unknown"} vs ${candidate.currentProgramName ?? "Unknown"}`,
        weight: -12,
      });
      confidence -= 12;
    }
  }

  if (
    target.parentGroupProgramId &&
    candidate.parentGroupProgramId &&
    target.parentGroupProgramId === candidate.parentGroupProgramId
  ) {
    signals.push({
      kind: "match",
      label: "Same organization group",
      detail: target.parentGroupName ?? target.parentGroupProgramId,
      weight: 8,
    });
    confidence += 8;
  }

  const sharedGames = sharedValues(target.gameIds, candidate.gameIds);
  if (sharedGames.length > 0) {
    signals.push({
      kind: "conflict",
      label: "Both appear in the same official game",
      detail: `${sharedGames.length} shared game${sharedGames.length === 1 ? "" : "s"}`,
      weight: -35,
    });
    confidence -= 35;
  }

  const sharedTeams = sharedValues(target.teamIds, candidate.teamIds);
  if (sharedTeams.length > 0) {
    signals.push({
      kind: "match",
      label: "Same team",
      detail: `${sharedTeams.length} shared team${sharedTeams.length === 1 ? "" : "s"}`,
      weight: 12,
    });
    confidence += 12;
  }

  const sharedLeagues = sharedValues(target.leagueIds, candidate.leagueIds);
  if (sharedLeagues.length > 0) {
    signals.push({
      kind: "match",
      label: "Same competition",
      detail: `${sharedLeagues.length} shared league${sharedLeagues.length === 1 ? "" : "s"}`,
      weight: 8,
    });
    confidence += 8;
  }

  const sharedSeasons = sharedValues(target.seasonKeys, candidate.seasonKeys);
  if (sharedSeasons.length > 0) {
    signals.push({
      kind: "match",
      label: "Same season",
      detail: `${sharedSeasons.length} shared season${sharedSeasons.length === 1 ? "" : "s"}`,
      weight: 6,
    });
    confidence += 6;
  }

  if (target.portraitHash && candidate.portraitHash) {
    if (target.portraitHash === candidate.portraitHash) {
      signals.push({
        kind: "match",
        label: "Same portrait hash",
        detail: "Portrait fingerprint matches",
        weight: 15,
      });
      confidence += 15;
    } else if (target.photoUrl && candidate.photoUrl) {
      signals.push({
        kind: "conflict",
        label: "Different portrait hash",
        detail: "Both players have portraits but fingerprints differ",
        weight: -8,
      });
      confidence -= 8;
    }
  }

  const sharedExternalIds = target.externalIds.filter((left) =>
    candidate.externalIds.some(
      (right) => left.provider === right.provider && left.label === right.label,
    ),
  );
  if (sharedExternalIds.length > 0) {
    signals.push({
      kind: "match",
      label: "Same external ID",
      detail: sharedExternalIds.map((item) => `${item.provider}:${item.label}`).join(", "),
      weight: 20,
    });
    confidence += 20;
  }

  if (
    target.birthDate &&
    candidate.birthDate &&
    target.birthDate.getTime() !== candidate.birthDate.getTime() &&
    !sharedGames.length &&
    !sharedExternalIds.length
  ) {
    confidence = Math.min(confidence, 45);
  }

  if (
    nameEvidence.hasConflictingAdditionalNames &&
    !sharedExternalIds.length
  ) {
    confidence = Math.min(confidence, 59);
  }

  if (
    sharedGames.length > 0 &&
    !nameEvidence.exactName &&
    !nameEvidence.middleNameVariant &&
    !aliasCrossMatch &&
    !sharedExternalIds.length
  ) {
    confidence = Math.min(confidence, 59);
  }

  if (!signals.some((signal) => signal.kind === "match")) {
    return null;
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return { confidence, signals };
}

export function toDuplicateCandidate(
  candidate: DuplicatePlayerRecord,
  scored: { confidence: number; signals: DuplicateSignal[] },
): PlayerDuplicateCandidate {
  const matchingSignals = scored.signals
    .filter((signal) => signal.kind === "match")
    .map((signal) => signal.label);
  const conflictingSignals = scored.signals
    .filter((signal) => signal.kind === "conflict")
    .map((signal) => signal.label);

  const topMatches = scored.signals
    .filter((signal) => signal.kind === "match")
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map((signal) => signal.label.toLowerCase());

  const explanation =
    topMatches.length > 0
      ? `Likely duplicate because of ${topMatches.join(", ")}.`
      : "Possible duplicate based on overlapping identity metadata.";

  return {
    player: {
      playerId: candidate.id,
      displayName: candidate.displayName,
      gender: candidate.gender,
      birthDate: formatDate(candidate.birthDate),
      heightCm: candidate.heightCm,
      currentProgramName: candidate.currentProgramName,
      parentGroupName: candidate.parentGroupName,
      verifiedGameCount: candidate.gameIds.size,
    },
    confidence: scored.confidence,
    band: confidenceBandForScore(scored.confidence),
    matchingSignals,
    conflictingSignals,
    explanation,
  };
}

export function passesDuplicatePrefilter(target: DuplicatePlayerRecord, candidate: DuplicatePlayerRecord) {
  if (target.id === candidate.id) return false;
  if (target.gender !== candidate.gender) return false;

  if (duplicateNameEvidence(target.displayName, candidate.displayName).hasIdentityAnchor) return true;

  if (
    aliasMatchesName(target.aliases, candidate.displayName) ||
    aliasMatchesName(candidate.aliases, target.displayName)
  ) {
    return true;
  }

  return false;
}
