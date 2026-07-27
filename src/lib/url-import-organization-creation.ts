import { randomUUID } from "node:crypto";

import { type Prisma, ProgramRole, ProgramType } from "@prisma/client";

import { assertImportProgramReusable } from "@/lib/admin/program-role";
import { prisma } from "@/lib/prisma";
import type {
  ImportTeamCreationCandidate,
  OrganizationCreationPreview,
  OrganizationCreationResult,
  UrlImportCreationPlan
} from "@/lib/stats-import/types";
import { labelsForExternalAlias, normalizeExternalTeamLabel } from "@/lib/team-external-alias";
import { normalizeProgramAlias } from "@/lib/uaap-school-display";

const PROVIDER = "statshub-v1" as const;

type ProgramRecord = {
  id: string;
  fullName: string;
  programRole: ProgramRole;
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

function resolveTeamNameForCreation(team: ImportTeamCreationCandidate, _leagueName: string) {
  // The reviewed creation preview already contains the exact competition bracket.
  // Do not collapse U15/U18 back into the broader U16/U19 ranking board here.
  return team.suggestedTeamName.trim();
}

function findProgramByName(programs: ProgramRecord[], fullName: string) {
  const normalized = normalizeProgramAlias(fullName);
  return (
    programs.find((program) => program.fullName === fullName) ??
    programs.find((program) => normalizeProgramAlias(program.fullName) === normalized) ??
    null
  );
}

function findTeamUnderProgram(teams: TeamRecord[], programId: string, resolvedTeamName: string) {
  const normalizedName = resolvedTeamName.trim().toLocaleLowerCase();
  return teams.find(
    (team) => team.programId === programId && team.name.trim().toLocaleLowerCase() === normalizedName,
  ) ?? null;
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
      select: { id: true, fullName: true, programRole: true }
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
      assertImportProgramReusable(existingProgram);
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
        findTeamUnderProgram(teams, programId, resolvedTeamName);

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
      auditNotes: "",
    };
  }

  const location = {
    city: input.city?.trim() || "Metro Manila",
    region: input.region?.trim() || "NCR",
  };

  const [programRecords, teamRecords] = await Promise.all([
    prisma.program.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, programRole: true },
    }),
    prisma.team.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, programId: true },
    }),
  ]);

  const programsCreated: string[] = [];
  const programsReused: string[] = [];
  const teamsCreated: string[] = [];
  const teamsReused: string[] = [];
  const aliasCandidates: Array<{ externalLabel: string; scheduleLabel?: string | null; teamId: string }> = [];
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const program of input.plan.programs) {
    let programRecord = findProgramByName(programRecords, program.suggestedProgramName);
    if (programRecord) {
      assertImportProgramReusable(programRecord);
      programsReused.push(program.suggestedProgramName);
    } else {
      programRecord = {
        id: randomUUID(),
        fullName: program.suggestedProgramName,
        programRole: ProgramRole.OPERATIONAL,
      };
      programRecords.push(programRecord);
      programsCreated.push(program.suggestedProgramName);
      operations.push(prisma.program.create({
        data: {
          id: programRecord.id,
          fullName: program.suggestedProgramName,
          abbreviation: program.suggestedAbbreviation || null,
          type: programTypeFromLabel(program.suggestedProgramType),
          programRole: ProgramRole.OPERATIONAL,
          city: location.city || null,
          region: location.region || null,
          aliases: [program.normalizedAlias, program.suggestedProgramName, program.suggestedAbbreviation].filter(Boolean),
        },
      }));
    }

    for (const team of program.teams) {
      const resolvedTeamName = resolveTeamNameForCreation(team, input.plan.leagueName);
      let teamRecord = findTeamUnderProgram(teamRecords, programRecord.id, resolvedTeamName);
      if (teamRecord) {
        teamsReused.push(resolvedTeamName);
      } else {
        teamRecord = { id: randomUUID(), name: resolvedTeamName, programId: programRecord.id };
        teamRecords.push(teamRecord);
        teamsCreated.push(resolvedTeamName);
        operations.push(prisma.team.create({
          data: {
            id: teamRecord.id,
            name: resolvedTeamName,
            city: location.city,
            region: location.region,
            programId: programRecord.id,
          },
        }));
      }

      for (const sourceMapping of team.sourceMappings) {
        aliasCandidates.push({
          externalLabel: sourceMapping.externalLabel,
          scheduleLabel: sourceMapping.scheduleLabel,
          teamId: teamRecord.id,
        });
      }
    }
  }

  const aliasByKey = new Map<string, { externalLabel: string; normalizedExternalLabel: string; teamId: string }>();
  for (const mapping of aliasCandidates) {
    for (const label of labelsForExternalAlias(mapping.externalLabel, mapping.scheduleLabel)) {
      const externalLabel = label.trim();
      if (!externalLabel) continue;
      const normalizedExternalLabel = normalizeExternalTeamLabel(externalLabel);
      aliasByKey.set(normalizedExternalLabel, { externalLabel, normalizedExternalLabel, teamId: mapping.teamId });
    }
  }

  for (const alias of aliasByKey.values()) {
    operations.push(prisma.teamExternalAlias.upsert({
      where: {
        provider_normalizedExternalLabel: {
          provider: PROVIDER,
          normalizedExternalLabel: alias.normalizedExternalLabel,
        },
      },
      create: { provider: PROVIDER, ...alias },
      update: { externalLabel: alias.externalLabel, teamId: alias.teamId },
    }));
  }

  await prisma.$transaction(operations);

  return {
    programsCreated: programsCreated.length,
    programsReused: programsReused.length,
    teamsCreated: teamsCreated.length,
    teamsReused: teamsReused.length,
    aliasesSaved: aliasByKey.size,
    auditNotes: buildOrganizationCreationAuditNotes({ programsCreated, teamsCreated }),
  };
}
