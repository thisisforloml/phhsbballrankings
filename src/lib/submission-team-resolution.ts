import { getTeamDisplayName, normalizeProgramAlias } from "@/lib/uaap-school-display";

export type NamedTeamCandidate = { id: string; name: string };

export function normalizeTeamRecordName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function teamDisplayMatchKey(value: string) {
  return normalizeProgramAlias(getTeamDisplayName(value));
}

export function selectPreferredSubmissionTeamMatches<T extends NamedTeamCandidate>(
  submittedTeamName: string,
  internalTeamName: string,
  candidates: T[],
  allowDisplayMatch: boolean,
) {
  const submittedRecordKey = normalizeTeamRecordName(submittedTeamName);
  const exactSubmittedMatches = candidates.filter(
    (team) => normalizeTeamRecordName(team.name) === submittedRecordKey,
  );
  if (exactSubmittedMatches.length) return exactSubmittedMatches;

  const internalRecordKey = normalizeTeamRecordName(internalTeamName);
  const exactInternalMatches = candidates.filter(
    (team) => normalizeTeamRecordName(team.name) === internalRecordKey,
  );
  if (exactInternalMatches.length) return exactInternalMatches;

  if (!allowDisplayMatch) return [];
  const submittedDisplayKey = teamDisplayMatchKey(submittedTeamName);
  return candidates.filter((team) => teamDisplayMatchKey(team.name) === submittedDisplayKey);
}
