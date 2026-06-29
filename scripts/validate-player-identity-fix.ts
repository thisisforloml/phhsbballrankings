/**
 * Before/after metrics for URL Import player identity fix (PYBC Eliminations).
 * Usage: npx tsx scripts/validate-player-identity-fix.ts
 */
import { AgeGroup, PlayerGender } from "@prisma/client";
import { discoverStatsHubImport } from "@/lib/stats-import/adapters/statshub-v1";
import { canonicalPlayerName, fetchFibaMatchData, isAbbreviatedPlayerName } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import { fetchFibaTeamLabels } from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import {
  externalTeamAliasKey,
  inferTeamCreationPreview,
  loadTeamMatchDbContext,
  matchExternalTeam
} from "@/lib/team-import-matching";
import type { UrlImportTeamMapping } from "@/lib/stats-import/types";
import { buildUrlImportPlayerMatchingPreview } from "@/lib/url-import-player-preview";
import { prepareImportedPlayerName } from "@/lib/player-import-identity";
import { importedPlayerKey, loadPlayerMatchDbContext, matchImportedPlayer } from "@/lib/player-import-matching";

const PYBC_URL =
  "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fschedule%3FphaseName%3DEliminations%26";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Pre-fix resolution order (abbreviated scoreboard preferred). */
function legacyFibaPlayerDisplayName(player: Record<string, unknown>): string {
  const cName = stringValue(player.cName);
  if (cName) return cName.replace(/^\*+/, "").trim();
  const scoreboardName = stringValue(player.scoreboardName);
  if (scoreboardName) return scoreboardName.replace(/^\*+/, "").trim();
  const displayName = stringValue(player.name);
  if (displayName) return displayName.replace(/^\*+/, "").trim();
  const combined = `${stringValue(player.firstName)} ${stringValue(player.familyName)}`.trim();
  if (combined) return combined;
  const intCombined = `${stringValue(player.internationalFirstName)} ${stringValue(player.internationalFamilyName)}`.trim();
  if (intCombined) return intCombined;
  return "Unknown player";
}

function coerceAgeGroup(value: string): AgeGroup {
  if (value === "U13") return AgeGroup.U13;
  if (value === "U16") return AgeGroup.U16;
  if (value === "U19") return AgeGroup.U19;
  return AgeGroup.U16;
}

async function buildTeamMappings(discovery: Awaited<ReturnType<typeof discoverStatsHubImport>>) {
  const ageGroup = coerceAgeGroup(discovery.inferredAgeGroup ?? "U13");
  const gender = discovery.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const leagueName = discovery.competitionTitle ?? "PYBC 13U";
  const labelsByMatch = new Map<string, Awaited<ReturnType<typeof fetchFibaTeamLabels>>>();
  for (const game of discovery.games) {
    labelsByMatch.set(game.matchId, await fetchFibaTeamLabels(game.matchId));
  }
  const db = await loadTeamMatchDbContext();
  const teamMappings: UrlImportTeamMapping[] = [];
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
  return teamMappings;
}

async function collectUniquePlayerNames(matchIds: string[], resolver: (player: Record<string, unknown>) => string) {
  const names = new Set<string>();
  for (const matchId of matchIds) {
    const data = await fetchFibaMatchData(matchId);
    for (const side of ["1", "2"] as const) {
      for (const player of Object.values(data.tm?.[side]?.pl ?? {})) {
        const name = prepareImportedPlayerName(resolver(player));
        if (name && name !== "Unknown player") names.add(name);
      }
    }
  }
  return names;
}

async function simulateLegacyMatching(
  matchIds: string[],
  teamMappings: UrlImportTeamMapping[],
  gender: PlayerGender
) {
  const teamMappingByLabel = new Map(teamMappings.map((m) => [m.externalLabel, m]));
  const teamMappingByAlias = new Map(teamMappings.map((m) => [m.aliasKey, m]));
  const uniqueByKey = new Map<
    string,
    { importedName: string; mappedTeamId: string | null }
  >();

  for (const matchId of matchIds) {
    const data = await fetchFibaMatchData(matchId);
    for (const side of ["1", "2"] as const) {
      const team = data.tm?.[side];
      if (!team) continue;
      const teamLabel = stringValue(team.shortName) || stringValue(team.code) || stringValue(team.name) || "Unknown team";
      for (const player of Object.values(team.pl ?? {})) {
        const importedName = legacyFibaPlayerDisplayName(player);
        const cleanedName = prepareImportedPlayerName(importedName);
        const aliasKey = externalTeamAliasKey(teamLabel);
        const teamMapping =
          teamMappingByLabel.get(teamLabel) ?? teamMappingByAlias.get(aliasKey);
        const mappedTeamId =
          teamMapping?.action === "mapped_existing" && teamMapping.teamId ? teamMapping.teamId : null;
        const playerKey = importedPlayerKey(teamLabel, cleanedName);
        if (!uniqueByKey.has(playerKey)) {
          uniqueByKey.set(playerKey, { importedName, mappedTeamId });
        }
      }
    }
  }

  const scopedTeamIds = Array.from(
    new Set(
      Array.from(uniqueByKey.values())
        .map((v) => v.mappedTeamId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const db = await loadPlayerMatchDbContext(scopedTeamIds, gender);
  let exact = 0;
  let strong = 0;
  let review = 0;
  let unmatched = 0;
  for (const row of uniqueByKey.values()) {
    const result = matchImportedPlayer(
      { importedName: row.importedName, gender, scopedTeamId: row.mappedTeamId },
      db
    );
    if (result.confidenceBand === "Exact") exact++;
    else if (result.confidenceBand === "Strong Match") strong++;
    else if (result.confidenceBand === "Review Needed") review++;
    else unmatched++;
  }
  return { exact, strong, review, unmatched, uniquePlayers: uniqueByKey.size };
}

async function main() {
  const discovery = await discoverStatsHubImport(PYBC_URL);
  const matchIds = discovery.games.map((game) => game.matchId);
  const gender = discovery.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const teamMappings = await buildTeamMappings(discovery);

  const beforeNames = await collectUniquePlayerNames(matchIds, legacyFibaPlayerDisplayName);
  const afterNames = await collectUniquePlayerNames(matchIds, canonicalPlayerName);

  const beforeAbbreviated = Array.from(beforeNames).filter(isAbbreviatedPlayerName).length;
  const afterAbbreviated = Array.from(afterNames).filter(isAbbreviatedPlayerName).length;

  const legacyMatch = await simulateLegacyMatching(matchIds, teamMappings, gender);
  const preview = await buildUrlImportPlayerMatchingPreview({ matchIds, teamMappings, gender });

  const exactAfter = preview.players.filter((p) => p.confidenceBand === "Exact").length;
  const strongAfter = preview.players.filter((p) => p.confidenceBand === "Strong Match").length;
  const reviewAfter = preview.players.filter((p) => p.confidenceBand === "Review Needed").length;
  const unmatchedAfter = preview.players.filter((p) => p.confidenceBand === "Unmatched").length;

  console.log("PYBC Eliminations — Player Identity Fix Metrics");
  console.log("");
  console.log("| Metric | Before | After |");
  console.log("|--------|--------|-------|");
  console.log(`| Unique players | ${beforeNames.size} | ${afterNames.size} |`);
  console.log(`| Abbreviated names | ${beforeAbbreviated} | ${afterAbbreviated} |`);
  console.log(
    `| Exact matches | ${legacyMatch.exact} | ${exactAfter} |`
  );
  console.log(
    `| Strong matches | ${legacyMatch.strong} | ${strongAfter} |`
  );
  console.log(
    `| Review needed | ${legacyMatch.review} | ${reviewAfter} |`
  );
  console.log(
    `| Unmatched (new players) | ${legacyMatch.unmatched} | ${unmatchedAfter} |`
  );
  console.log("");
  console.log("Example name changes:");
  const examples = ["Cruz", "Araneta", "Santos", "Suangco"];
  for (const matchId of matchIds.slice(0, 8)) {
    const data = await fetchFibaMatchData(matchId);
    for (const side of ["1", "2"] as const) {
      for (const player of Object.values(data.tm?.[side]?.pl ?? {})) {
        const blob = JSON.stringify(player);
        if (!examples.some((e) => blob.includes(e))) continue;
        const before = legacyFibaPlayerDisplayName(player);
        const after = canonicalPlayerName(player);
        if (before !== after) {
          console.log(`  ${before} → ${after}`);
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
