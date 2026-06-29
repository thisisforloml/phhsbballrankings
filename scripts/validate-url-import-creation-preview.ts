/**
 * Read-only validation for URL Import Team Creation Preview (PYBC Eliminations).
 * Usage: npx tsx scripts/validate-url-import-creation-preview.ts
 */
import { AgeGroup, PlayerGender } from "@prisma/client";
import { discoverStatsHubImport } from "@/lib/stats-import/adapters/statshub-v1";
import { fetchFibaTeamLabels } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import {
  externalTeamAliasKey,
  inferTeamCreationPreview,
  loadTeamMatchDbContext,
  matchExternalTeam
} from "@/lib/team-import-matching";
import type { TeamMatchPreviewRow, UrlImportTeamMapping } from "@/lib/stats-import/types";
import { buildImportCreationPlan, creationPlanToExportJson } from "@/lib/url-import-creation-plan";

const PYBC_URL =
  "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fschedule%3FphaseName%3DEliminations%26";

function coerceAgeGroup(value: string): AgeGroup {
  if (value === "U13") return AgeGroup.U13;
  if (value === "U16") return AgeGroup.U16;
  if (value === "U19") return AgeGroup.U19;
  return AgeGroup.U16;
}

async function main() {
  const discovery = await discoverStatsHubImport(PYBC_URL);
  const matchIds = discovery.games.map((game) => game.matchId);
  const ageGroup = coerceAgeGroup(discovery.inferredAgeGroup ?? "U13");
  const gender = discovery.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const leagueName = discovery.competitionTitle ?? "PYBC 13U";

  const labelsByMatch = new Map<string, Awaited<ReturnType<typeof fetchFibaTeamLabels>>>();
  for (const matchId of matchIds) {
    labelsByMatch.set(matchId, await fetchFibaTeamLabels(matchId));
  }

  const db = await loadTeamMatchDbContext();
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

  const rows = Array.from(uniqueByAlias.values()).map((item) => {
    const result = matchExternalTeam(
      {
        externalLabel: item.externalLabel,
        scheduleLabel: item.scheduleLabel ?? null,
        leagueName,
        ageGroup,
        gender,
        competitionId: discovery.competitionId ?? null,
        provider: "statshub-v1"
      },
      db
    );
    const creationPreview = inferTeamCreationPreview({
      externalLabel: item.externalLabel,
      scheduleLabel: item.scheduleLabel ?? null,
      matchingInput: result.matchingInput,
      leagueName,
      ageGroup,
      gender
    });
    const autoMapped =
      (result.confidenceBand === "Exact" || result.confidenceBand === "Strong Match") && result.suggestedTeam;
    const createOnImport = result.confidenceBand === "Unmatched";
    return {
      aliasKey: result.aliasKey,
      externalLabel: item.externalLabel,
      scheduleLabel: item.scheduleLabel ?? null,
      matchIds: item.matchIds,
      gameCount: item.matchIds.length,
      result,
      creationPreview,
      autoMapped,
      createOnImport
    };
  });

  const teamRows: TeamMatchPreviewRow[] = rows.map((row) => ({
    aliasKey: row.aliasKey,
    externalLabel: row.externalLabel,
    scheduleLabel: row.scheduleLabel,
    matchingInput: row.result.matchingInput,
    matchCount: row.gameCount,
    inferredProgramName: row.result.inferredProgramName,
    creationPreview: row.creationPreview,
    gameCount: row.gameCount,
    matchIds: row.matchIds,
    confidenceBand: row.result.confidenceBand,
    score: row.result.score,
    tier: row.result.tier,
    method: row.result.method,
    ambiguous: row.result.ambiguous,
    suggestedTeam: row.result.suggestedTeam,
    candidates: row.result.candidates.map((candidate) => ({
      teamId: candidate.teamId,
      teamName: candidate.teamName,
      programName: candidate.programName,
      score: candidate.score,
      tier: candidate.tier,
      method: candidate.method
    }))
  }));

  const mappings: UrlImportTeamMapping[] = rows
    .filter((row) => row.createOnImport)
    .map((row) => ({
      externalLabel: row.externalLabel,
      scheduleLabel: row.scheduleLabel,
      aliasKey: row.aliasKey,
      action: "create_on_import" as const,
      suggestedProgramName: row.creationPreview.suggestedProgramName,
      suggestedTeamName: row.creationPreview.suggestedTeamName,
      suggestedAgeGroup: row.creationPreview.suggestedAgeGroup,
      suggestedGender: row.creationPreview.suggestedGender
    }));

  const creationPlan = buildImportCreationPlan({
    mappings,
    teamRows,
    leagueName,
    ageGroup: discovery.inferredAgeGroup ?? "U13",
    gender: discovery.inferredGender
  });

  const exportJson = creationPlanToExportJson(creationPlan);

  const existing = rows.filter((row) => row.autoMapped);
  const toCreate = rows.filter((row) => row.createOnImport);

  console.log("PYBC Eliminations validation");
  console.log(`Games: ${matchIds.length}`);
  console.log(`Unique teams: ${rows.length}`);
  console.log(`Existing teams (Exact/Strong): ${existing.length}`);
  console.log(`Teams to create (Unmatched): ${toCreate.length}`);
  console.log("");
  console.log("Existing teams:");
  for (const row of existing) {
    console.log(`  - ${row.result.externalLabel} → ${row.result.suggestedTeam?.teamName}`);
  }
  console.log("");
  console.log("Teams to create (examples):");
  for (const row of toCreate.slice(0, 5)) {
    console.log(
      `  - team: ${row.creationPreview.suggestedTeamName} | program: ${row.creationPreview.suggestedProgramName} | schedule: ${row.creationPreview.scheduleLabel ?? "—"}`
    );
  }
  if (toCreate.length > 5) {
    console.log(`  ... and ${toCreate.length - 5} more`);
  }

  console.log("");
  console.log("Missing Teams Workspace (creation plan):");
  console.log(`Programs to create: ${creationPlan.summary.programCount}`);
  console.log(`Teams to create: ${creationPlan.summary.teamCount}`);
  console.log(`Games affected: ${creationPlan.summary.gamesAffected}`);
  console.log("");
  console.log("Grouped programs:");
  for (const program of creationPlan.programs.slice(0, 5)) {
    console.log(`  ${program.suggestedProgramName}`);
    for (const team of program.teams) {
      console.log(`    - ${team.suggestedTeamName} (${team.gameCount} games)`);
    }
  }

  const exportTeamNames = exportJson.teams.map((team) => team.suggestedTeamName).sort();
  const planTeamNames = creationPlan.teams.map((team) => team.suggestedTeamName).sort();
  const exportMatchesPlan = JSON.stringify(exportTeamNames) === JSON.stringify(planTeamNames);
  console.log("");
  console.log(`Export JSON teams match workspace: ${exportMatchesPlan ? "yes" : "NO"}`);
  if (!creationPlan.summary.programCount || !creationPlan.summary.teamCount) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
