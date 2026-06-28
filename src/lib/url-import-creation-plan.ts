import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import type {
  ImportProgramCreationCandidate,
  ImportTeamCreationCandidate,
  TeamMatchPreviewRow,
  UrlImportCreationPlan,
  UrlImportTeamMapping
} from "@/lib/stats-import/types";
import { importProgramIdentity, teamDisplayMatchKey } from "@/lib/team-import-matching";
import { normalizeProgramAlias } from "@/lib/uaap-school-display";

function teamCreationKey(programKey: string, teamName: string, leagueName: string) {
  if (isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName))) {
    return teamDisplayMatchKey(teamName);
  }
  return `${programKey}::${normalizeProgramAlias(teamName)}`;
}

function formatAgeGroupDisplay(ageGroup: string) {
  const match = ageGroup.match(/^U(\d+)$/i);
  return match ? `${match[1]}U` : ageGroup;
}

function formatGenderDisplay(gender: "BOYS" | "GIRLS") {
  return gender === "GIRLS" ? "Girls" : "Boys";
}

export function buildImportCreationPlan(input: {
  mappings: UrlImportTeamMapping[];
  teamRows: TeamMatchPreviewRow[];
  leagueName: string;
  ageGroup: string;
  gender: "BOYS" | "GIRLS";
}): UrlImportCreationPlan {
  const rowByAlias = new Map(input.teamRows.map((row) => [row.aliasKey, row]));
  const createMappings = input.mappings.filter((mapping) => mapping.action === "create_on_import");

  const programBuckets = new Map<string, ImportProgramCreationCandidate>();
  const flatTeams: ImportTeamCreationCandidate[] = [];
  const affectedMatchIds = new Set<string>();

  for (const mapping of createMappings) {
    const row = rowByAlias.get(mapping.aliasKey);
    const programName = mapping.suggestedProgramName ?? row?.creationPreview.suggestedProgramName ?? mapping.externalLabel;
    const teamName = mapping.suggestedTeamName ?? row?.creationPreview.suggestedTeamName ?? mapping.externalLabel;
    const ageGroup = mapping.suggestedAgeGroup ?? row?.creationPreview.suggestedAgeGroup ?? input.ageGroup;
    const gender = mapping.suggestedGender ?? row?.creationPreview.suggestedGender ?? input.gender;
    const identity = importProgramIdentity(programName, input.leagueName);
    const programKey = identity.programKey;
    const teamKey = teamCreationKey(programKey, teamName, input.leagueName);
    const matchIds = row?.matchIds ?? [];
    const gameCount = row?.gameCount ?? matchIds.length;

    for (const matchId of matchIds) affectedMatchIds.add(matchId);

    const sourceMapping = {
      aliasKey: mapping.aliasKey,
      externalLabel: mapping.externalLabel,
      scheduleLabel: mapping.scheduleLabel ?? row?.scheduleLabel ?? null,
      matchIds,
      gameCount
    };

    let program = programBuckets.get(programKey);
    if (!program) {
      program = {
        programKey,
        suggestedProgramName: programName,
        suggestedProgramType: identity.programType,
        suggestedAbbreviation: identity.programAbbreviation,
        normalizedAlias: identity.normalizedAlias,
        teams: []
      };
      programBuckets.set(programKey, program);
    }

    const existingTeam = program.teams.find((team) => team.teamKey === teamKey);
    if (existingTeam) {
      existingTeam.sourceMappings.push(sourceMapping);
      existingTeam.gameCount = Math.max(existingTeam.gameCount, gameCount);
      continue;
    }

    const teamCandidate: ImportTeamCreationCandidate = {
      teamKey,
      suggestedTeamName: teamName,
      suggestedAgeGroup: ageGroup,
      suggestedGender: gender,
      gameCount,
      sourceMappings: [sourceMapping]
    };
    program.teams.push(teamCandidate);
    flatTeams.push(teamCandidate);
  }

  const programs = Array.from(programBuckets.values()).sort((left, right) =>
    left.suggestedProgramName.localeCompare(right.suggestedProgramName)
  );

  return {
    version: 1,
    leagueName: input.leagueName,
    ageGroup: input.ageGroup,
    gender: input.gender,
    generatedAt: new Date().toISOString(),
    programs,
    teams: flatTeams.sort((left, right) => left.suggestedTeamName.localeCompare(right.suggestedTeamName)),
    summary: {
      programCount: programs.length,
      teamCount: flatTeams.length,
      gamesAffected: affectedMatchIds.size
    }
  };
}

export function creationPlanToExportJson(plan: UrlImportCreationPlan) {
  return {
    programs: plan.programs.map((program) => ({
      programKey: program.programKey,
      suggestedProgramName: program.suggestedProgramName,
      suggestedProgramType: program.suggestedProgramType,
      suggestedAbbreviation: program.suggestedAbbreviation,
      normalizedAlias: program.normalizedAlias,
      teams: program.teams.map((team) => ({
        teamKey: team.teamKey,
        suggestedTeamName: team.suggestedTeamName,
        suggestedAgeGroup: team.suggestedAgeGroup,
        suggestedGender: team.suggestedGender,
        gameCount: team.gameCount,
        sourceMappings: team.sourceMappings
      }))
    })),
    teams: plan.teams.map((team) => ({
      teamKey: team.teamKey,
      suggestedTeamName: team.suggestedTeamName,
      suggestedAgeGroup: team.suggestedAgeGroup,
      suggestedGender: team.suggestedGender,
      gameCount: team.gameCount,
      sourceMappings: team.sourceMappings
    }))
  };
}

export function creationPlanToMarkdown(plan: UrlImportCreationPlan) {
  const lines = [
    `# URL Import Creation Plan`,
    ``,
    `League: ${plan.leagueName}`,
    `Age group: ${formatAgeGroupDisplay(plan.ageGroup)}`,
    `Gender: ${formatGenderDisplay(plan.gender)}`,
    `Generated: ${plan.generatedAt}`,
    ``,
    `## Summary`,
    ``,
    `- Programs to create: ${plan.summary.programCount}`,
    `- Teams to create: ${plan.summary.teamCount}`,
    `- Games affected: ${plan.summary.gamesAffected}`,
    ``
  ];

  if (!plan.programs.length) {
    lines.push(`No missing organizations.`);
    return lines.join("\n");
  }

  lines.push(`## Programs and teams`, ``);

  for (const program of plan.programs) {
    lines.push(`### ${program.suggestedProgramName}`, ``);
    for (const team of program.teams) {
      lines.push(
        `- **${team.suggestedTeamName}** · ${formatAgeGroupDisplay(team.suggestedAgeGroup)} ${formatGenderDisplay(team.suggestedGender)} · ${team.gameCount} game${team.gameCount === 1 ? "" : "s"}`
      );
    }
    lines.push(``);
  }

  return lines.join("\n");
}

export function buildMissingOrganizationsAuditNotes(plan: UrlImportCreationPlan) {
  if (!plan.programs.length) return "";

  const lines = [
    "Missing organizations:",
    `Programs: ${plan.summary.programCount} | Teams: ${plan.summary.teamCount} | Games affected: ${plan.summary.gamesAffected}`,
    ""
  ];

  for (const program of plan.programs) {
    lines.push(`- Program: ${program.suggestedProgramName}`);
    for (const team of program.teams) {
      lines.push(
        `  - Team: ${team.suggestedTeamName} (${formatAgeGroupDisplay(team.suggestedAgeGroup)} ${formatGenderDisplay(team.suggestedGender)}, ${team.gameCount} game${team.gameCount === 1 ? "" : "s"})`
      );
    }
  }

  return lines.join("\n");
}
