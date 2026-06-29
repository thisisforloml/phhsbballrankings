/**
 * Read-only validation for URL Import Player Matching Preview (PYBC Eliminations).
 * Usage: npx tsx scripts/validate-url-import-player-matching.ts
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
import { buildUrlImportPlayerMatchingPreview } from "@/lib/url-import-player-preview";

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
  const teamMappings: UrlImportTeamMapping[] = [];
  const teamRows: TeamMatchPreviewRow[] = [];

  const uniqueByAlias = new Map<string, { externalLabel: string; scheduleLabel?: string }>();
  for (const game of discovery.games) {
    const labels = labelsByMatch.get(game.matchId);
    if (!labels) continue;
    for (const [externalLabel, scheduleLabel] of [
      [labels.home, game.homeTeamLabel],
      [labels.away, game.awayTeamLabel]
    ] as const) {
      const aliasKey = externalTeamAliasKey(externalLabel);
      if (uniqueByAlias.has(aliasKey)) continue;
      uniqueByAlias.set(aliasKey, { externalLabel, scheduleLabel: scheduleLabel ?? undefined });
    }
  }

  for (const item of uniqueByAlias.values()) {
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

    teamRows.push({
      aliasKey: result.aliasKey,
      externalLabel: item.externalLabel,
      scheduleLabel: item.scheduleLabel ?? null,
      matchingInput: result.matchingInput,
      matchCount: 0,
      inferredProgramName: result.inferredProgramName,
      creationPreview,
      gameCount: 0,
      matchIds: [],
      confidenceBand: result.confidenceBand,
      score: result.score,
      tier: result.tier,
      method: result.method,
      matchReason: result.matchReason,
      ambiguous: result.ambiguous,
      suggestedTeam: result.suggestedTeam,
      candidates: result.candidates.map((candidate) => ({
        teamId: candidate.teamId,
        teamName: candidate.teamName,
        programName: candidate.programName,
        score: candidate.score,
        tier: candidate.tier,
        method: candidate.method
      }))
    });

    if ((result.confidenceBand === "Exact" || result.confidenceBand === "Strong Match") && result.suggestedTeam) {
      teamMappings.push({
        externalLabel: item.externalLabel,
        scheduleLabel: item.scheduleLabel ?? null,
        aliasKey: result.aliasKey,
        action: "mapped_existing",
        teamId: result.suggestedTeam.teamId,
        teamName: result.suggestedTeam.teamName
      });
      continue;
    }

    teamMappings.push({
      externalLabel: item.externalLabel,
      scheduleLabel: item.scheduleLabel ?? null,
      aliasKey: result.aliasKey,
      action: "create_on_import",
      suggestedProgramName: creationPreview.suggestedProgramName,
      suggestedTeamName: creationPreview.suggestedTeamName,
      suggestedAgeGroup: creationPreview.suggestedAgeGroup,
      suggestedGender: creationPreview.suggestedGender
    });
  }

  const preview = await buildUrlImportPlayerMatchingPreview({
    matchIds,
    teamMappings,
    teamPreviewRows: teamRows,
    gender
  });

  const matched = preview.players.filter(
    (player) => player.confidenceBand === "Exact" || player.confidenceBand === "Strong Match"
  );
  const reviewNeeded = preview.players.filter((player) => player.confidenceBand === "Review Needed");
  const createOnImport = preview.players.filter((player) => player.confidenceBand === "Unmatched");

  console.log("PYBC Eliminations player matching validation");
  console.log(`Games: ${matchIds.length}`);
  console.log(`Unique players: ${preview.uniquePlayers}`);
  console.log(`Auto matched (Exact/Strong): ${matched.length}`);
  console.log(`Needs review: ${reviewNeeded.length}`);
  console.log(`New players (Unmatched): ${createOnImport.length}`);
  console.log(`Auto-resolution rate: ${preview.diagnostics.autoResolutionRate}%`);
  console.log(`Aliases resolved: ${preview.diagnostics.aliasesResolved}`);
  console.log(
    `Provisional scope: ${preview.diagnostics.provisionalScopedPlayers} players · ${preview.diagnostics.provisionalScopedTeams} teams`
  );
  console.log("");
  console.log("Matched players (examples):");
  for (const player of matched.slice(0, 5)) {
    console.log(`  - ${player.cleanedName} (${player.mappedTeamName}) → ${player.suggestedPlayer?.displayName ?? "—"}`);
  }
  console.log("");
  console.log("Review-needed players (examples):");
  for (const player of reviewNeeded.slice(0, 5)) {
    console.log(`  - ${player.cleanedName} (${player.mappedTeamName}) → ${player.suggestedPlayer?.displayName ?? "—"}`);
  }
  console.log("");
  console.log("Create-on-import players (examples):");
  for (const player of createOnImport.slice(0, 5)) {
    console.log(`  - ${player.cleanedName} (${player.mappedTeamName})`);
  }
  if (createOnImport.length > 5) {
    console.log(`  ... and ${createOnImport.length - 5} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
