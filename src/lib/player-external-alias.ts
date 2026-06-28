import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { importedPlayerKey } from "@/lib/player-import-matching";
import type { StatsImportProviderId, UrlImportPlayerMapping } from "@/lib/stats-import/types";

export type PlayerExternalAliasRecord = {
  playerId: string;
  externalLabel: string;
  normalizedExternalLabel: string;
};

export type PlayerExternalAliasCandidate = {
  teamLabel: string;
  cleanedName: string;
  playerId: string;
};

export function normalizePlayerExternalAliasKey(teamLabel: string, cleanedName: string) {
  return importedPlayerKey(teamLabel, cleanedName);
}

export function playerExternalAliasLabel(teamLabel: string, cleanedName: string) {
  return `${teamLabel.trim()} | ${cleanedName.trim()}`;
}

export async function upsertPlayerExternalAliasBatch(
  db: Prisma.TransactionClient | typeof prisma,
  provider: StatsImportProviderId,
  candidates: PlayerExternalAliasCandidate[]
) {
  const batch = candidates
    .map((candidate) => ({
      provider,
      externalLabel: playerExternalAliasLabel(candidate.teamLabel, candidate.cleanedName),
      normalizedExternalLabel: normalizePlayerExternalAliasKey(candidate.teamLabel, candidate.cleanedName),
      playerId: candidate.playerId
    }))
    .filter((candidate) => candidate.normalizedExternalLabel);

  const uniqueByKey = new Map(batch.map((candidate) => [candidate.normalizedExternalLabel, candidate]));
  const uniqueBatch = Array.from(uniqueByKey.values());
  if (!uniqueBatch.length) return { aliasesSaved: 0, newAliasesCreated: 0 };

  const existing = await db.playerExternalAlias.findMany({
    where: {
      provider,
      normalizedExternalLabel: { in: uniqueBatch.map((item) => item.normalizedExternalLabel) }
    },
    select: { normalizedExternalLabel: true }
  });
  const existingKeys = new Set(existing.map((row) => row.normalizedExternalLabel));

  await Promise.all(
    uniqueBatch.map((candidate) =>
      db.playerExternalAlias.upsert({
        where: {
          provider_normalizedExternalLabel: {
            provider: candidate.provider,
            normalizedExternalLabel: candidate.normalizedExternalLabel
          }
        },
        create: candidate,
        update: {
          externalLabel: candidate.externalLabel,
          playerId: candidate.playerId
        }
      })
    )
  );

  const newAliasesCreated = uniqueBatch.filter((item) => !existingKeys.has(item.normalizedExternalLabel)).length;
  return { aliasesSaved: uniqueBatch.length, newAliasesCreated };
}

export async function loadPlayerExternalAliasMap(provider: StatsImportProviderId) {
  const rows = await prisma.playerExternalAlias.findMany({
    where: { provider },
    select: {
      playerId: true,
      externalLabel: true,
      normalizedExternalLabel: true
    }
  });

  return new Map(rows.map((row) => [row.normalizedExternalLabel, row]));
}

export async function persistPlayerExternalAliases(input: {
  provider: StatsImportProviderId;
  mappings: UrlImportPlayerMapping[];
}) {
  const candidates: PlayerExternalAliasCandidate[] = [];

  for (const mapping of input.mappings) {
    if (mapping.action !== "mapped_existing" || !mapping.playerId) continue;
    candidates.push({
      teamLabel: mapping.teamLabel,
      cleanedName: mapping.cleanedName,
      playerId: mapping.playerId
    });
  }

  if (!candidates.length) {
    return { newAliasesCreated: 0, aliasesUpdated: 0 };
  }

  const result = await upsertPlayerExternalAliasBatch(prisma, input.provider, candidates);

  return {
    newAliasesCreated: result.newAliasesCreated,
    aliasesUpdated: result.aliasesSaved - result.newAliasesCreated
  };
}
