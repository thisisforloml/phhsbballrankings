/**
 * Phase B.3 player matching metrics for PYBC, Filoil, and JCIM.
 * Usage: npx tsx scripts/validate-player-matching-phase-a.ts
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

const TOURNAMENTS = [
  {
    key: "pybc",
    url: "https://www.statshubph.info/pybc-13u?WHurl=%2Fcompetition%2F47340%2Fschedule%3FphaseName%3DEliminations%26",
    label: "PYBC Eliminations"
  },
  {
    key: "filoil",
    url: "https://www.statshubph.info/filoil19",
    label: "Filoil S19 Preseason"
  },
  {
    key: "jcim",
    url: "https://www.statshubph.info/jcimbl2026-ml",
    label: "JCIM 2026 Main League"
  }
];

const PHASE_B2_BASELINE: Record<
  string,
  {
    autoResolutionRate: number;
    createOnImport: number;
    blockedAmbiguity: number;
    scopedMatchRate: number;
    programScopedMatchRate: number;
  }
> = {
  pybc: {
    autoResolutionRate: 3,
    createOnImport: 122,
    blockedAmbiguity: 14,
    scopedMatchRate: 0,
    programScopedMatchRate: 0
  },
  filoil: {
    autoResolutionRate: 13,
    createOnImport: 154,
    blockedAmbiguity: 9,
    scopedMatchRate: 11,
    programScopedMatchRate: 0
  },
  jcim: {
    autoResolutionRate: 5,
    createOnImport: 61,
    blockedAmbiguity: 32,
    scopedMatchRate: 0,
    programScopedMatchRate: 0
  }
};

function coerceAgeGroup(value: string): AgeGroup {
  if (value === "U13") return AgeGroup.U13;
  if (value === "U16") return AgeGroup.U16;
  if (value === "U19") return AgeGroup.U19;
  return AgeGroup.U16;
}

async function buildTeamContext(
  discovery: Awaited<ReturnType<typeof discoverStatsHubImport>>,
  matchIds: string[]
) {
  const ageGroup = coerceAgeGroup(discovery.inferredAgeGroup ?? "U16");
  const gender = discovery.inferredGender === "GIRLS" ? PlayerGender.GIRLS : PlayerGender.BOYS;
  const leagueName = discovery.competitionTitle ?? discovery.sourceUrl;
  const labelsByMatch = new Map<string, Awaited<ReturnType<typeof fetchFibaTeamLabels>>>();

  for (const matchId of matchIds) {
    labelsByMatch.set(matchId, await fetchFibaTeamLabels(matchId));
  }

  const db = await loadTeamMatchDbContext();
  const uniqueByAlias = new Map<
    string,
    { externalLabel: string; scheduleLabel?: string; matchIds: string[] }
  >();

  for (const game of discovery.games.filter((game) => matchIds.includes(game.matchId))) {
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

  const teamRows: TeamMatchPreviewRow[] = [];
  const teamMappings: UrlImportTeamMapping[] = [];

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
      matchCount: item.matchIds.length,
      inferredProgramName: result.inferredProgramName,
      creationPreview,
      gameCount: item.matchIds.length,
      matchIds: item.matchIds,
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
    } else {
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
  }

  return { teamRows, teamMappings, gender, ageGroup, leagueName };
}

async function metricsForTournament(entry: (typeof TOURNAMENTS)[number]) {
  const discovery = await discoverStatsHubImport(entry.url);
  const matchIds = discovery.games
    .filter((game) => game.status === "final" && game.statsAvailable)
    .map((game) => game.matchId);
  const simulatedIds = matchIds.length
    ? matchIds
    : discovery.games.filter((game) => game.status === "final").map((game) => game.matchId);

  const { teamRows, teamMappings, gender } = await buildTeamContext(discovery, simulatedIds);
  const preview = await buildUrlImportPlayerMatchingPreview({
    matchIds: simulatedIds,
    teamMappings,
    teamPreviewRows: teamRows,
    gender
  });

  const autoMatched = preview.diagnostics.autoMatched;
  const suppressed = preview.diagnostics.suppressedAutoMatches;
  const uniquePlayers = preview.uniquePlayers;
  const previousAutoMatched = autoMatched + suppressed;
  const previousAutoRate = uniquePlayers ? Math.round((previousAutoMatched / uniquePlayers) * 100) : 0;

  return {
    tournament: entry.label,
    games: simulatedIds.length,
    teams: teamRows.length,
    players: uniquePlayers,
    autoResolutionRate: preview.diagnostics.autoResolutionRate,
    previousAutoResolutionRate: previousAutoRate,
    suppressedAutoMatches: suppressed,
    suppressedAutoMatchesByMethod: preview.diagnostics.suppressedAutoMatchesByMethod,
    candidateOnlySuggestions: preview.diagnostics.candidateOnlySuggestions,
    createOnImport: preview.diagnostics.newPlayers,
    blockedAmbiguity: preview.diagnostics.blockedAmbiguity,
    scopedMatchRate: preview.diagnostics.scopedMatchRate,
    programScopedMatchRate: preview.diagnostics.programScopedMatchRate,
    emptyProvisionalRoster: preview.diagnostics.emptyProvisionalRoster,
    ambiguityBreakdown: preview.diagnostics.ambiguityBreakdown
  };
}

async function main() {
  console.log("Player matching precision policy validation\n");

  for (const tournament of TOURNAMENTS) {
    const after = await metricsForTournament(tournament);
    const before = PHASE_B2_BASELINE[tournament.key];
    console.log(`=== ${tournament.label} ===`);
    console.log(
      JSON.stringify(
        {
          baselinePhaseB2: {
            autoResolutionRate: before.autoResolutionRate,
            createOnImport: before.createOnImport,
            blockedAmbiguity: before.blockedAmbiguity
          },
          precisionPolicy: {
            previousAutoResolutionRate: after.previousAutoResolutionRate,
            newAutoResolutionRate: after.autoResolutionRate,
            autoResolutionReduction: after.previousAutoResolutionRate - after.autoResolutionRate,
            suppressedAutoMatches: after.suppressedAutoMatches,
            suppressedAutoMatchesByMethod: after.suppressedAutoMatchesByMethod,
            candidateOnlySuggestions: after.candidateOnlySuggestions,
            createOnImport: after.createOnImport,
            blockedAmbiguity: after.blockedAmbiguity,
            scopedMatchRate: after.scopedMatchRate,
            programScopedMatchRate: after.programScopedMatchRate,
            emptyProvisionalRoster: after.emptyProvisionalRoster,
            ambiguityBreakdown: after.ambiguityBreakdown
          },
          falsePositiveRisk: {
            summary:
              after.suppressedAutoMatches > 0
                ? `Blocked ${after.suppressedAutoMatches} unsafe auto-match(es) that would have resolved without review.`
                : "No unsafe auto-matches were promoted under the precision policy.",
            autoMatchDeltaVsPhaseB2: after.autoResolutionRate - before.autoResolutionRate
          }
        },
        null,
        2
      )
    );
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
