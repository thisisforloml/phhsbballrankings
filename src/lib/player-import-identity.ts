import { PlayerGender, Prisma, type PrismaClient } from "@prisma/client";

type PlayerImportClient = PrismaClient | Prisma.TransactionClient;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Strip starter markers and trim spreadsheet player names. */
export function cleanPlayerName(value: unknown): string {
  return stringValue(value).replace(/^\*+/, "").trim();
}

/**
 * Collapse internal whitespace after cleanPlayerName.
 * Known spelling variants belong in PlayerAlias — no per-player hardcoded rules here.
 */
export function canonicalPlayerDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Full import normalization pipeline: cleanPlayerName → canonicalPlayerDisplayName.
 * PlayerAlias.aliasName must store this exact output string.
 */
export function prepareImportedPlayerName(rawName: unknown): string {
  return canonicalPlayerDisplayName(cleanPlayerName(rawName));
}

export function normalizeImportedPlayerNameKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export type PlayerImportResolveResult =
  | { action: "reuse"; playerId: string; displayName: string; via: "displayName" | "alias" }
  | { action: "create" }
  | { action: "blocked"; reason: string };

/**
 * Resolve an imported player name to an existing Player or signal create/blocked.
 * Order: exact displayName match → PlayerAlias lookup → create.
 * No fuzzy matching, merges, or identity scoring.
 */
export async function resolvePlayerForImport(
  client: PlayerImportClient,
  params: { cleanedName: string; gender: PlayerGender }
): Promise<PlayerImportResolveResult> {
  const { cleanedName, gender } = params;

  const displayMatches = await client.player.findMany({
    where: { displayName: cleanedName, gender, deletedAt: null },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" }
  });

  if (displayMatches.length > 1) {
    return {
      action: "blocked",
      reason: `Multiple active Player matches found for ${cleanedName}.`
    };
  }

  if (displayMatches.length === 1) {
    return {
      action: "reuse",
      playerId: displayMatches[0].id,
      displayName: displayMatches[0].displayName,
      via: "displayName"
    };
  }

  const alias = await client.playerAlias.findUnique({
    where: { aliasName_gender: { aliasName: cleanedName, gender } },
    select: {
      playerId: true,
      player: { select: { id: true, displayName: true, deletedAt: true } }
    }
  });

  if (alias) {
    if (alias.player.deletedAt !== null) {
      return {
        action: "blocked",
        reason: `PlayerAlias for ${cleanedName} points to a merged-away player (${alias.player.displayName}).`
      };
    }

    return {
      action: "reuse",
      playerId: alias.player.id,
      displayName: alias.player.displayName,
      via: "alias"
    };
  }

  return { action: "create" };
}
