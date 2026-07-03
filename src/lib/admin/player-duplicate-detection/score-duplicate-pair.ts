import { confidenceBandForScore } from "@/lib/admin/player-duplicate-detection/confidence-band";
import {
  displayNameSimilarity,
  fullNameLabel,
  normalizeDuplicateLastName,
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

function intersects(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
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

  const targetDisplayKey = normalizeDuplicateName(target.displayName);
  const candidateDisplayKey = normalizeDuplicateName(candidate.displayName);
  const targetFullName = fullNameLabel(target.firstName, target.lastName);
  const candidateFullName = fullNameLabel(candidate.firstName, candidate.lastName);

  if (targetDisplayKey && targetDisplayKey === candidateDisplayKey) {
    signals.push({
      kind: "match",
      label: "Exact display name",
      detail: target.displayName,
      weight: 35,
    });
    confidence += 35;
  } else {
    const similarity = displayNameSimilarity(target.displayName, candidate.displayName);
    if (similarity >= 0.92) {
      signals.push({
        kind: "match",
        label: "Very similar display name",
        detail: `${Math.round(similarity * 100)}% similarity`,
        weight: 24,
      });
      confidence += 24;
    } else if (similarity >= 0.85) {
      signals.push({
        kind: "match",
        label: "Similar display name",
        detail: `${Math.round(similarity * 100)}% similarity`,
        weight: 18,
      });
      confidence += 18;
    } else if (similarity >= 0.75) {
      signals.push({
        kind: "match",
        label: "Approximate display name",
        detail: `${Math.round(similarity * 100)}% similarity`,
        weight: 10,
      });
      confidence += 10;
    }
  }

  const targetFullKey = normalizeDuplicateName(targetFullName);
  const candidateFullKey = normalizeDuplicateName(candidateFullName);
  if (targetFullKey && targetFullKey === candidateFullKey) {
    signals.push({
      kind: "match",
      label: "Exact first and last name",
      detail: targetFullName,
      weight: 28,
    });
    confidence += 28;
  }

  const targetLastKey = normalizeDuplicateLastName(target.lastName);
  const candidateLastKey = normalizeDuplicateLastName(candidate.lastName);
  if (
    targetLastKey &&
    candidateLastKey &&
    targetLastKey === candidateLastKey &&
    target.firstName[0]?.toUpperCase() === candidate.firstName[0]?.toUpperCase()
  ) {
    signals.push({
      kind: "match",
      label: "Same surname and first initial",
      detail: `${target.lastName}, ${target.firstName[0]}.`,
      weight: 8,
    });
    confidence += 8;
  }

  const aliasCrossMatch =
    aliasMatchesName(target.aliases, candidate.displayName) ||
    aliasMatchesName(candidate.aliases, target.displayName) ||
    aliasMatchesName(target.aliases, candidateFullName) ||
    aliasMatchesName(candidate.aliases, targetFullName);
  if (aliasCrossMatch) {
    signals.push({
      kind: "match",
      label: "Nickname or alias overlap",
      detail: "A saved alias matches the other player's name",
      weight: 18,
    });
    confidence += 18;
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
      label: "Same parent GROUP program",
      detail: target.parentGroupName ?? target.parentGroupProgramId,
      weight: 8,
    });
    confidence += 8;
  }

  const sharedGames = sharedValues(target.gameIds, candidate.gameIds);
  if (sharedGames.length > 0) {
    signals.push({
      kind: "match",
      label: "Same verified game evidence",
      detail: `${sharedGames.length} shared game${sharedGames.length === 1 ? "" : "s"}`,
      weight: 22,
    });
    confidence += 22;
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

  const hasStrongIdentity =
    targetDisplayKey === candidateDisplayKey ||
    displayNameSimilarity(target.displayName, candidate.displayName) >= 0.85 ||
    aliasCrossMatch;

  if (
    target.birthDate &&
    candidate.birthDate &&
    target.birthDate.getTime() !== candidate.birthDate.getTime() &&
    !hasStrongIdentity &&
    !sharedGames.length
  ) {
    confidence = Math.min(confidence, 55);
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

  if (normalizeDuplicateName(target.displayName) === normalizeDuplicateName(candidate.displayName)) return true;
  if (
    normalizeDuplicateLastName(target.lastName) === normalizeDuplicateLastName(candidate.lastName) &&
    target.firstName[0]?.toUpperCase() === candidate.firstName[0]?.toUpperCase()
  ) {
    return true;
  }

  if (displayNameSimilarity(target.displayName, candidate.displayName) >= 0.75) return true;

  if (
    aliasMatchesName(target.aliases, candidate.displayName) ||
    aliasMatchesName(candidate.aliases, target.displayName)
  ) {
    return true;
  }

  const targetYear = birthYear(target.birthDate);
  const candidateYear = birthYear(candidate.birthDate);
  if (targetYear && candidateYear && targetYear === candidateYear) return true;

  if (target.currentProgramId && candidate.currentProgramId && target.currentProgramId === candidate.currentProgramId) {
    return true;
  }

  if (
    target.parentGroupProgramId &&
    candidate.parentGroupProgramId &&
    target.parentGroupProgramId === candidate.parentGroupProgramId
  ) {
    return true;
  }

  if (intersects(target.teamIds, candidate.teamIds)) return true;
  if (intersects(target.leagueIds, candidate.leagueIds)) return true;
  if (intersects(target.gameIds, candidate.gameIds)) return true;

  return false;
}
