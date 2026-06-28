import { ProgramType, type Prisma } from "@prisma/client";
import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "@/lib/competition-naming";
import { prisma } from "@/lib/prisma";
import type {
  ImportProgramCreationCandidate,
  ImportTeamCreationCandidate,
  OrganizationCreationPreview,
  OrganizationCreationResult,
  UrlImportCreationPlan
} from "@/lib/stats-import/types";
import { teamDisplayMatchKey } from "@/lib/team-import-matching";
import { labelsForExternalAlias, upsertTeamExternalAliasBatch } from "@/lib/team-external-alias";
import { getUaapInternalTeamName, normalizeProgramAlias } from "@/lib/uaap-school-display";

const PROVIDER = "statshub-v1" as const;

type ProgramRecord = {
  id: string;
  fullName: string;
};

type TeamRecord = {
  id: string;
  name: string;
  programId: string | null;
};

function programTypeFromLabel(value: "School" | "Club / Team"): ProgramType {
  if (value === "School") return ProgramType.SCHOOL;
  if (value === "Club / Team") return ProgramType.CLUB;
  return ProgramType.UNKNOWN;
}

function resolveTeamNameForCreation(team: ImportTeamCreationCandidate, leagueName: string) {
  if (isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName))) {
    return team.suggestedTeamName.trim();
  }
  return getUaapInternalTeamName(team.suggestedTeamName, team.suggestedAgeGroup, team.suggestedGender);
}

function findProgramByName(programs: ProgramRecord[], fullName: string) {
  const normalized = normalizeProgramAlias(fullName);
  return (
    programs.find((program) => program.fullName === fullName) ??
    programs.find((program) => normalizeProgramAlias(program.fullName) === normalized) ??
    null
  );
}

function findTeamUnderProgram(
  teams: TeamRecord[],
  programId: string,
  resolvedTeamName: string,
  submittedTeamName: string,
  leagueName: string
) {
  const exact = teams.find((team) => team.programId === programId && team.name === resolvedTeamName);
  if (exact) return exact;

  if (!isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName))) {
    return null;
  }

  const submittedKey = teamDisplayMatchKey(submittedTeamName);
  const matches = teams.filter(
    (team) => team.programId === programId && teamDisplayMatchKey(team.name) === submittedKey
  );
  if (matches.length === 1) return matches[0];
  return null;
}

function buildConfirmationPhrase(programCount: number, teamCount: number) {
  const programLabel = programCount === 1 ? "Program" : "Programs";
  const teamLabel = teamCount === 1 ? "Team" : "Teams";
  return `Create ${programCount} ${programLabel} and ${teamCount} ${teamLabel}`;
}

export function buildOrganizationCreationAuditNotes(input: {
  programsCreated: string[];
  teamsCreated: string[];
}) {
  if (!input.programsCreated.length && !input.teamsCreated.length) return "";

  const lines = ["Organizations created from URL Import:", ""];
  for (const name of input.programsCreated) lines.push(`- Program ${name}`);
  for (const name of input.teamsCreated) lines.push(`- Team ${name}`);
  return lines.join("\n");
}

export async function previewMissingOrganizationsFromImport(
  plan: UrlImportCreationPlan
): Promise<OrganizationCreationPreview> {
  if (!plan?.programs?.length) {
    return {
      programsToCreate: [],
      teamsToCreate: [],
      programsSkipped: [],
      teamsSkipped: [],
      summary: {
        programsToCreate: 0,
        teamsToCreate: 0,
        programsSkipped: 0,
        teamsSkipped: 0
      },
      confirmationPhrase: buildConfirmationPhrase(0, 0)
    };
  }

  const [programs, teams] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true }
    }),
    prisma.team.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, programId: true }
    })
  ]);

  const programsToCreate: OrganizationCreationPreview["programsToCreate"] = [];
  const teamsToCreate: OrganizationCreationPreview["teamsToCreate"] = [];
  const programsSkipped: OrganizationCreationPreview["programsSkipped"] = [];
  const teamsSkipped: OrganizationCreationPreview["teamsSkipped"] = [];

  for (const program of plan.programs) {
    const existingProgram = findProgramByName(programs, program.suggestedProgramName);
    if (existingProgram) {
      programsSkipped.push({
        kind: "program",
        name: program.suggestedProgramName,
        existingId: existingProgram.id,
        reason: "Program already exists"
      });
    } else {
      programsToCreate.push({
        programKey: program.programKey,
        suggestedProgramName: program.suggestedProgramName,
        suggestedProgramType: program.suggestedProgramType,
        teamCount: program.teams.length
      });
    }

    const programId = existingProgram?.id ?? null;
    for (const team of program.teams) {
      const resolvedTeamName = resolveTeamNameForCreation(team, plan.leagueName);
      const existingTeam =
        programId &&
        findTeamUnderProgram(teams, programId, resolvedTeamName, team.suggestedTeamName, plan.leagueName);

      if (existingTeam) {
        teamsSkipped.push({
          kind: "team",
          name: resolvedTeamName,
          programName: program.suggestedProgramName,
          existingId: existingTeam.id,
          reason: "Team already exists under program"
        });
        continue;
      }

      teamsToCreate.push({
        teamKey: team.teamKey,
        suggestedTeamName: team.suggestedTeamName,
        suggestedProgramName: program.suggestedProgramName,
        suggestedAgeGroup: team.suggestedAgeGroup,
        suggestedGender: team.suggestedGender,
        resolvedTeamName
      });
    }
  }

  return {
    programsToCreate,
    teamsToCreate,
    programsSkipped,
    teamsSkipped,
    summary: {
      programsToCreate: programsToCreate.length,
      teamsToCreate: teamsToCreate.length,
      programsSkipped: programsSkipped.length,
      teamsSkipped: teamsSkipped.length
    },
    confirmationPhrase: buildConfirmationPhrase(programsToCreate.length, teamsToCreate.length)
  };
}

async function findOrCreateProgramInTx(
  tx: Prisma.TransactionClient,
  program: ImportProgramCreationCandidate,
  location: { city: string; region: string },
  programCache: Map<string, ProgramRecord>
) {
  const cached = programCache.get(program.suggestedProgramName);
  if (cached) return { program: cached, created: false };

  const existing = await tx.program.findFirst({
    where: { fullName: program.suggestedProgramName, deletedAt: null },
    select: { id: true, fullName: true }
  });
  if (existing) {
    programCache.set(program.suggestedProgramName, existing);
    return { program: existing, created: false };
  }

  const created = await tx.program.create({
    data: {
      fullName: program.suggestedProgramName,
      abbreviation: program.suggestedAbbreviation || null,
      type: programTypeFromLabel(program.suggestedProgramType),
      city: location.city || null,
      region: location.region || null,
      aliases: [program.normalizedAlias, program.suggestedProgramName, program.suggestedAbbreviation].filter(Boolean)
    },
    select: { id: true, fullName: true }
  });
  programCache.set(program.suggestedProgramName, created);
  return { program: created, created: true };
}

async function findOrCreateTeamInTx(
  tx: Prisma.TransactionClient,
  input: {
    programId: string;
    team: ImportTeamCreationCandidate;
    leagueName: string;
    location: { city: string; region: string };
  }
) {
  const resolvedTeamName = resolveTeamNameForCreation(input.team, input.leagueName);
  const existing = await tx.team.findFirst({
    where: {
      deletedAt: null,
      programId: input.programId,
      name: resolvedTeamName
    },
    select: { id: true, name: true, programId: true }
  });
  if (existing) return { team: existing, created: false, resolvedTeamName };

  if (isPybcCompetitionName(normalizeCompetitionDisplayName(input.leagueName))) {
    const submittedKey = teamDisplayMatchKey(input.team.suggestedTeamName);
    const programTeams = await tx.team.findMany({
      where: { deletedAt: null, programId: input.programId },
      select: { id: true, name: true, programId: true }
    });
    const equivalent = programTeams.filter((team) => teamDisplayMatchKey(team.name) === submittedKey);
    if (equivalent.length === 1) {
      return { team: equivalent[0], created: false, resolvedTeamName };
    }
  }

  const created = await tx.team.create({
    data: {
      name: resolvedTeamName,
      city: input.location.city,
      region: input.location.region,
      programId: input.programId
    },
    select: { id: true, name: true, programId: true }
  });
  return { team: created, created: true, resolvedTeamName };
}

export async function createMissingOrganizationsFromImport(input: {
  plan: UrlImportCreationPlan;
  city?: string;
  region?: string;
}): Promise<OrganizationCreationResult> {
  const preview = await previewMissingOrganizationsFromImport(input.plan);
  if (!preview.summary.programsToCreate && !preview.summary.teamsToCreate) {
    return {
      programsCreated: 0,
      programsReused: preview.summary.programsSkipped,
      teamsCreated: 0,
      teamsReused: preview.summary.teamsSkipped,
      aliasesSaved: 0,
      auditNotes: ""
    };
  }

  const location = {
    city: input.city?.trim() || "Metro Manila",
    region: input.region?.trim() || "NCR"
  };

  const programsCreated: string[] = [];
  const programsReused: string[] = [];
  const teamsCreated: string[] = [];
  const teamsReused: string[] = [];
  const aliasCandidates: Array<{ externalLabel: string; scheduleLabel?: string | null; teamId: string }> = [];

  const summary = await prisma.$transaction(async (tx) => {
    const programCache = new Map<string, ProgramRecord>();
    let programsCreatedCount = 0;
    let programsReusedCount = 0;
    let teamsCreatedCount = 0;
    let teamsReusedCount = 0;
    let aliasesSaved = 0;

    for (const program of input.plan.programs) {
      const programResult = await findOrCreateProgramInTx(tx, program, location, programCache);
      if (programResult.created) {
        programsCreatedCount += 1;
        programsCreated.push(program.suggestedProgramName);
      } else {
        programsReusedCount += 1;
        programsReused.push(program.suggestedProgramName);
      }

      for (const team of program.teams) {
        const teamResult = await findOrCreateTeamInTx(tx, {
          programId: programResult.program.id,
          team,
          leagueName: input.plan.leagueName,
          location
        });

        if (teamResult.created) {
          teamsCreatedCount += 1;
          teamsCreated.push(teamResult.resolvedTeamName);
        } else {
          teamsReusedCount += 1;
          teamsReused.push(teamResult.resolvedTeamName);
        }

        for (const sourceMapping of team.sourceMappings) {
          aliasCandidates.push({
            externalLabel: sourceMapping.externalLabel,
            scheduleLabel: sourceMapping.scheduleLabel,
            teamId: teamResult.team.id
          });
        }
      }
    }

    const aliasBatch: Array<{ externalLabel: string; teamId: string }> = [];
    for (const mapping of aliasCandidates) {
      for (const label of labelsForExternalAlias(mapping.externalLabel, mapping.scheduleLabel)) {
        aliasBatch.push({ externalLabel: label, teamId: mapping.teamId });
      }
    }
    const aliasResult = await upsertTeamExternalAliasBatch(tx, PROVIDER, aliasBatch);
    aliasesSaved = aliasResult.aliasesSaved;

    return {
      programsCreatedCount,
      programsReusedCount,
      teamsCreatedCount,
      teamsReusedCount,
      aliasesSaved
    };
  });

  return {
    programsCreated: summary.programsCreatedCount,
    programsReused: summary.programsReusedCount,
    teamsCreated: summary.teamsCreatedCount,
    teamsReused: summary.teamsReusedCount,
    aliasesSaved: summary.aliasesSaved,
    auditNotes: buildOrganizationCreationAuditNotes({
      programsCreated,
      teamsCreated
    })
  };
}
