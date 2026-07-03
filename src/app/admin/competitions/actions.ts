"use server";

import { AgeGroup, CompetitionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  readAgeGroups,
  readCompetitionStatus,
  readDate,
  readGenders,
  readInt,
  readOptionalAgeGroup,
  readOptionalDate,
  readOptionalGender,
  readOptionalInt,
  readOptionalString,
  readOptionalUrl,
  readRequiredString,
  readSeasonStatus,
  readSeasonType,
  readSport,
} from "@/lib/admin/competition-management/validate-competition";
import { invalidateAdminLeaguesListCaches } from "@/lib/admin/invalidate-admin-caches";
import { clearCompetitionListCache } from "@/lib/admin/load-competition-list";
import { writeAuditLog } from "@/lib/admin/log-admin-action";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export type CompetitionActionState = { ok: boolean; message: string; id?: string };

function revalidateCompetitionPaths(competitionId?: string) {
  clearCompetitionListCache();
  invalidateAdminLeaguesListCaches();
  revalidatePath("/admin/competitions");
  revalidatePath("/admin/leagues");
  if (competitionId) {
    revalidatePath(`/admin/competitions/${competitionId}`);
    revalidatePath(`/admin/leagues/${competitionId}`);
  }
}

export async function createCompetition(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const name = readRequiredString(formData, "name", "Name", 160);
    const organization = readRequiredString(formData, "organization", "Organization", 160);
    const defaultAgeGroups = readAgeGroups(formData);
    const defaultGenders = readGenders(formData);
    const primaryAgeGroup = (defaultAgeGroups[0] ?? AgeGroup.U19) as AgeGroup;

    const created = await prisma.league.create({
      data: {
        name,
        shortName: readOptionalString(formData, "shortName", 40),
        organizerName: organization,
        seasonType: readSeasonType(formData),
        country: readOptionalString(formData, "country", 80) ?? "Philippines",
        region: readOptionalString(formData, "region", 100),
        sport: readSport(formData),
        defaultAgeGroups,
        defaultGenders,
        status: readCompetitionStatus(formData),
        logoUrl: readOptionalUrl(formData, "logoUrl"),
        website: readOptionalUrl(formData, "website"),
        adminNotes: readOptionalString(formData, "notes", 2000),
        ageGroup: primaryAgeGroup,
        tier: readInt(formData, "tier", "Tier", 1, 4),
      },
      select: { id: true },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "LEAGUE",
      entityId: created.id,
      action: "CREATE_COMPETITION",
      reason: "Competition created from admin",
      newData: { name, organization },
    });

    revalidateCompetitionPaths(created.id);
    return { ok: true, message: `Created ${name}.`, id: created.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create competition." };
  }
}

export async function updateCompetition(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    if (!competitionId) throw new Error("Competition id is required.");

    const defaultAgeGroups = readAgeGroups(formData);
    const primaryAgeGroup = (defaultAgeGroups[0] ?? AgeGroup.U19) as AgeGroup;

    await prisma.league.update({
      where: { id: competitionId, deletedAt: null },
      data: {
        name: readRequiredString(formData, "name", "Name", 160),
        shortName: readOptionalString(formData, "shortName", 40),
        organizerName: readRequiredString(formData, "organization", "Organization", 160),
        seasonType: readSeasonType(formData),
        country: readOptionalString(formData, "country", 80),
        region: readOptionalString(formData, "region", 100),
        sport: readSport(formData),
        defaultAgeGroups,
        defaultGenders: readGenders(formData),
        status: readCompetitionStatus(formData),
        logoUrl: readOptionalUrl(formData, "logoUrl"),
        website: readOptionalUrl(formData, "website"),
        adminNotes: readOptionalString(formData, "notes", 2000),
        ageGroup: primaryAgeGroup,
        tier: readInt(formData, "tier", "Tier", 1, 4),
      },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "LEAGUE",
      entityId: competitionId,
      action: "UPDATE_COMPETITION",
      reason: "Competition updated from admin",
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Competition updated.", id: competitionId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update competition." };
  }
}

export async function archiveCompetition(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    if (!competitionId) throw new Error("Competition id is required.");
    if (String(formData.get("confirmArchive") ?? "") !== "on") {
      throw new Error("Confirm archive to continue.");
    }

    await prisma.league.update({
      where: { id: competitionId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        status: CompetitionStatus.ARCHIVED,
      },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "LEAGUE",
      entityId: competitionId,
      action: "ARCHIVE_COMPETITION",
      reason: "Competition soft-deleted from admin",
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Competition archived.", id: competitionId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not archive competition." };
  }
}

export async function createSeason(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    if (!competitionId) throw new Error("Competition id is required.");

    const name = readRequiredString(formData, "name", "Season name", 120);
    const seasonYear = readInt(formData, "seasonYear", "Year", 2000, 2100);
    const startsOn = readDate(formData, "startsOn", "Start date");
    const endsOn = readOptionalDate(formData, "endsOn");
    const isCurrent = String(formData.get("isCurrent") ?? "") === "on";

    if (isCurrent) {
      await prisma.season.updateMany({
        where: { leagueId: competitionId, deletedAt: null },
        data: { isCurrent: false },
      });
    }

    const created = await prisma.season.create({
      data: {
        leagueId: competitionId,
        name,
        seasonNumber: readOptionalInt(formData, "seasonNumber", "Season number", 1, 200),
        seasonYear,
        status: readSeasonStatus(formData),
        startsOn,
        endsOn,
        isCurrent,
      },
      select: { id: true },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "SEASON",
      entityId: created.id,
      action: "CREATE_SEASON",
      reason: "Season created from competition admin",
      newData: { competitionId, name },
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: `Created ${name}.`, id: created.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create season." };
  }
}

export async function updateSeason(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    if (!competitionId || !seasonId) throw new Error("Competition and season are required.");

    const isCurrent = String(formData.get("isCurrent") ?? "") === "on";
    if (isCurrent) {
      await prisma.season.updateMany({
        where: { leagueId: competitionId, deletedAt: null, id: { not: seasonId } },
        data: { isCurrent: false },
      });
    }

    await prisma.season.update({
      where: { id: seasonId, leagueId: competitionId, deletedAt: null },
      data: {
        name: readRequiredString(formData, "name", "Season name", 120),
        seasonNumber: readOptionalInt(formData, "seasonNumber", "Season number", 1, 200),
        seasonYear: readInt(formData, "seasonYear", "Year", 2000, 2100),
        status: readSeasonStatus(formData),
        startsOn: readDate(formData, "startsOn", "Start date"),
        endsOn: readOptionalDate(formData, "endsOn"),
        isCurrent,
      },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "SEASON",
      entityId: seasonId,
      action: "UPDATE_SEASON",
      reason: "Season updated from competition admin",
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Season updated.", id: seasonId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update season." };
  }
}

export async function archiveSeason(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    if (!competitionId || !seasonId) throw new Error("Competition and season are required.");
    if (String(formData.get("confirmArchive") ?? "") !== "on") {
      throw new Error("Confirm archive to continue.");
    }

    await prisma.season.update({
      where: { id: seasonId, leagueId: competitionId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
        isCurrent: false,
      },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "SEASON",
      entityId: seasonId,
      action: "ARCHIVE_SEASON",
      reason: "Season soft-deleted from competition admin",
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Season archived.", id: seasonId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not archive season." };
  }
}

export async function createDivision(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    if (!competitionId || !seasonId) throw new Error("Competition and season are required.");

    const created = await prisma.seasonDivision.create({
      data: {
        seasonId,
        name: readRequiredString(formData, "name", "Division name", 80),
        ageGroup: readOptionalAgeGroup(formData, "ageGroup"),
        gender: readOptionalGender(formData, "gender"),
        status: readSeasonStatus(formData),
        sortOrder: readOptionalInt(formData, "sortOrder", "Sort order", 0, 999) ?? 0,
      },
      select: { id: true },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "SEASON_DIVISION",
      entityId: created.id,
      action: "CREATE_DIVISION",
      reason: "Division created from competition admin",
      newData: { seasonId, competitionId },
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Division created.", id: created.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not create division." };
  }
}

export async function updateDivision(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    const divisionId = String(formData.get("divisionId") ?? "").trim();
    if (!competitionId || !seasonId || !divisionId) {
      throw new Error("Competition, season, and division are required.");
    }

    await prisma.seasonDivision.update({
      where: { id: divisionId, seasonId, deletedAt: null },
      data: {
        name: readRequiredString(formData, "name", "Division name", 80),
        ageGroup: readOptionalAgeGroup(formData, "ageGroup"),
        gender: readOptionalGender(formData, "gender"),
        status: readSeasonStatus(formData),
        sortOrder: readOptionalInt(formData, "sortOrder", "Sort order", 0, 999) ?? 0,
      },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "SEASON_DIVISION",
      entityId: divisionId,
      action: "UPDATE_DIVISION",
      reason: "Division updated from competition admin",
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Division updated.", id: divisionId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update division." };
  }
}

export async function archiveDivision(
  _previous: CompetitionActionState,
  formData: FormData,
): Promise<CompetitionActionState> {
  try {
    const user = await requireAdminUser();
    const competitionId = String(formData.get("competitionId") ?? "").trim();
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    const divisionId = String(formData.get("divisionId") ?? "").trim();
    if (!competitionId || !seasonId || !divisionId) {
      throw new Error("Competition, season, and division are required.");
    }
    if (String(formData.get("confirmArchive") ?? "") !== "on") {
      throw new Error("Confirm archive to continue.");
    }

    await prisma.seasonDivision.update({
      where: { id: divisionId, seasonId, deletedAt: null },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "SEASON_DIVISION",
      entityId: divisionId,
      action: "ARCHIVE_DIVISION",
      reason: "Division soft-deleted from competition admin",
    });

    revalidateCompetitionPaths(competitionId);
    return { ok: true, message: "Division archived.", id: divisionId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not archive division." };
  }
}
