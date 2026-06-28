import { ProgramType } from "@prisma/client";
import { getUaapSchoolDisplayName } from "./uaap-school-display";

export type ProgramRef = {
  id?: string;
  fullName?: string | null;
  abbreviation?: string | null;
  type?: ProgramType | null;
} | null | undefined;

export type TeamAffiliationRef = {
  name: string;
  program?: ProgramRef;
} | null | undefined;

export type GameStatAffiliationRef = {
  team: TeamAffiliationRef;
  game?: { gameDate?: Date | string | null } | null;
};

export type RosterAffiliationRef = {
  team: TeamAffiliationRef;
};

export function isSchoolProgramType(type: ProgramType | null | undefined) {
  return type === ProgramType.SCHOOL;
}

export function formatProgramTypeLabel(type: ProgramType | null | undefined) {
  switch (type) {
    case ProgramType.SCHOOL:
      return "School";
    case ProgramType.CLUB:
      return "Club";
    case ProgramType.TEAM:
      return "Team";
    default:
      return "Program";
  }
}

function programLabel(program: ProgramRef) {
  return program?.fullName?.trim() || program?.abbreviation?.trim() || null;
}

function teamLabel(team: TeamAffiliationRef) {
  if (!team) return null;
  return programLabel(team.program) || getUaapSchoolDisplayName(team.name) || team.name?.trim() || null;
}

function gameDateValue(game?: { gameDate?: Date | string | null } | null) {
  if (!game?.gameDate) return 0;
  const value = game.gameDate instanceof Date ? game.gameDate.getTime() : new Date(game.gameDate).getTime();
  return Number.isNaN(value) ? 0 : value;
}

type AffiliationScore = {
  label: string;
  count: number;
  latest: number;
  isSchool: boolean;
};

function scoreAffiliations(
  gameStats: GameStatAffiliationRef[] | null | undefined,
  filter: (programType: ProgramType | null | undefined) => boolean
) {
  const scores = new Map<string, AffiliationScore>();

  for (const stat of gameStats ?? []) {
    const program = stat.team?.program;
    if (!filter(program?.type ?? null)) continue;

    const label = teamLabel(stat.team);
    if (!label) continue;

    const latest = gameDateValue(stat.game);
    const existing = scores.get(label);
    if (!existing) {
      scores.set(label, {
        label,
        count: 1,
        latest,
        isSchool: isSchoolProgramType(program?.type)
      });
      continue;
    }

    existing.count += 1;
    if (latest > existing.latest) existing.latest = latest;
  }

  return [...scores.values()].sort((left, right) => right.count - left.count || right.latest - left.latest);
}

export function resolveSchoolDisplay(input: {
  schoolOverride?: string | null;
  currentProgram?: ProgramRef;
  gameStats?: GameStatAffiliationRef[] | null;
}): string | null {
  const override = input.schoolOverride?.trim();
  if (override) return override;

  if (input.currentProgram && isSchoolProgramType(input.currentProgram.type)) {
    return programLabel(input.currentProgram);
  }

  const schoolFromStats = scoreAffiliations(input.gameStats, isSchoolProgramType)[0]?.label ?? null;
  return schoolFromStats;
}

export function resolveMostActiveAffiliationDisplay(gameStats: GameStatAffiliationRef[] | null | undefined) {
  return scoreAffiliations(gameStats, () => true)[0]?.label ?? null;
}

/** Primary label for rankings and public lists: school first, else most active team/club. */
export function resolvePrimaryRankingAffiliation(input: {
  schoolOverride?: string | null;
  currentProgram?: ProgramRef;
  gameStats?: GameStatAffiliationRef[] | null;
}): string {
  return (
    resolveSchoolDisplay(input) ||
    resolveMostActiveAffiliationDisplay(input.gameStats) ||
    (input.currentProgram ? programLabel(input.currentProgram) : null) ||
    "Program pending"
  );
}

export function inferSchoolProgramIdFromEvidence(input: {
  gameStats: Array<{ team: { program?: ProgramRef | null } | null }>;
  rosterSeasons?: Array<{ team: { program?: ProgramRef | null } | null }>;
}): string | null {
  const counts = new Map<string, { programId: string; count: number }>();

  const bump = (program: ProgramRef) => {
    if (!program?.id || !isSchoolProgramType(program.type)) return;
    const existing = counts.get(program.id);
    if (!existing) counts.set(program.id, { programId: program.id, count: 1 });
    else existing.count += 1;
  };

  for (const stat of input.gameStats) bump(stat.team?.program);
  for (const roster of input.rosterSeasons ?? []) bump(roster.team?.program);

  const ranked = [...counts.values()].sort((left, right) => right.count - left.count);
  return ranked[0]?.programId ?? null;
}
