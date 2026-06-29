/**
 * Review candidate filter validation for PYBC, Filoil, and JCIM.
 * Usage: npx tsx scripts/validate-review-candidate-filter.ts
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

const BEFORE_BASELINE: Record<
  string,
  { needsReview: number; reviewCandidateSlots: number }
> = {
  pybc: { needsReview: 24, reviewCandidateSlots: 47 },
  filoil: { needsReview: 9, reviewCandidateSlots: 28 },
  jcim: { needsReview: 55, reviewCandidateSlots: 96 }
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

  return { teamRows, teamMappings, gender };
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

  const reviewRows = preview.players.filter((player) => player.confidenceBand === "Review Needed");
  const reviewCandidateSlots = reviewRows.reduce((total, player) => total + player.candidates.length, 0);
  const suppressedExamples = preview.players
    .flatMap((player) =>
      (player.suppressedWeakCandidateExamples ?? []).map((example) => ({
        importedName: player.importedName,
        teamLabel: player.teamLabel,
        hiddenCandidate: example.displayName,
        method: example.method,
        suppressReason: example.suppressReason,
        score: example.score
      }))
    )
    .slice(0, 8);

  return {
    tournament: entry.label,
    needsReview: preview.diagnostics.needsReview,
    unmatched: preview.diagnostics.newPlayers,
    reviewCandidateSlots,
    suppressedWeakCandidates: preview.diagnostics.suppressedWeakCandidates,
    reviewCandidatesShown: preview.diagnostics.reviewCandidatesShown,
    reviewCandidatesHidden: preview.diagnostics.reviewCandidatesHidden,
    suppressedExamples
  };
}

async function main() {
  console.log("Review candidate filter validation\n");

  for (const tournament of TOURNAMENTS) {
    const after = await metricsForTournament(tournament);
    const before = BEFORE_BASELINE[tournament.key];
    console.log(`=== ${tournament.label} ===`);
    console.log(
      JSON.stringify(
        {
          before: {
            needsReview: before.needsReview,
            reviewCandidateSlots: before.reviewCandidateSlots
          },
          after: {
            needsReview: after.needsReview,
            reviewCandidateSlots: after.reviewCandidateSlots,
            unmatched: after.unmatched,
            suppressedWeakCandidates: after.suppressedWeakCandidates,
            reviewCandidatesShown: after.reviewCandidatesShown,
            reviewCandidatesHidden: after.reviewCandidatesHidden
          },
          delta: {
            needsReview: after.needsReview - before.needsReview,
            reviewCandidateSlots: after.reviewCandidateSlots - before.reviewCandidateSlots
          },
          suppressedExamples: after.suppressedExamples
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
