/**
 * Validates TeamExternalAlias persistence for URL Import (PYBC Eliminations).
 * Simulates first import (save aliases) then second preview (alias auto-resolve).
 *
 * Usage: npx tsx scripts/validate-team-external-alias.ts
 */
import { AgeGroup, PlayerGender } from "@prisma/client";
import { discoverStatsHubImport } from "@/lib/stats-import/adapters/statshub-v1";
import { fetchFibaTeamLabels } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import { prisma } from "@/lib/prisma";
import {
  externalTeamAliasKey,
  inferTeamCreationPreview,
  loadTeamMatchDbContext,
  matchExternalTeam
} from "@/lib/team-import-matching";
import { persistTeamExternalAliases } from "@/lib/team-external-alias";
import type { UrlImportTeamMapping } from "@/lib/stats-import/types";

const PYBC_URL =
  "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fschedule%3FphaseName%3DEliminations%26";
const PROVIDER = "statshub-v1";

function coerceAgeGroup(value: string): AgeGroup {
  if (value === "U13") return AgeGroup.U13;
  if (value === "U16") return AgeGroup.U16;
  if (value === "U19") return AgeGroup.U19;
  return AgeGroup.U16;
}

type PreviewRow = {
  externalLabel: string;
  scheduleLabel?: string;
  aliasKey: string;
  confidenceBand: string;
  method: string;
  matchReason?: string;
  suggestedTeamId?: string;
  suggestedTeamName?: string;
};

async function buildPreviewRows() {
  const discovery = await discoverStatsHubImport(PYBC_URL);
  const matchIds = discovery.games.map((game) => game.matchId);
  const ageGroup = coerceAgeGroup(discovery.inferredAgeGroup ?? "U13");
  const gender = discovery.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const leagueName = discovery.competitionTitle ?? "PYBC 13U";

  const labelsByMatch = new Map<string, Awaited<ReturnType<typeof fetchFibaTeamLabels>>>();
  for (const matchId of matchIds) {
    labelsByMatch.set(matchId, await fetchFibaTeamLabels(matchId));
  }

  const db = await loadTeamMatchDbContext(PROVIDER);
  const uniqueByAlias = new Map<
    string,
    { externalLabel: string; scheduleLabel?: string; matchIds: string[] }
  >();

  for (const game of discovery.games) {
    const labels = labelsByMatch.get(game.matchId);
    if (!labels) continue;
    for (const [externalLabel, scheduleLabel] of [
      [labels.home, game.homeTeamLabel],
      [labels.away, game.awayTeamLabel]
    ] as const) {
      const aliasKey = externalTeamAliasKey(externalLabel);
      const existing = uniqueByAlias.get(aliasKey);
      if (existing) {
        if (!existing.matchIds.includes(game.matchId)) existing.matchIds.push(game.matchId);
        if (!existing.scheduleLabel && scheduleLabel) existing.scheduleLabel = scheduleLabel;
        continue;
      }
      uniqueByAlias.set(aliasKey, {
        externalLabel,
        scheduleLabel: scheduleLabel ?? undefined,
        matchIds: [game.matchId]
      });
    }
  }

  const rows: PreviewRow[] = Array.from(uniqueByAlias.values()).map((item) => {
    const result = matchExternalTeam(
      {
        externalLabel: item.externalLabel,
        scheduleLabel: item.scheduleLabel ?? null,
        leagueName,
        ageGroup,
        gender,
        competitionId: discovery.competitionId ?? null,
        provider: PROVIDER
      },
      db
    );

    return {
      externalLabel: result.externalLabel,
      scheduleLabel: result.scheduleLabel ?? undefined,
      aliasKey: result.aliasKey,
      confidenceBand: result.confidenceBand,
      method: result.method,
      matchReason: result.matchReason,
      suggestedTeamId: result.suggestedTeam?.teamId,
      suggestedTeamName: result.suggestedTeam?.teamName
    };
  });

  return { rows, discovery, ageGroup, gender, leagueName };
}

function summarize(rows: PreviewRow[], label: string) {
  const aliasesResolved = rows.filter((row) => row.method === "saved_alias").length;
  const autoResolved = rows.filter(
    (row) => row.confidenceBand === "Exact" || row.confidenceBand === "Strong Match"
  ).length;
  const needsReview = rows.filter((row) => row.confidenceBand === "Review Needed").length;
  const unmatched = rows.filter((row) => row.confidenceBand === "Unmatched").length;
  const manualRequired = rows.filter(
    (row) => row.method !== "saved_alias" && row.confidenceBand !== "Exact" && row.confidenceBand !== "Strong Match"
  ).length;

  console.log(label);
  console.log(`  unique teams: ${rows.length}`);
  console.log(`  aliases resolved: ${aliasesResolved}`);
  console.log(`  auto-resolved (exact/strong): ${autoResolved}`);
  console.log(`  needs review: ${needsReview}`);
  console.log(`  unmatched: ${unmatched}`);
  console.log(`  manual mappings required: ${manualRequired}`);
  console.log("");
}

async function main() {
  const savedAliases = await prisma.teamExternalAlias.findMany({
    where: { provider: PROVIDER },
    select: { normalizedExternalLabel: true }
  });
  const savedKeys = new Set(savedAliases.map((row) => row.normalizedExternalLabel));

  const first = await buildPreviewRows();
  summarize(first.rows, "Run 1 — before alias persistence (or cold start)");

  const simulatedMappings: UrlImportTeamMapping[] = [];
  for (const row of first.rows) {
    if (row.method === "saved_alias") continue;
    if (!row.suggestedTeamId || !row.suggestedTeamName) continue;
    if (row.confidenceBand === "Unmatched") continue;

    simulatedMappings.push({
      externalLabel: row.externalLabel,
      scheduleLabel: row.scheduleLabel ?? null,
      aliasKey: row.aliasKey,
      action: "mapped_existing",
      teamId: row.suggestedTeamId,
      teamName: row.suggestedTeamName
    });
  }

  const { newAliasesCreated, aliasesUpdated } = await persistTeamExternalAliases({
    provider: PROVIDER,
    mappings: simulatedMappings
  });

  console.log(`Simulated admin mappings saved: ${simulatedMappings.length} teams`);
  console.log(`  new aliases created: ${newAliasesCreated}`);
  console.log(`  aliases updated: ${aliasesUpdated}`);
  console.log("");

  const second = await buildPreviewRows();
  summarize(second.rows, "Run 2 — after alias persistence");

  const aliasResolvedRows = second.rows.filter((row) => row.method === "saved_alias");
  if (aliasResolvedRows.length) {
    console.log("Alias-resolved teams:");
    for (const row of aliasResolvedRows) {
      console.log(`  - "${row.externalLabel}" → ${row.suggestedTeamName} (${row.matchReason ?? row.method})`);
    }
    console.log("");
  }

  if (savedKeys.size) {
    console.log(`Note: ${savedKeys.size} alias(es) existed before this script run.`);
  }

  const expectedImprovement = simulatedMappings.length > 0 && aliasResolvedRows.length >= simulatedMappings.length;
  if (!expectedImprovement && simulatedMappings.length > 0) {
    console.error("Validation warning: expected more alias resolutions on run 2.");
    process.exitCode = 1;
  } else if (simulatedMappings.length === 0) {
    console.log("No mappable teams with suggestions in run 1 — seed DB teams or map manually in UI first.");
  } else {
    console.log("Validation passed: previously mapped teams auto-resolve via saved aliases.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
