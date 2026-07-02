import { AgeGroup, PlayerGender } from "@prisma/client";

import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { prisma } from "@/lib/prisma";
import type { StatsImportProviderId, TeamCreationPreview, UrlImportTeamMapping } from "@/lib/stats-import/types";
import {
  loadTeamExternalAliasMap,
  normalizeExternalTeamLabel,
  type TeamExternalAliasRecord
} from "@/lib/team-external-alias";
import {
  getTeamDisplayName,
  getUaapInternalTeamName,
  normalizeProgramAlias,
  type ProgramIdentity,
  resolveProgramIdentity} from "@/lib/uaap-school-display";

export type TeamMatchTier = "T0" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "none";
export type TeamConfidenceBand = "Exact" | "Strong Match" | "Review Needed" | "Unmatched";

export type TeamMatchInput = {
  externalLabel: string;
  scheduleLabel?: string | null;
  /** @deprecated Use scheduleLabel */
  fullScheduleLabel?: string | null;
  leagueName: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
  competitionId?: string | null;
  provider: StatsImportProviderId;
};

export type TeamMatchCandidate = {
  teamId: string;
  teamName: string;
  programId: string | null;
  programName: string | null;
  score: number;
  tier: TeamMatchTier;
  method: string;
};

export type TeamMatchResult = {
  externalLabel: string;
  aliasKey: string;
  scheduleLabel?: string | null;
  matchingInput: string;
  inferredProgramName: string;
  confidenceBand: TeamConfidenceBand;
  score: number;
  tier: TeamMatchTier;
  method: string;
  matchReason?: string;
  suggestedTeam: Pick<TeamMatchCandidate, "teamId" | "teamName" | "programName"> | null;
  candidates: TeamMatchCandidate[];
  ambiguous: boolean;
};

export type TeamMappingAction = "mapped_existing" | "create_on_import";

type TeamRecord = {
  id: string;
  name: string;
  programId: string | null;
  program: {
    id: string;
    fullName: string;
    abbreviation: string | null;
    aliases: unknown;
  } | null;
};

type ProgramRecord = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  aliases: unknown;
  teams: Array<{ id: string; name: string }>;
};

type TeamMatchDbContext = {
  teams: TeamRecord[];
  programs: ProgramRecord[];
  externalAliases: Map<string, TeamExternalAliasRecord>;
};

function aliasesToStrings(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function programKeyFromName(value: string) {
  return normalizeProgramAlias(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-program";
}

export function importProgramIdentity(submittedTeamName: string, leagueName: string): ProgramIdentity {
  if (isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName))) {
    const teamProgramName = getTeamDisplayName(submittedTeamName);
    return {
      programKey: programKeyFromName(teamProgramName),
      programFullName: teamProgramName,
      programAbbreviation: teamProgramName,
      programType: "Club / Team",
      teamDisplayName: teamProgramName,
      normalizedAlias: normalizeProgramAlias(teamProgramName)
    };
  }

  return resolveProgramIdentity(submittedTeamName);
}

export function teamDisplayMatchKey(value: string) {
  return normalizeProgramAlias(getTeamDisplayName(value));
}

export function externalTeamAliasKey(externalLabel: string) {
  return normalizeExternalTeamLabel(externalLabel);
}

function allowProgramDisplayTeamMatch(leagueName: string) {
  return isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName));
}

function resolveScheduleLabel(input: TeamMatchInput) {
  return (input.scheduleLabel ?? input.fullScheduleLabel ?? "").trim() || null;
}

export function resolveTeamMatchingInput(externalLabel: string, scheduleLabel?: string | null) {
  const schedule = scheduleLabel?.trim();
  const external = externalLabel.trim();
  return schedule || external || "Unknown team";
}

export function inferTeamCreationPreview(input: {
  externalLabel: string;
  scheduleLabel?: string | null;
  matchingInput: string;
  leagueName: string;
  ageGroup: AgeGroup;
  gender: PlayerGender;
}): TeamCreationPreview {
  const scheduleLabel = input.scheduleLabel?.trim() || null;
  const labelSource = scheduleLabel || input.matchingInput.trim() || input.externalLabel.trim();
  const identity = importProgramIdentity(labelSource, input.leagueName);
  const pybc = allowProgramDisplayTeamMatch(input.leagueName);
  const suggestedProgramName = pybc ? getTeamDisplayName(labelSource) : identity.programFullName;
  const suggestedTeamName = pybc
    ? labelSource
    : getUaapInternalTeamName(labelSource, input.ageGroup, input.gender);

  return {
    externalLabel: input.externalLabel,
    scheduleLabel,
    suggestedProgramName,
    suggestedTeamName,
    suggestedAgeGroup: input.ageGroup,
    suggestedGender: input.gender === PlayerGender.GIRLS ? "GIRLS" : "BOYS"
  };
}

/** Strip youth/club suffixes and normalize punctuation before fuzzy scoring. */
export function normalizeTeamMatchingInput(value: string) {
  let normalized = value
    .trim()
    .replace(/[`’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s'/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stripPatterns = [
    /\b(?:13|15|16|18)\s*u\b/gi,
    /\bu\s*(?:13|15|16|18)\b/gi,
    /\bbasketball\s+club\b/gi,
    /\bbasketball\b/gi,
    /\bbc\b/gi
  ];

  for (const pattern of stripPatterns) {
    normalized = normalized.replace(pattern, " ");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function normalizedMatchKey(value: string) {
  return normalizeProgramAlias(normalizeTeamMatchingInput(value));
}

function normalizeName(value: string) {
  return normalizeTeamMatchingInput(value).replace(/\s+/g, " ").toUpperCase();
}

function tokenSet(value: string) {
  return new Set(
    normalizedMatchKey(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
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
  const leftKey = normalizedMatchKey(left);
  const rightKey = normalizedMatchKey(right);
  if (leftKey && rightKey && (leftKey.includes(rightKey) || rightKey.includes(leftKey))) {
    return Math.max(tokenScore, 0.9);
  }
  return tokenScore;
}

function confidenceBandFromScore(score: number, ambiguous: boolean): TeamConfidenceBand {
  if (ambiguous) return "Review Needed";
  if (score >= 95) return "Exact";
  if (score >= 85) return "Strong Match";
  if (score >= 50) return "Review Needed";
  return "Unmatched";
}

function isAmbiguous(candidates: TeamMatchCandidate[]) {
  if (candidates.length < 2) return false;
  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const topScore = sorted[0].score;
  const closeCandidates = sorted.filter((candidate) => topScore - candidate.score <= 5);
  const closeTeamIds = new Set(closeCandidates.map((candidate) => candidate.teamId));
  if (closeTeamIds.size <= 1) return false;
  if (topScore >= 95 && topScore - sorted[1].score >= 8) return false;
  return true;
}

const TIER_PRIORITY: Record<TeamMatchTier, number> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
  T5: 5,
  T6: 6,
  none: 99
};

function pushCandidate(
  bucket: Map<string, TeamMatchCandidate>,
  candidate: TeamMatchCandidate
) {
  const existing = bucket.get(candidate.teamId);
  if (!existing) {
    bucket.set(candidate.teamId, candidate);
    return;
  }

  const existingTier = TIER_PRIORITY[existing.tier];
  const candidateTier = TIER_PRIORITY[candidate.tier];
  if (candidate.score > existing.score || (candidate.score === existing.score && candidateTier < existingTier)) {
    bucket.set(candidate.teamId, candidate);
  }
}

function collectProgramIdentityCandidates(
  matchingInput: string,
  input: TeamMatchInput,
  db: TeamMatchDbContext,
  bucket: Map<string, TeamMatchCandidate>
) {
  const identity = importProgramIdentity(matchingInput, input.leagueName);
  const program =
    db.programs.find((item) => item.fullName === identity.programFullName) ??
    db.programs.find((item) => normalizeName(item.fullName) === normalizeName(identity.programFullName)) ??
    db.programs.find((item) => normalizedMatchKey(item.fullName) === normalizedMatchKey(identity.programFullName));

  if (!program) return;

  const primaryTeam =
    program.teams.find((team) => normalizeName(team.name) === normalizeName(program.fullName)) ??
    program.teams.find((team) => normalizedMatchKey(team.name) === normalizedMatchKey(program.fullName));

  if (primaryTeam) {
    pushCandidate(bucket, {
      teamId: primaryTeam.id,
      teamName: primaryTeam.name,
      programId: program.id,
      programName: program.fullName,
      score: 96,
      tier: "T2",
      method: "program_primary_team"
    });
  }

  const ageToken = input.ageGroup.toUpperCase();
  const genderToken = input.gender === PlayerGender.GIRLS ? "GIRLS" : "BOYS";
  const contextualTeam = program.teams.find((team) => {
    const normalizedTeamName = normalizeName(team.name);
    return normalizedTeamName.includes(ageToken) && normalizedTeamName.includes(genderToken);
  });

  if (contextualTeam) {
    pushCandidate(bucket, {
      teamId: contextualTeam.id,
      teamName: contextualTeam.name,
      programId: program.id,
      programName: program.fullName,
      score: 98,
      tier: "T1",
      method: "program_age_gender_team"
    });
  } else if (program.teams.length === 1) {
    const team = program.teams[0];
    pushCandidate(bucket, {
      teamId: team.id,
      teamName: team.name,
      programId: program.id,
      programName: program.fullName,
      score: 94,
      tier: "T2",
      method: "program_single_team"
    });
  }
}

function collectScheduleExactCandidates(
  scheduleLabel: string,
  matchingInput: string,
  input: TeamMatchInput,
  db: TeamMatchDbContext,
  bucket: Map<string, TeamMatchCandidate>
) {
  const scheduleKey = teamDisplayMatchKey(scheduleLabel);
  const scheduleAliasKey = normalizedMatchKey(scheduleLabel);
  const matchingKey = normalizedMatchKey(matchingInput);

  for (const team of db.teams) {
    if (normalizeName(team.name) === normalizeName(scheduleLabel) || normalizedMatchKey(team.name) === matchingKey) {
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: team.programId,
        programName: team.program?.fullName ?? null,
        score: 100,
        tier: "T0",
        method: "schedule_exact_team_name"
      });
    } else if (teamDisplayMatchKey(team.name) === scheduleKey) {
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: team.programId,
        programName: team.program?.fullName ?? null,
        score: 100,
        tier: "T0",
        method: "schedule_display_key"
      });
    } else if (normalizedMatchKey(team.name) === scheduleAliasKey) {
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: team.programId,
        programName: team.program?.fullName ?? null,
        score: 99,
        tier: "T0",
        method: "schedule_normalized_team_name"
      });
    }
  }

  for (const program of db.programs) {
    const programKey = normalizedMatchKey(program.fullName);
    const programMatches =
      normalizeName(program.fullName) === normalizeName(scheduleLabel) ||
      normalizeName(program.fullName) === normalizeName(matchingInput) ||
      programKey === scheduleAliasKey ||
      programKey === matchingKey;

    if (!programMatches) continue;

    const primaryTeam =
      program.teams.find((team) => normalizeName(team.name) === normalizeName(program.fullName)) ??
      program.teams.find((team) => normalizedMatchKey(team.name) === normalizedMatchKey(program.fullName));
    const ageToken = input.ageGroup.toUpperCase();
    const genderToken = input.gender === PlayerGender.GIRLS ? "GIRLS" : "BOYS";
    const contextualTeam = program.teams.find((team) => {
      const normalizedTeamName = normalizeName(team.name);
      return normalizedTeamName.includes(ageToken) && normalizedTeamName.includes(genderToken);
    });
    const teamsToAdd =
      program.teams.length === 1
        ? program.teams
        : [primaryTeam, contextualTeam].filter((team): team is (typeof program.teams)[number] => Boolean(team));

    for (const team of teamsToAdd) {
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: program.id,
        programName: program.fullName,
        score: 100,
        tier: "T0",
        method: "schedule_exact_program_name"
      });
    }
  }

  if (allowProgramDisplayTeamMatch(input.leagueName)) {
    const scheduleIdentity = importProgramIdentity(matchingInput, input.leagueName);
    const program =
      db.programs.find((item) => item.fullName === scheduleIdentity.programFullName) ??
      db.programs.find((item) => normalizeName(item.fullName) === normalizeName(scheduleIdentity.programFullName)) ??
      db.programs.find((item) => normalizedMatchKey(item.fullName) === normalizedMatchKey(scheduleIdentity.programFullName));

    if (program) {
      for (const team of program.teams) {
        if (teamDisplayMatchKey(team.name) === scheduleKey || normalizedMatchKey(team.name) === matchingKey) {
          pushCandidate(bucket, {
            teamId: team.id,
            teamName: team.name,
            programId: program.id,
            programName: program.fullName,
            score: 100,
            tier: "T0",
            method: "schedule_program_display_key"
          });
        }
      }
    }
  }
}

function collectLabelCandidates(
  label: string,
  input: TeamMatchInput,
  db: TeamMatchDbContext,
  bucket: Map<string, TeamMatchCandidate>,
  options: { fromSchedule: boolean; scorePenalty?: number }
) {
  const identity = importProgramIdentity(label, input.leagueName);
  const internalTeamName = getUaapInternalTeamName(label, input.ageGroup, input.gender);
  const submittedKey = teamDisplayMatchKey(label);
  const normalizedLabelKey = normalizedMatchKey(label);
  const methodPrefix = options.fromSchedule ? "schedule_" : "fiba_";
  const penalty = options.scorePenalty ?? 0;

  for (const team of db.teams) {
    if (team.name === internalTeamName) {
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: team.programId,
        programName: team.program?.fullName ?? null,
        score: (options.fromSchedule ? 98 : 100) - penalty,
        tier: "T1",
        method: `${methodPrefix}exact_internal_team_name`
      });
    }
  }

  if (allowProgramDisplayTeamMatch(input.leagueName)) {
    const program =
      db.programs.find((item) => item.fullName === identity.programFullName) ??
      db.programs.find((item) => normalizeName(item.fullName) === normalizeName(identity.programFullName)) ??
      db.programs.find((item) => normalizedMatchKey(item.fullName) === normalizedMatchKey(identity.programFullName));

    if (program) {
      for (const team of program.teams) {
        if (teamDisplayMatchKey(team.name) === submittedKey || normalizedMatchKey(team.name) === normalizedLabelKey) {
          pushCandidate(bucket, {
            teamId: team.id,
            teamName: team.name,
            programId: program.id,
            programName: program.fullName,
            score: (options.fromSchedule ? 94 : 92) - penalty,
            tier: "T2",
            method: `${methodPrefix}program_display_key`
          });
        }
      }
    }
  }

  for (const team of db.teams) {
    if (normalizeName(team.name) === normalizeName(label) || normalizedMatchKey(team.name) === normalizedLabelKey) {
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: team.programId,
        programName: team.program?.fullName ?? null,
        score: (options.fromSchedule ? 93 : 90) - penalty,
        tier: "T3",
        method: `${methodPrefix}exact_team_name`
      });
    }
  }

  for (const program of db.programs) {
    const aliasValues = [
      program.fullName,
      program.abbreviation ?? "",
      ...aliasesToStrings(program.aliases)
    ].filter(Boolean);

    const aliasHit = aliasValues.some((alias) => {
      const normalizedAlias = normalizedMatchKey(alias);
      return normalizedAlias === submittedKey || normalizedAlias === normalizedLabelKey;
    });

    if (aliasHit) {
      for (const team of program.teams) {
        pushCandidate(bucket, {
          teamId: team.id,
          teamName: team.name,
          programId: program.id,
          programName: program.fullName,
          score: (options.fromSchedule ? 87 : 85) - penalty,
          tier: "T4",
          method: `${methodPrefix}program_alias`
        });
      }
    }
  }

  for (const program of db.programs) {
    if (
      normalizeName(program.fullName) !== normalizeName(identity.programFullName) &&
      normalizedMatchKey(program.fullName) !== normalizedMatchKey(identity.programFullName)
    ) {
      continue;
    }
    if (program.teams.length === 1) {
      const team = program.teams[0];
      pushCandidate(bucket, {
        teamId: team.id,
        teamName: team.name,
        programId: program.id,
        programName: program.fullName,
        score: (options.fromSchedule ? 77 : 75) - penalty,
        tier: "T5",
        method: `${methodPrefix}single_team_program`
      });
    }
  }

  for (const team of db.teams) {
    const comparisons = [
      { target: team.name, label: "team_name" },
      { target: team.program?.fullName ?? "", label: "program_full_name" },
      { target: team.program?.abbreviation ?? "", label: "program_abbreviation" }
    ];

    for (const comparison of comparisons) {
      if (!comparison.target) continue;
      const similarity = fuzzySimilarity(label, comparison.target);
      if (similarity >= 0.85) {
        pushCandidate(bucket, {
          teamId: team.id,
          teamName: team.name,
          programId: team.programId,
          programName: team.program?.fullName ?? null,
          score: (similarity >= 0.92 ? (options.fromSchedule ? 70 : 68) : options.fromSchedule ? 57 : 55) - penalty,
          tier: "T6",
          method: `${methodPrefix}fuzzy_${comparison.label}`
        });
      }
    }
  }
}

export async function loadTeamMatchDbContext(provider: StatsImportProviderId = "statshub-v1"): Promise<TeamMatchDbContext> {
  const [teams, programs, externalAliases] = await Promise.all([
    prisma.team.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        programId: true,
        program: {
          select: {
            id: true,
            fullName: true,
            abbreviation: true,
            aliases: true
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.program.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        abbreviation: true,
        aliases: true,
        teams: {
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { fullName: "asc" }
    }),
    loadTeamExternalAliasMap(provider)
  ]);

  return { teams, programs, externalAliases };
}

function resolveSavedTeamAlias(
  input: TeamMatchInput,
  db: TeamMatchDbContext
): Pick<TeamMatchCandidate, "teamId" | "teamName" | "programName"> | null {
  const labels = [input.externalLabel.trim()];
  const scheduleLabel = resolveScheduleLabel(input);
  if (
    scheduleLabel &&
    normalizeExternalTeamLabel(scheduleLabel) !== normalizeExternalTeamLabel(input.externalLabel)
  ) {
    labels.push(scheduleLabel);
  }

  for (const label of labels) {
    const alias = db.externalAliases.get(normalizeExternalTeamLabel(label));
    if (!alias) continue;

    const team = db.teams.find((item) => item.id === alias.teamId);
    if (!team) continue;

    return {
      teamId: team.id,
      teamName: team.name,
      programName: team.program?.fullName ?? null
    };
  }

  return null;
}

export function matchExternalTeam(input: TeamMatchInput, db: TeamMatchDbContext): TeamMatchResult {
  const externalLabel = input.externalLabel.trim();
  const scheduleLabel = resolveScheduleLabel(input);
  const matchingInput = resolveTeamMatchingInput(externalLabel, scheduleLabel);
  const aliasKey = externalTeamAliasKey(externalLabel);
  const identity = importProgramIdentity(matchingInput, input.leagueName);

  const savedTeam = resolveSavedTeamAlias(input, db);
  if (savedTeam) {
    const savedCandidate: TeamMatchCandidate = {
      teamId: savedTeam.teamId,
      teamName: savedTeam.teamName,
      programId: null,
      programName: savedTeam.programName,
      score: 100,
      tier: "T0",
      method: "saved_alias"
    };

    return {
      externalLabel,
      aliasKey,
      scheduleLabel,
      matchingInput,
      inferredProgramName: identity.programFullName,
      confidenceBand: "Exact",
      score: 100,
      tier: "T0",
      method: "saved_alias",
      matchReason: "Saved Alias",
      suggestedTeam: savedTeam,
      candidates: [savedCandidate],
      ambiguous: false
    };
  }

  const candidateBucket = new Map<string, TeamMatchCandidate>();

  if (scheduleLabel) {
    collectScheduleExactCandidates(scheduleLabel, matchingInput, input, db, candidateBucket);
  }

  collectProgramIdentityCandidates(matchingInput, input, db, candidateBucket);

  collectLabelCandidates(matchingInput, input, db, candidateBucket, {
    fromSchedule: Boolean(scheduleLabel),
    scorePenalty: 0
  });

  if (scheduleLabel && matchingInput !== externalLabel && externalLabel.length >= 12) {
    collectLabelCandidates(externalLabel, input, db, candidateBucket, {
      fromSchedule: false,
      scorePenalty: 8
    });
  }

  const candidates = Array.from(candidateBucket.values()).sort(
    (left, right) =>
      right.score - left.score ||
      TIER_PRIORITY[left.tier] - TIER_PRIORITY[right.tier] ||
      left.teamName.localeCompare(right.teamName)
  );
  const ambiguous = isAmbiguous(candidates);
  const top = candidates[0] ?? null;
  const score = ambiguous ? Math.min(top?.score ?? 0, 84) : top?.score ?? 0;
  const confidenceBand = confidenceBandFromScore(score, ambiguous);

  return {
    externalLabel,
    aliasKey,
    scheduleLabel,
    matchingInput,
    inferredProgramName: identity.programFullName,
    confidenceBand,
    score,
    tier: top?.tier ?? "none",
    method: ambiguous ? "ambiguous_candidates" : top?.method ?? "no_match",
    suggestedTeam: top && !ambiguous && confidenceBand !== "Unmatched"
      ? { teamId: top.teamId, teamName: top.teamName, programName: top.programName }
      : top && confidenceBand === "Review Needed"
        ? { teamId: top.teamId, teamName: top.teamName, programName: top.programName }
        : null,
    candidates,
    ambiguous
  };
}

/** FIBA-only matching baseline for acceptance metrics. */
export function matchExternalTeamFibaOnly(input: TeamMatchInput, db: TeamMatchDbContext): TeamMatchResult {
  return matchExternalTeam(
    {
      ...input,
      scheduleLabel: null,
      fullScheduleLabel: null
    },
    db
  );
}

export function estimateTeamMatchingCleanupLevel(input: {
  uniqueTeams: number;
  autoResolved: number;
  needsReview: number;
  unmatched: number;
}): "Low" | "Medium" | "High" {
  if (!input.uniqueTeams) return "Low";
  const unresolved = input.needsReview + input.unmatched;
  const unresolvedPercent = (unresolved / input.uniqueTeams) * 100;
  if (unresolvedPercent <= 10) return "Low";
  if (unresolvedPercent <= 30) return "Medium";
  return "High";
}

export function buildTeamMappingAuditNotes(mappings: UrlImportTeamMapping[]) {
  if (!mappings.length) return "";

  const reuseLines: string[] = [];
  const createLines: string[] = [];

  for (const mapping of mappings) {
    if (mapping.action === "mapped_existing" && mapping.teamName) {
      reuseLines.push(`- "${mapping.externalLabel}" → ${mapping.teamName} (reuse)`);
      continue;
    }
    if (mapping.action === "create_on_import") {
      const teamLabel = mapping.suggestedTeamName ?? mapping.scheduleLabel ?? mapping.externalLabel;
      if (mapping.suggestedProgramName) {
        createLines.push(`- ${teamLabel} (program: ${mapping.suggestedProgramName})`);
      } else {
        createLines.push(`- ${teamLabel}`);
      }
    }
  }

  const sections: string[] = [];
  if (reuseLines.length) {
    sections.push(["Team mappings (StatsHub URL import):", ...reuseLines].join("\n"));
  }
  if (createLines.length) {
    sections.push(["Teams to create:", ...createLines].join("\n"));
  }
  return sections.join("\n\n");
}

export function applyTeamMappingsToPackageDraft(
  packageDraft: {
    games: Array<{
      homeTeamName: string;
      awayTeamName: string;
      homeScore: number;
      awayScore: number;
      game: string;
      players: Array<Record<string, string | number>>;
    }>;
  },
  mappings: UrlImportTeamMapping[]
) {
  const byExternalLabel = new Map(mappings.map((mapping) => [mapping.externalLabel, mapping]));

  for (const game of packageDraft.games) {
    for (const side of ["homeTeamName", "awayTeamName"] as const) {
      const externalLabel = game[side];
      const mapping = byExternalLabel.get(externalLabel);
      if (!mapping || mapping.action !== "mapped_existing" || !mapping.teamName) continue;

      const canonicalName = mapping.teamName;
      game[side] = canonicalName;
      for (const player of game.players) {
        if (player.team === externalLabel) player.team = canonicalName;
      }
    }

    game.game = `${game.homeTeamName} ${game.homeScore} - ${game.awayScore} ${game.awayTeamName}`;
  }
}
