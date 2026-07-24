import type { Prisma } from "@prisma/client";

import { importedPlayerKey } from "@/lib/player-import-matching";

export type PersistedPlayerMappingDecision = {
  importedName: string;
  cleanedName: string;
  teamLabel: string;
  mappedTeamName: string | null;
  action: "mapped_existing" | "create_on_import";
  playerId: string | null;
  playerName: string | null;
  identityKeys: string[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function serializePlayerMappingDecisions(
  mappings: Array<{
    importedName: string;
    cleanedName: string;
    teamLabel: string;
    mappedTeamName?: string | null;
    action: "mapped_existing" | "create_on_import";
    playerId?: string;
    playerName?: string;
  }>,
): Prisma.InputJsonValue {
  return mappings.map((mapping) => {
    const identityKeys = Array.from(new Set([
      importedPlayerKey(mapping.teamLabel, mapping.cleanedName),
      mapping.mappedTeamName ? importedPlayerKey(mapping.mappedTeamName, mapping.cleanedName) : "",
    ].filter(Boolean)));
    return {
      importedName: mapping.importedName,
      cleanedName: mapping.cleanedName,
      teamLabel: mapping.teamLabel,
      mappedTeamName: mapping.mappedTeamName ?? null,
      action: mapping.action,
      playerId: mapping.playerId ?? null,
      playerName: mapping.playerName ?? null,
      identityKeys,
    };
  }) as Prisma.InputJsonValue;
}

export function readPlayerMappingDecisionMap(validationSummary: unknown) {
  const root = record(validationSummary);
  const raw = root?.importPlayerMappingDecisions;
  if (!Array.isArray(raw)) return new Map<string, PersistedPlayerMappingDecision>();

  const decisions = new Map<string, PersistedPlayerMappingDecision>();
  for (const value of raw) {
    const row = record(value);
    if (!row) continue;
    const action = row.action === "mapped_existing" ? "mapped_existing" : row.action === "create_on_import" ? "create_on_import" : null;
    const cleanedName = string(row.cleanedName);
    const teamLabel = string(row.teamLabel);
    if (!action || !cleanedName || !teamLabel) continue;

    const decision: PersistedPlayerMappingDecision = {
      importedName: string(row.importedName),
      cleanedName,
      teamLabel,
      mappedTeamName: string(row.mappedTeamName) || null,
      action,
      playerId: string(row.playerId) || null,
      playerName: string(row.playerName) || null,
      identityKeys: Array.isArray(row.identityKeys)
        ? row.identityKeys.map(string).filter(Boolean)
        : [],
    };
    const keys = new Set([
      ...decision.identityKeys,
      importedPlayerKey(decision.teamLabel, decision.cleanedName),
      decision.mappedTeamName ? importedPlayerKey(decision.mappedTeamName, decision.cleanedName) : "",
    ].filter(Boolean));
    for (const key of keys) decisions.set(key, decision);
  }
  return decisions;
}

export function findPlayerMappingDecision(
  decisions: Map<string, PersistedPlayerMappingDecision>,
  teamLabel: string,
  cleanedName: string,
) {
  return decisions.get(importedPlayerKey(teamLabel, cleanedName)) ?? null;
}
