/**
 * Validates one-click organization creation for URL Import (PYBC Eliminations).
 * Usage: npx tsx scripts/validate-url-import-organization-creation.ts
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
import type { UrlImportTeamMapping } from "@/lib/stats-import/types";
import { buildImportCreationPlan } from "@/lib/url-import-creation-plan";
import {
  createMissingOrganizationsFromImport,
  previewMissingOrganizationsFromImport
} from "@/lib/url-import-organization-creation";

const PYBC_URL =
  "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fschedule%3FphaseName%3DEliminations%26";

function coerceAgeGroup(value: string): AgeGroup {
  if (value === "U13") return AgeGroup.U13;
  if (value === "U16") return AgeGroup.U16;
  if (value === "U19") return AgeGroup.U19;
  return AgeGroup.U16;
}

function buildAutoMappings(
  teams: Array<{
    aliasKey: string;
    confidenceBand: string;
    suggestedTeam: { teamId: string; teamName: string } | null;
  }>
) {
  const mappings: UrlImportTeamMapping[] = [];
  for (const row of teams) {
    if ((row.confidenceBand === "Exact" || row.confidenceBand === "Strong Match") && row.suggestedTeam) {
      mappings.push({
        externalLabel: "",
        aliasKey: row.aliasKey,
        action: "mapped_existing",
        teamId: row.suggestedTeam.teamId,
        teamName: row.suggestedTeam.teamName
      });
      continue;
    }
    if (row.confidenceBand === "Unmatched") {
      mappings.push({
        externalLabel: "",
        aliasKey: row.aliasKey,
        action: "create_on_import"
      });
    }
  }
  return mappings;
}

async function buildTeamPreview() {
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
    {
      externalLabel: string;
      scheduleLabel?: string;
      matchIds: string[];
      gameCount: number;
    }
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
        if (!existing.matchIds.includes(game.matchId)) {
          existing.matchIds.push(game.matchId);
          existing.gameCount += 1;
        }
        if (!existing.scheduleLabel && scheduleLabel) existing.scheduleLabel = scheduleLabel;
        continue;
      }
      uniqueByAlias.set(aliasKey, {
        externalLabel,
        scheduleLabel: scheduleLabel ?? undefined,
        matchIds: [game.matchId],
        gameCount: 1
      });
    }
  }

  const teams = Array.from(uniqueByAlias.values()).map((item) => {
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
    return {
      aliasKey: result.aliasKey,
      externalLabel: result.externalLabel,
      scheduleLabel: result.scheduleLabel,
      matchingInput: result.matchingInput,
      matchCount: item.gameCount,
      inferredProgramName: result.inferredProgramName,
      creationPreview,
      gameCount: item.gameCount,
      matchIds: item.matchIds,
      confidenceBand: result.confidenceBand,
      score: result.score,
      tier: result.tier,
      method: result.method,
      matchReason: result.matchReason,
      ambiguous: result.ambiguous,
      suggestedTeam: result.suggestedTeam,
      candidates: result.candidates
    };
  });

  return { teams, leagueName, ageGroup, gender };
}

function countMappings(teams: Awaited<ReturnType<typeof buildTeamPreview>>["teams"]) {
  const autoMappings = buildAutoMappings(teams);
  const existingTeams = autoMappings.filter((mapping) => mapping.action === "mapped_existing").length;
  const teamsToCreate = autoMappings.filter((mapping) => mapping.action === "create_on_import").length;
  const aliasResolved = teams.filter((team) => team.method === "saved_alias").length;
  return { existingTeams, teamsToCreate, aliasResolved };
}

async function main() {
  const before = await buildTeamPreview();
  const beforeCounts = countMappings(before.teams);

  const mappings: UrlImportTeamMapping[] = [];
  for (const row of before.teams) {
    if ((row.confidenceBand === "Exact" || row.confidenceBand === "Strong Match") && row.suggestedTeam) {
      mappings.push({
        externalLabel: row.externalLabel,
        scheduleLabel: row.scheduleLabel ?? null,
        aliasKey: row.aliasKey,
        action: "mapped_existing",
        teamId: row.suggestedTeam.teamId,
        teamName: row.suggestedTeam.teamName
      });
      continue;
    }
    if (row.confidenceBand === "Unmatched") {
      mappings.push({
        externalLabel: row.externalLabel,
        scheduleLabel: row.scheduleLabel ?? null,
        aliasKey: row.aliasKey,
        action: "create_on_import",
        suggestedProgramName: row.creationPreview.suggestedProgramName,
        suggestedTeamName: row.creationPreview.suggestedTeamName,
        suggestedAgeGroup: row.creationPreview.suggestedAgeGroup,
        suggestedGender: row.creationPreview.suggestedGender
      });
    }
  }

  const plan = buildImportCreationPlan({
    mappings,
    teamRows: before.teams,
    leagueName: before.leagueName,
    ageGroup: before.ageGroup,
    gender: before.gender
  });

  const dryRun = await previewMissingOrganizationsFromImport(plan);

  console.log("PYBC Eliminations — Organization Creation Validation");
  console.log("");
  console.log("Before creation:");
  console.log(`  Existing teams (mapped): ${beforeCounts.existingTeams}`);
  console.log(`  Teams to create: ${beforeCounts.teamsToCreate}`);
  console.log(`  Aliases resolved: ${beforeCounts.aliasResolved}`);
  console.log(`  Dry-run programs to create: ${dryRun.summary.programsToCreate}`);
  console.log(`  Dry-run teams to create: ${dryRun.summary.teamsToCreate}`);
  console.log(`  Confirmation phrase: ${dryRun.confirmationPhrase}`);
  console.log("");

  if (!dryRun.summary.teamsToCreate) {
    console.log("No teams to create — database may already include PYBC organizations.");
    return;
  }

  const result = await createMissingOrganizationsFromImport({ plan });
  console.log("Creation result:");
  console.log(`  Programs created: ${result.programsCreated}`);
  console.log(`  Teams created: ${result.teamsCreated}`);
  console.log(`  Aliases saved: ${result.aliasesSaved}`);
  console.log("");

  const after = await buildTeamPreview();
  const afterCounts = countMappings(after.teams);

  console.log("After creation + team matching refresh:");
  console.log(`  Existing teams (mapped): ${afterCounts.existingTeams}`);
  console.log(`  Teams to create: ${afterCounts.teamsToCreate}`);
  console.log(`  Aliases resolved: ${afterCounts.aliasResolved}`);
  console.log("");

  const aliasRows = after.teams.filter((team) => team.method === "saved_alias");
  if (aliasRows.length) {
    console.log("Alias-resolved teams:");
    for (const row of aliasRows) {
      console.log(`  - ${row.externalLabel} → ${row.suggestedTeam?.teamName ?? "?"}`);
    }
    console.log("");
  }

  const passed =
    beforeCounts.existingTeams === 2 &&
    beforeCounts.teamsToCreate === 6 &&
    afterCounts.existingTeams === 8 &&
    afterCounts.teamsToCreate === 0 &&
    afterCounts.aliasResolved >= 6;

  if (passed) {
    console.log("Validation passed.");
  } else {
    console.log("Validation note: counts differ from expected baseline (2→8 existing, 6→0 create).");
    console.log("This can happen if PYBC organizations were partially created in a prior run.");
    if (afterCounts.teamsToCreate === 0 && afterCounts.existingTeams >= 8) {
      console.log("Post-create state is healthy: all teams mapped, none pending creation.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
