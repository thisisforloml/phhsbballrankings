import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { StatsImportProviderId, UrlImportTeamMapping } from "@/lib/stats-import/types";
import { getTeamDisplayName, normalizeProgramAlias } from "@/lib/uaap-school-display";

export type TeamExternalAliasRecord = {
  teamId: string;
  externalLabel: string;
  normalizedExternalLabel: string;
};

export type TeamExternalAliasCandidate = {
  externalLabel: string;
  teamId: string;
};

export function normalizeExternalTeamLabel(label: string) {
  return normalizeProgramAlias(getTeamDisplayName(label.trim()));
}

export function labelsForExternalAlias(externalLabel: string, scheduleLabel?: string | null) {
  const labels = [externalLabel.trim()].filter(Boolean);
  const schedule = scheduleLabel?.trim();
  if (schedule && normalizeExternalTeamLabel(schedule) !== normalizeExternalTeamLabel(externalLabel)) {
    labels.push(schedule);
  }
  return labels;
}

export async function upsertTeamExternalAliasBatch(
  db: Prisma.TransactionClient | typeof prisma,
  provider: StatsImportProviderId,
  candidates: TeamExternalAliasCandidate[]
) {
  const batch = candidates
    .map((candidate) => ({
      provider,
      externalLabel: candidate.externalLabel.trim(),
      normalizedExternalLabel: normalizeExternalTeamLabel(candidate.externalLabel),
      teamId: candidate.teamId
    }))
    .filter((candidate) => candidate.externalLabel);

  const uniqueByKey = new Map(
    batch.map((candidate) => [candidate.normalizedExternalLabel, candidate])
  );
  const uniqueBatch = Array.from(uniqueByKey.values());
  if (!uniqueBatch.length) return { aliasesSaved: 0, newAliasesCreated: 0 };

  const existing = await db.teamExternalAlias.findMany({
    where: {
      provider,
      normalizedExternalLabel: { in: uniqueBatch.map((item) => item.normalizedExternalLabel) }
    },
    select: { normalizedExternalLabel: true }
  });
  const existingKeys = new Set(existing.map((row) => row.normalizedExternalLabel));

  await Promise.all(
    uniqueBatch.map((candidate) =>
      db.teamExternalAlias.upsert({
        where: {
          provider_normalizedExternalLabel: {
            provider: candidate.provider,
            normalizedExternalLabel: candidate.normalizedExternalLabel
          }
        },
        create: candidate,
        update: {
          externalLabel: candidate.externalLabel,
          teamId: candidate.teamId
        }
      })
    )
  );

  const newAliasesCreated = uniqueBatch.filter((item) => !existingKeys.has(item.normalizedExternalLabel)).length;
  return { aliasesSaved: uniqueBatch.length, newAliasesCreated };
}

export async function loadTeamExternalAliasMap(provider: StatsImportProviderId) {
  const rows = await prisma.teamExternalAlias.findMany({
    where: { provider },
    select: {
      teamId: true,
      externalLabel: true,
      normalizedExternalLabel: true
    }
  });

  return new Map(rows.map((row) => [row.normalizedExternalLabel, row]));
}

function labelsForAliasPersistence(mapping: UrlImportTeamMapping) {
  return labelsForExternalAlias(mapping.externalLabel, mapping.scheduleLabel);
}

export async function persistTeamExternalAliasesFromSourceMappings(input: {
  provider: StatsImportProviderId;
  mappings: Array<{ externalLabel: string; scheduleLabel?: string | null; teamId: string }>;
}) {
  const candidates: TeamExternalAliasCandidate[] = [];
  for (const mapping of input.mappings) {
    for (const label of labelsForExternalAlias(mapping.externalLabel, mapping.scheduleLabel)) {
      candidates.push({ externalLabel: label, teamId: mapping.teamId });
    }
  }
  return upsertTeamExternalAliasBatch(prisma, input.provider, candidates);
}

export async function persistTeamExternalAliases(input: {
  provider: StatsImportProviderId;
  mappings: UrlImportTeamMapping[];
}) {
  const candidates: TeamExternalAliasCandidate[] = [];

  for (const mapping of input.mappings) {
    if (mapping.action !== "mapped_existing" || !mapping.teamId) continue;
    for (const label of labelsForAliasPersistence(mapping)) {
      candidates.push({ externalLabel: label, teamId: mapping.teamId });
    }
  }

  if (!candidates.length) {
    return { newAliasesCreated: 0, aliasesUpdated: 0 };
  }

  const result = await upsertTeamExternalAliasBatch(prisma, input.provider, candidates);

  return {
    newAliasesCreated: result.newAliasesCreated,
    aliasesUpdated: result.aliasesSaved - result.newAliasesCreated
  };
}
