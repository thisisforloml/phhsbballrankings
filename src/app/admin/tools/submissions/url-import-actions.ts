"use server";

import { AgeGroup, OrganizerSubmissionType, PlayerGender, SubmissionStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildStatsHubSubmissionPackage, discoverStatsHubImport } from "@/lib/stats-import/adapters/statshub-v1";
import { packageDraftToRawText } from "@/lib/stats-import/adapters/statshub-v1/normalize-package";
import { fetchFibaTeamLabels } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import type {
  OrganizationCreationPreview,
  OrganizationCreationResult,
  PlayerMatchingPreview,
  TeamMatchPreviewRow,
  TeamMatchingPreview,
  UrlImportCreationPlan,
  UrlImportDiscovery,
  UrlImportPlayerMapping,
  UrlImportTeamMapping
} from "@/lib/stats-import/types";
import {
  applyTeamMappingsToPackageDraft,
  buildTeamMappingAuditNotes,
  estimateTeamMatchingCleanupLevel,
  externalTeamAliasKey,
  inferTeamCreationPreview,
  loadTeamMatchDbContext,
  matchExternalTeam
} from "@/lib/team-import-matching";
import { buildPlayerMappingAuditNotes } from "@/lib/player-import-matching";
import { buildUrlImportPlayerMatchingPreview } from "@/lib/url-import-player-preview";
import { persistPlayerExternalAliases } from "@/lib/player-external-alias";
import { persistTeamExternalAliases } from "@/lib/team-external-alias";
import {
  createMissingOrganizationsFromImport,
  previewMissingOrganizationsFromImport
} from "@/lib/url-import-organization-creation";
import { buildMissingOrganizationsAuditNotes } from "@/lib/url-import-creation-plan";
import { buildSubmissionReview } from "@/lib/submission-review";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

function jsonPreview(value: unknown): Prisma.InputJsonValue {
  const preview = Array.isArray(value)
    ? { kind: "array", totalItems: value.length, sample: value.slice(0, 10) }
    : value && typeof value === "object"
      ? {
          kind: "object",
          keys: Object.keys(value as Record<string, unknown>),
          sample: Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 10))
        }
      : { kind: typeof value, sample: value };

  return JSON.parse(JSON.stringify(preview)) as Prisma.InputJsonValue;
}

function appendAdminNotes(existing: string | null, note: string) {
  return [existing, note].filter(Boolean).join("\n\n");
}

function coerceAgeGroup(value: string): AgeGroup {
  const normalized = value.trim().toUpperCase();
  if (!Object.values(AgeGroup).includes(normalized as AgeGroup)) {
    throw new Error(`Unsupported age group: ${value}`);
  }
  return normalized as AgeGroup;
}

function coerceGender(value: string): PlayerGender {
  return value.toUpperCase() === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
}

async function fetchLabelsForMatches(
  matchIds: string[],
  scheduleByMatchId?: Record<string, { homeScheduleLabel?: string; awayScheduleLabel?: string }>
) {
  const labelsByMatch = new Map<string, { home: string; away: string }>();
  const chunkSize = 5;

  for (let index = 0; index < matchIds.length; index += chunkSize) {
    const chunk = matchIds.slice(index, index + chunkSize);
    const fetched = await Promise.all(
      chunk.map(async (matchId) => {
        const schedule = scheduleByMatchId?.[matchId];
        const scheduleFallback =
          schedule?.homeScheduleLabel && schedule?.awayScheduleLabel
            ? { home: schedule.homeScheduleLabel, away: schedule.awayScheduleLabel }
            : null;
        return {
          matchId,
          labels: await fetchFibaTeamLabels(matchId, scheduleFallback)
        };
      })
    );
    for (const item of fetched) {
      labelsByMatch.set(item.matchId, item.labels);
    }
  }

  return labelsByMatch;
}

function parseTeamMappings(raw: FormDataEntryValue | null): UrlImportTeamMapping[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw)) as UrlImportTeamMapping[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Team mappings payload is invalid.");
  }
}

function parsePlayerMappings(raw: FormDataEntryValue | null): UrlImportPlayerMapping[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw)) as UrlImportPlayerMapping[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Player mappings payload is invalid.");
  }
}

function parseCreationPlan(raw: FormDataEntryValue | null): UrlImportCreationPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw)) as UrlImportCreationPlan;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.programs) || !Array.isArray(parsed.teams)) {
      return null;
    }
    return parsed;
  } catch {
    throw new Error("Creation plan payload is invalid.");
  }
}

export async function discoverUrlImport(sourceUrl: string): Promise<UrlImportDiscovery> {
  await requireAdminUser();
  const trimmed = sourceUrl.trim();
  if (!trimmed) throw new Error("URL is required.");
  return discoverStatsHubImport(trimmed);
}

export async function previewUrlImportTeamMatching(input: {
  matchIds: string[];
  scheduleByMatchId?: Record<string, { homeScheduleLabel?: string; awayScheduleLabel?: string }>;
  leagueName: string;
  ageGroup: string;
  gender: "BOYS" | "GIRLS";
  competitionId?: string | null;
}): Promise<TeamMatchingPreview> {
  await requireAdminUser();

  const matchIds = Array.from(new Set(input.matchIds.map(String).filter(Boolean)));
  if (!matchIds.length) throw new Error("Select at least one game.");
  if (!input.leagueName.trim()) throw new Error("League name is required.");

  const ageGroup = coerceAgeGroup(input.ageGroup);
  const gender = coerceGender(input.gender);
  const labelsByMatch = await fetchLabelsForMatches(matchIds, input.scheduleByMatchId);
  const db = await loadTeamMatchDbContext();

  const uniqueByAlias = new Map<
    string,
    {
      externalLabel: string;
      aliasKey: string;
      scheduleLabel?: string;
      matchIds: string[];
    }
  >();

  for (const matchId of matchIds) {
    const labels = labelsByMatch.get(matchId);
    if (!labels) continue;
    const schedule = input.scheduleByMatchId?.[matchId];

    for (const [externalLabel, scheduleLabel] of [
      [labels.home, schedule?.homeScheduleLabel],
      [labels.away, schedule?.awayScheduleLabel]
    ] as const) {
      const aliasKey = externalTeamAliasKey(externalLabel);
      const existing = uniqueByAlias.get(aliasKey);
      if (existing) {
        if (!existing.matchIds.includes(matchId)) existing.matchIds.push(matchId);
        if (!existing.scheduleLabel && scheduleLabel) existing.scheduleLabel = scheduleLabel;
        continue;
      }
      uniqueByAlias.set(aliasKey, {
        externalLabel,
        aliasKey,
        scheduleLabel: scheduleLabel ?? undefined,
        matchIds: [matchId]
      });
    }
  }

  const teams: TeamMatchPreviewRow[] = Array.from(uniqueByAlias.values())
    .map((item) => {
      const result = matchExternalTeam(
        {
          externalLabel: item.externalLabel,
          scheduleLabel: item.scheduleLabel ?? null,
          leagueName: input.leagueName,
          ageGroup,
          gender,
          competitionId: input.competitionId ?? null,
          provider: "statshub-v1"
        },
        db
      );

      return {
        aliasKey: result.aliasKey,
        externalLabel: result.externalLabel,
        scheduleLabel: result.scheduleLabel,
        matchingInput: result.matchingInput,
        matchCount: item.matchIds.length,
        inferredProgramName: result.inferredProgramName,
        creationPreview: inferTeamCreationPreview({
          externalLabel: result.externalLabel,
          scheduleLabel: result.scheduleLabel,
          matchingInput: result.matchingInput,
          leagueName: input.leagueName,
          ageGroup,
          gender
        }),
        gameCount: item.matchIds.length,
        matchIds: item.matchIds,
        confidenceBand: result.confidenceBand,
        score: result.score,
        tier: result.tier,
        method: result.method,
        matchReason: result.matchReason,
        ambiguous: result.ambiguous,
        suggestedTeam: result.suggestedTeam,
        candidates: result.candidates.map((candidate) => ({
          teamId: candidate.teamId,
          teamName: candidate.teamName,
          programName: candidate.programName,
          score: candidate.score,
          tier: candidate.tier,
          method: candidate.method
        }))
      };
    })
    .sort((left, right) => left.externalLabel.localeCompare(right.externalLabel));

  const autoResolved = teams.filter((team) => team.confidenceBand === "Exact" || team.confidenceBand === "Strong Match").length;
  const needsReview = teams.filter((team) => team.confidenceBand === "Review Needed").length;
  const unmatched = teams.filter((team) => team.confidenceBand === "Unmatched").length;
  const createOnImport = teams.filter((team) => team.confidenceBand === "Unmatched").length;
  const autoResolutionRate = teams.length ? Number(((autoResolved / teams.length) * 100).toFixed(1)) : 0;

  return {
    gameCount: matchIds.length,
    uniqueTeams: teams.length,
    readiness: {
      autoResolved,
      needsReview,
      unmatched,
      createOnImport,
      estimatedCleanup: estimateTeamMatchingCleanupLevel({ uniqueTeams: teams.length, autoResolved, needsReview, unmatched }),
      autoResolutionRate,
      autoMatched: autoResolved
    },
    diagnostics: {
      uniqueTeams: teams.length,
      autoResolved,
      needsReview,
      createOnImport,
      autoResolutionRate,
      existingTeams: autoResolved,
      teamsToCreate: createOnImport,
      manualOverrides: 0,
      aliasesResolved: 0,
      newAliasesCreated: 0
    },
    teams
  };
}

export async function previewMissingOrganizationsFromImportAction(
  plan: UrlImportCreationPlan
): Promise<OrganizationCreationPreview> {
  await requireAdminUser();
  if (!plan || plan.version !== 1) throw new Error("Creation plan is invalid.");
  return previewMissingOrganizationsFromImport(plan);
}

export async function createMissingOrganizationsFromImportAction(input: {
  plan: UrlImportCreationPlan;
  city?: string;
  region?: string;
  confirmationPhrase: string;
}): Promise<OrganizationCreationResult> {
  await requireAdminUser();
  if (!input.plan || input.plan.version !== 1) throw new Error("Creation plan is invalid.");

  const preview = await previewMissingOrganizationsFromImport(input.plan);
  if (!preview.summary.programsToCreate && !preview.summary.teamsToCreate) {
    throw new Error("No new programs or teams to create.");
  }
  if (input.confirmationPhrase.trim() !== preview.confirmationPhrase) {
    throw new Error(`Confirmation phrase must be exactly: ${preview.confirmationPhrase}`);
  }

  const result = await createMissingOrganizationsFromImport({
    plan: input.plan,
    city: input.city,
    region: input.region
  });

  revalidatePath("/admin/programs");
  revalidatePath("/admin/tools/submissions");
  return result;
}

export async function searchTeamsForImport(query: string) {
  await requireAdminUser();
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.team.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { city: { contains: trimmed, mode: "insensitive" } },
        { region: { contains: trimmed, mode: "insensitive" } },
        { program: { fullName: { contains: trimmed, mode: "insensitive" } } },
        { program: { abbreviation: { contains: trimmed, mode: "insensitive" } } }
      ]
    },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      program: { select: { fullName: true } }
    },
    orderBy: { name: "asc" },
    take: 12
  });
}

export async function previewUrlImportPlayerMatching(input: {
  matchIds: string[];
  teamMappings: UrlImportTeamMapping[];
  teamPreviewRows?: TeamMatchPreviewRow[];
  gender: "BOYS" | "GIRLS";
}): Promise<PlayerMatchingPreview> {
  await requireAdminUser();
  return buildUrlImportPlayerMatchingPreview({
    matchIds: input.matchIds,
    teamMappings: input.teamMappings,
    teamPreviewRows: input.teamPreviewRows,
    gender: coerceGender(input.gender)
  });
}

export async function searchPlayersForImport(query: string, gender: "BOYS" | "GIRLS", teamId?: string | null) {
  await requireAdminUser();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const playerGender = coerceGender(gender);
  const nameFilter: Prisma.PlayerWhereInput = {
    OR: [
      { displayName: { contains: trimmed, mode: "insensitive" } },
      { firstName: { contains: trimmed, mode: "insensitive" } },
      { lastName: { contains: trimmed, mode: "insensitive" } },
      { aliases: { some: { aliasName: { contains: trimmed, mode: "insensitive" } } } }
    ]
  };

  const teamFilter: Prisma.PlayerWhereInput | null = teamId
    ? {
        OR: [
          { gameStats: { some: { teamId, game: { deletedAt: null } } } },
          { rosterSeasons: { some: { teamId, deletedAt: null } } }
        ]
      }
    : null;

  return prisma.player.findMany({
    where: {
      deletedAt: null,
      gender: playerGender,
      AND: [nameFilter, ...(teamFilter ? [teamFilter] : [])]
    },
    select: {
      id: true,
      displayName: true,
      city: true,
      region: true,
      currentProgram: { select: { fullName: true } }
    },
    orderBy: { displayName: "asc" },
    take: 12
  });
}

export async function createUrlImportSubmission(formData: FormData) {
  const user = await requireAdminUser();

  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const competitionId = String(formData.get("competitionId") ?? "").trim() || null;
  const leagueName = String(formData.get("leagueName") ?? "").trim();
  const ageGroup = String(formData.get("ageGroup") ?? "").trim();
  const gender = String(formData.get("gender") ?? "BOYS").toUpperCase() === "GIRLS" ? "GIRLS" : "BOYS";
  const seasonName = String(formData.get("seasonName") ?? "").trim();
  const seasonYearRaw = String(formData.get("seasonYear") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const matchIds = formData.getAll("matchId").map(String).filter(Boolean);
  const gameNumbers = formData.getAll("gameNumber").map(String);
  const gameSourceUrls = formData.getAll("gameSourceUrl").map(String);
  const teamMappings = parseTeamMappings(formData.get("teamMappings"));
  const creationPlan = parseCreationPlan(formData.get("creationPlan"));
  const playerMappings = parsePlayerMappings(formData.get("playerMappings"));
  const organizationCreationAudit = String(formData.get("organizationCreationAudit") ?? "").trim();

  if (!sourceUrl) throw new Error("Source URL is required.");
  if (!leagueName) throw new Error("League name is required.");
  if (!ageGroup) throw new Error("Age group is required.");
  if (!matchIds.length) throw new Error("Select at least one game.");

  const seasonYear = seasonYearRaw ? Number(seasonYearRaw) : undefined;
  if (seasonYearRaw && !Number.isFinite(seasonYear)) {
    throw new Error("Season year must be a number.");
  }

  const games = matchIds.map((matchId, index) => ({
    matchId,
    gameNumber: gameNumbers[index] ?? `SH-MATCH-${matchId}`,
    sourceUrl: gameSourceUrls[index] ?? `https://www.fibalivestats.com/webcast/PRS/${matchId}/`
  }));

  try {
    const built = await buildStatsHubSubmissionPackage({
      sourceUrl,
      competitionId,
      leagueName,
      ageGroup,
      gender,
      seasonName: seasonName || undefined,
      seasonYear,
      city: city || undefined,
      region: region || undefined,
      games
    });

    if (teamMappings.length) {
      applyTeamMappingsToPackageDraft(built.packageDraft, teamMappings);
      built.rawText = packageDraftToRawText(built.packageDraft);
      built.review = buildSubmissionReview({
        rawText: built.rawText,
        parsedPreview: null,
        title: leagueName,
        leagueName
      });
    }

    const aliasPersistence =
      teamMappings.length > 0
        ? await persistTeamExternalAliases({
            provider: "statshub-v1",
            mappings: teamMappings
          })
        : { newAliasesCreated: 0, aliasesUpdated: 0 };

    const playerAliasPersistence =
      playerMappings.length > 0
        ? await persistPlayerExternalAliases({
            provider: "statshub-v1",
            mappings: playerMappings
          })
        : { newAliasesCreated: 0, aliasesUpdated: 0 };

    const mappingAudit = buildTeamMappingAuditNotes(teamMappings);
    const missingOrganizationsAudit = creationPlan ? buildMissingOrganizationsAuditNotes(creationPlan) : "";
    const playerMappingAudit = buildPlayerMappingAuditNotes(playerMappings);
    const earliestGameDate = built.packageDraft.games.reduce((earliest, game) => {
      return !earliest || game.gameDate < earliest ? game.gameDate : earliest;
    }, built.packageDraft.games[0]?.gameDate ?? "");

    const submission = await prisma.submission.create({
      data: {
        submittedByUserId: user.id,
        type: OrganizerSubmissionType.PASTE_JSON,
        status: SubmissionStatus.DRAFT,
        title: `${leagueName} — URL import (${built.gameCount} game${built.gameCount === 1 ? "" : "s"})`.slice(0, 160),
        leagueName,
        gameDate: earliestGameDate ? new Date(`${earliestGameDate}T00:00:00.000Z`) : null,
        rawText: built.rawText,
        parsedPreview: jsonPreview(JSON.parse(built.rawText)),
        validationSummary: {
          ok: built.review.importReady,
          format: "statshub-url-import",
          provider: "statshub-v1",
          sourceUrl,
          gameCount: built.gameCount,
          messages: [
            ...built.review.importReady ? [] : [`Review readiness: ${built.review.readinessLabel}`],
            ...(built.reconciliationSummary.inaccessibleFeedMatchIds.length
              ? [
                  `Inaccessible feed reconciliation applied to match(es): ${built.reconciliationSummary.inaccessibleFeedMatchIds.join(", ")}`
                ]
              : []),
            ...(built.review.validation.missingRequiredFields.length
              ? [`Missing fields detected: ${built.review.validation.missingRequiredFields.length}`]
              : [])
          ],
          previewSupported: true,
          ...(teamMappings.length
            ? {
                importTeamMappings: {
                  total: teamMappings.length,
                  reuse: teamMappings.filter((mapping) => mapping.action === "mapped_existing").length,
                  create: teamMappings.filter((mapping) => mapping.action === "create_on_import").length,
                  aliasesSaved: aliasPersistence.newAliasesCreated + aliasPersistence.aliasesUpdated
                }
              }
            : {}),
          ...(creationPlan
            ? {
                importCreationPlan: {
                  version: creationPlan.version,
                  programCount: creationPlan.summary.programCount,
                  teamCount: creationPlan.summary.teamCount,
                  gamesAffected: creationPlan.summary.gamesAffected,
                  generatedAt: creationPlan.generatedAt
                }
              }
            : {}),
          ...(playerMappings.length
            ? {
                importPlayerMappings: {
                  total: playerMappings.length,
                  reuse: playerMappings.filter((mapping) => mapping.action === "mapped_existing").length,
                  create: playerMappings.filter((mapping) => mapping.action === "create_on_import").length,
                  aliasesSaved: playerAliasPersistence.newAliasesCreated + playerAliasPersistence.aliasesUpdated
                }
              }
            : {})
        },
        adminNotes: appendAdminNotes(
          null,
          [
            "StatsHub URL import",
            `Source: ${sourceUrl}`,
            `Games imported: ${built.gameCount}`,
            built.reconciliationSummary.inaccessibleFeedMatchIds.length
              ? `Score reconciliation (inaccessible feed): ${built.reconciliationSummary.inaccessibleFeedMatchIds.join(", ")}`
              : "",
            built.reconciliationSummary.reconciledMatchIds.length
              ? `Score reconciliation applied: ${built.reconciliationSummary.reconciledMatchIds.join(", ")}`
              : "",
            `Fetched: ${new Date().toISOString()}`,
            mappingAudit,
            missingOrganizationsAudit,
            organizationCreationAudit,
            playerMappingAudit,
            aliasPersistence.newAliasesCreated || aliasPersistence.aliasesUpdated
              ? `Team aliases saved: ${aliasPersistence.newAliasesCreated} new, ${aliasPersistence.aliasesUpdated} updated`
              : "",
            playerAliasPersistence.newAliasesCreated || playerAliasPersistence.aliasesUpdated
              ? `Player aliases saved: ${playerAliasPersistence.newAliasesCreated} new, ${playerAliasPersistence.aliasesUpdated} updated`
              : ""
          ].filter(Boolean).join("\n")
        )
      },
      select: { id: true }
    });

    revalidatePath("/admin/tools/submissions");
    revalidatePath("/admin/submissions");
    redirect(`/admin/submissions/${submission.id}?reviewSuccess=${encodeURIComponent("Draft submission created from URL import. Review before publish.")}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = encodeURIComponent(error instanceof Error ? error.message : "URL import failed.");
    redirect(`/admin/tools/submissions?error=${message}`);
  }
}
