"use server";

import { revalidatePath } from "next/cache";

import { invalidateAdminLeaguesListCaches } from "@/lib/admin/invalidate-admin-caches";
import { writeAuditLog } from "@/lib/admin/log-admin-action";
import { recomputeSeasonFormulaScores } from "@/lib/formula-v1/compute-game-performance-scores";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { syncDerivedRatingsAfterEvidenceChange } from "@/lib/ratings/sync-derived-ratings";

export type LeagueActionState = { ok: boolean; message: string };

function readRequiredString(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  if (value.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return value;
}

function readOptionalString(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (value.length > maxLength) throw new Error(`Value must be ${maxLength} characters or fewer.`);
  return value;
}

function readInt(formData: FormData, key: string, label: string, min: number, max: number) {
  const value = Number(String(formData.get(key) ?? "").trim());
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function readDate(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }
  return date;
}

async function writeGameEditAudit(input: {
  userId: string;
  entityType: "GAME" | "GAME_STAT";
  entityId: string;
  gameId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
}) {
  await prisma.gameEditAudit.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      gameId: input.gameId,
      fieldName: input.fieldName,
      oldValue: input.oldValue,
      newValue: input.newValue,
      reason: input.reason,
      editedById: input.userId
    }
  });
}

async function refreshDerivedRatingsAfterLeagueEvidenceChange(input: {
  leagueId: string;
  seasonId?: string;
  recomputeFormulaScores?: boolean;
}) {
  if (input.recomputeFormulaScores && input.seasonId) {
    await recomputeSeasonFormulaScores(input.seasonId);
  }

  await syncDerivedRatingsAfterEvidenceChange({ allSnapshots: true });
  revalidatePath("/admin/leagues");
  revalidatePath(`/admin/leagues/${input.leagueId}`);
}

export async function updateLeagueMetadata(_previous: LeagueActionState, formData: FormData): Promise<LeagueActionState> {
  try {
    const user = await requireAdminUser();
    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) throw new Error("League id is required.");

    const existing = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { tier: true }
    });
    if (!existing) throw new Error("League not found.");

    const name = readRequiredString(formData, "name", "League name", 160);
    const tier = readInt(formData, "tier", "Tier", 1, 4);
    const logoUrl = readOptionalString(formData, "logoUrl", 500);

    await prisma.league.update({
      where: { id: leagueId },
      data: { name, tier, logoUrl }
    });

    await writeAuditLog({
      userId: user.id,
      entityType: "LEAGUE",
      entityId: leagueId,
      action: "UPDATE_METADATA",
      reason: "League metadata updated",
      newData: { name, tier, logoUrl }
    });

    if (existing.tier !== tier) {
      await refreshDerivedRatingsAfterLeagueEvidenceChange({ leagueId });
    } else {
      invalidateAdminLeaguesListCaches();
    }

    revalidatePath("/admin/leagues");
    revalidatePath(`/admin/leagues/${leagueId}`);
    return {
      ok: true,
      message:
        existing.tier !== tier
          ? "League updated. Player ratings, team rankings, and national snapshots were refreshed for the new tier."
          : "League updated."
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update league." };
  }
}

export async function updateOfficialGame(_previous: LeagueActionState, formData: FormData): Promise<LeagueActionState> {
  try {
    const user = await requireAdminUser();
    const gameId = String(formData.get("gameId") ?? "").trim();
    const leagueId = String(formData.get("leagueId") ?? "").trim();
    const reason = readRequiredString(formData, "editReason", "Edit reason", 500);
    const confirmGameNumber = readRequiredString(formData, "confirmGameNumber", "Confirmation", 120);

    if (!gameId || !leagueId) throw new Error("Game and league are required.");
    if (String(formData.get("confirmEdit") ?? "") !== "on") {
      throw new Error("Confirm that you are editing official game evidence.");
    }

    const game = await prisma.game.findFirst({
      where: { id: gameId, deletedAt: null, season: { leagueId, deletedAt: null } },
      select: {
        id: true,
        gameNumber: true,
        gameDate: true,
        homeScore: true,
        awayScore: true,
        seasonId: true
      }
    });
    if (!game) throw new Error("Game not found.");
    if (game.gameNumber !== confirmGameNumber) {
      throw new Error("Confirmation game number does not match.");
    }

    const nextDate = readDate(formData, "gameDate", "Game date");
    const homeScore = readInt(formData, "homeScore", "Home score", 0, 300);
    const awayScore = readInt(formData, "awayScore", "Away score", 0, 300);

    const updates: Array<{ field: string; oldValue: string; newValue: string; apply: () => Promise<void> }> = [];

    if (game.gameDate.toISOString().slice(0, 10) !== nextDate.toISOString().slice(0, 10)) {
      updates.push({
        field: "gameDate",
        oldValue: game.gameDate.toISOString(),
        newValue: nextDate.toISOString(),
        apply: async () => {
          await prisma.game.update({ where: { id: gameId }, data: { gameDate: nextDate } });
        }
      });
    }
    if (game.homeScore !== homeScore) {
      updates.push({
        field: "homeScore",
        oldValue: String(game.homeScore),
        newValue: String(homeScore),
        apply: async () => {
          await prisma.game.update({ where: { id: gameId }, data: { homeScore } });
        }
      });
    }
    if (game.awayScore !== awayScore) {
      updates.push({
        field: "awayScore",
        oldValue: String(game.awayScore),
        newValue: String(awayScore),
        apply: async () => {
          await prisma.game.update({ where: { id: gameId }, data: { awayScore } });
        }
      });
    }

    if (!updates.length) return { ok: true, message: "No changes detected." };

    for (const update of updates) {
      await update.apply();
      await writeGameEditAudit({
        userId: user.id,
        entityType: "GAME",
        entityId: gameId,
        gameId,
        fieldName: update.field,
        oldValue: update.oldValue,
        newValue: update.newValue,
        reason
      });
    }

    await writeAuditLog({
      userId: user.id,
      entityType: "GAME",
      entityId: gameId,
      action: "UPDATE_OFFICIAL_GAME",
      reason,
      newData: { fields: updates.map((u) => u.field) }
    });

    await refreshDerivedRatingsAfterLeagueEvidenceChange({ leagueId });

    revalidatePath(`/admin/leagues/${leagueId}`);
    revalidatePath(`/admin/leagues/${leagueId}/games/${gameId}`);
    return {
      ok: true,
      message: `Updated ${updates.length} field(s). Player ratings, team rankings, and national snapshots were refreshed.`
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update game." };
  }
}

export async function updateOfficialGameStat(_previous: LeagueActionState, formData: FormData): Promise<LeagueActionState> {
  try {
    const user = await requireAdminUser();
    const gameStatId = String(formData.get("gameStatId") ?? "").trim();
    const leagueId = String(formData.get("leagueId") ?? "").trim();
    const reason = readRequiredString(formData, "editReason", "Edit reason", 500);

    if (!gameStatId || !leagueId) throw new Error("Game stat and league are required.");
    if (String(formData.get("confirmEdit") ?? "") !== "on") {
      throw new Error("Confirm that you are editing official stat evidence.");
    }

    const stat = await prisma.gameStat.findFirst({
      where: {
        id: gameStatId,
        deletedAt: null,
        game: { deletedAt: null, season: { leagueId, deletedAt: null } }
      },
      select: {
        id: true,
        gameId: true,
        points: true,
        rebounds: true,
        assists: true,
        game: { select: { seasonId: true } }
      }
    });
    if (!stat) throw new Error("Game stat not found.");

    const points = readInt(formData, "points", "Points", 0, 120);
    const rebounds = readInt(formData, "rebounds", "Rebounds", 0, 60);
    const assists = readInt(formData, "assists", "Assists", 0, 60);

    const updates: Array<{ field: string; oldValue: string; newValue: string }> = [];
    const data: { points?: number; rebounds?: number; assists?: number } = {};

    if (stat.points !== points) {
      updates.push({ field: "points", oldValue: String(stat.points), newValue: String(points) });
      data.points = points;
    }
    if (stat.rebounds !== rebounds) {
      updates.push({ field: "rebounds", oldValue: String(stat.rebounds), newValue: String(rebounds) });
      data.rebounds = rebounds;
    }
    if (stat.assists !== assists) {
      updates.push({ field: "assists", oldValue: String(stat.assists), newValue: String(assists) });
      data.assists = assists;
    }

    if (!updates.length) return { ok: true, message: "No stat changes detected." };

    await prisma.gameStat.update({ where: { id: gameStatId }, data });

    for (const update of updates) {
      await writeGameEditAudit({
        userId: user.id,
        entityType: "GAME_STAT",
        entityId: gameStatId,
        gameId: stat.gameId,
        fieldName: update.field,
        oldValue: update.oldValue,
        newValue: update.newValue,
        reason
      });
    }

    await refreshDerivedRatingsAfterLeagueEvidenceChange({
      leagueId,
      seasonId: stat.game.seasonId,
      recomputeFormulaScores: true
    });

    revalidatePath(`/admin/leagues/${leagueId}/games/${stat.gameId}`);
    return {
      ok: true,
      message: `Updated ${updates.length} stat field(s). Formula scores, player ratings, team rankings, and national snapshots were refreshed.`
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update game stat." };
  }
}
