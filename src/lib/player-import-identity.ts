import { PlayerGender, Prisma, type PrismaClient } from "@prisma/client";

import { importedPlayerKey } from "@/lib/player-import-matching";
import { isMiddleNameVariant, normalizeIdentityTokens } from "@/lib/player-name-identity";
import type { StatsImportProviderId } from "@/lib/stats-import/types";

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
  | { action: "reuse"; playerId: string; displayName: string; via: "displayName" | "alias" | "externalAlias" }
  | { action: "create" }
  | { action: "blocked"; reason: string };

/**
 * Resolve an imported player name to an existing Player or signal create/blocked.
 * Order: exact displayName match → PlayerAlias lookup → create.
 * A likely middle-name variant blocks import for admin review; it is never merged automatically.
 */
export async function resolvePlayerForImport(
  client: PlayerImportClient,
  params: {
    cleanedName: string;
    gender: PlayerGender;
    externalIdentity?: { provider: StatsImportProviderId; teamLabel: string } | null;
  }
): Promise<PlayerImportResolveResult> {
  const { cleanedName, gender, externalIdentity } = params;

  if (externalIdentity) {
    const normalizedExternalLabel = importedPlayerKey(externalIdentity.teamLabel, cleanedName);
    const externalAlias = await client.playerExternalAlias.findUnique({
      where: {
        provider_normalizedExternalLabel: {
          provider: externalIdentity.provider,
          normalizedExternalLabel,
        },
      },
      select: {
        player: { select: { id: true, displayName: true, gender: true, deletedAt: true } },
      },
    });

    if (externalAlias) {
      if (externalAlias.player.deletedAt !== null) {
        return {
          action: "blocked",
          reason: "Saved import mapping for " + cleanedName + " points to a merged-away player (" + externalAlias.player.displayName + ").",
        };
      }
      if (externalAlias.player.gender !== gender) {
        return {
          action: "blocked",
          reason: "Saved import mapping for " + cleanedName + " has a gender mismatch (" + externalAlias.player.displayName + ").",
        };
      }

      return {
        action: "reuse",
        playerId: externalAlias.player.id,
        displayName: externalAlias.player.displayName,
        via: "externalAlias",
      };
    }
  }

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

  const identityTokens = normalizeIdentityTokens(cleanedName);
  const firstToken = identityTokens[0] ?? "";
  const lastToken = identityTokens.at(-1) ?? "";
  const possibleVariants = firstToken && lastToken
    ? await client.player.findMany({
        where: {
          gender,
          deletedAt: null,
          OR: [
            { firstName: { contains: firstToken, mode: "insensitive" } },
            { lastName: { contains: lastToken, mode: "insensitive" } },
            { displayName: { contains: lastToken, mode: "insensitive" } },
          ],
        },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
        take: 50,
      })
    : [];
  const middleNameVariants = possibleVariants.filter((player) =>
    isMiddleNameVariant(cleanedName, player.displayName),
  );

  if (middleNameVariants.length) {
    return {
      action: "blocked",
      reason: `Possible existing Player for ${cleanedName}: ${middleNameVariants
        .map((player) => player.displayName)
        .join(", ")}. Review the duplicate candidate and add a PlayerAlias after confirming identity.`,
    };
  }
  return { action: "create" };
}
