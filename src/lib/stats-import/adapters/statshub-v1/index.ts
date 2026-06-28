import type { ExternalGameIndex, UrlImportDiscovery } from "@/lib/stats-import/types";
import { classifyStatsImportUrl } from "@/lib/stats-import/adapters/statshub-v1/classify-url";
import {
  enrichSingleGamePreview,
  fetchFibaMatchDataResult,
  fibaMatchToSubmissionGame,
  scheduleGameToSubmissionDraft
} from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import {
  isInaccessibleFeedStatus,
  reconcileInaccessibleFeedSubmissionGame,
  reconcileSubmissionGame,
  shouldReconcileInaccessibleFeed
} from "@/lib/stats-import/reconciliation";
import { inferAgeGroupFromText, inferGender, inferSeasonYear, normalizeLeagueName } from "@/lib/stats-import/adapters/statshub-v1/infer-metadata";
import { parseScheduleHtml, singleGameIndex, buildScheduleDiagnostics } from "@/lib/stats-import/adapters/statshub-v1/parse-schedule";
import { fetchGeniusEmbedSchedule, resolveStatsHubCompetition } from "@/lib/stats-import/adapters/statshub-v1/resolve-competition";
import { buildSubmissionPackageDraft, packageDraftToRawText } from "@/lib/stats-import/adapters/statshub-v1/normalize-package";
import { applyPreferredGameDate } from "@/lib/stats-import/adapters/statshub-v1/schedule-dates";
import { buildSubmissionReview } from "@/lib/submission-review";

const MAX_IMPORT_GAMES = 40;

export async function discoverStatsHubImport(sourceUrl: string): Promise<UrlImportDiscovery> {
  const classified = classifyStatsImportUrl(sourceUrl);
  const messages: string[] = [];

  if (classified.pageType === "game" && classified.matchId) {
    const preview = await enrichSingleGamePreview(classified.matchId, classified.canonicalUrl);
    const title = preview.competitionTitle ?? `Match ${classified.matchId}`;
    const game = singleGameIndex(classified.matchId, classified.canonicalUrl);
    game.homeTeamLabel = preview.homeTeamLabel;
    game.awayTeamLabel = preview.awayTeamLabel;
    game.homeScore = preview.homeScore;
    game.awayScore = preview.awayScore;
    game.gameDate = preview.gameDate;
    game.status = preview.statsAvailable ? "final" : "unknown";
    game.statsAvailable = preview.statsAvailable;

    return {
      provider: "statshub-v1",
      sourceUrl,
      canonicalUrl: classified.canonicalUrl,
      pageType: "game",
      competitionId: classified.competitionId,
      competitionTitle: title,
      inferredAgeGroup: inferAgeGroupFromText(title),
      inferredGender: inferGender(title),
      inferredSeasonYear: inferSeasonYear(title),
      games: [game],
      messages
    };
  }

  if (!classified.statsHubOrigin || !classified.statsHubSlug) {
    throw new Error("Competition discovery requires a StatsHub tournament page URL.");
  }

  const resolved = await resolveStatsHubCompetition(sourceUrl, classified.statsHubOrigin, classified.statsHubSlug);
  const geniusPagePath = classified.geniusPagePath ?? resolved.defaultGeniusPagePath;
  const competitionId = classified.competitionId ?? resolved.competitionId;

  const scheduleFetch = await fetchGeniusEmbedSchedule(geniusPagePath);
  const games = parseScheduleHtml(scheduleFetch.html, competitionId, sourceUrl);
  const diagnostics = buildScheduleDiagnostics(scheduleFetch.html, scheduleFetch.scheduleUrl, scheduleFetch.responseBytes, games);

  if (!games.length) {
    throw new Error("No games were found in the competition schedule.");
  }

  const title = normalizeLeagueName(resolved.competitionTitle);
  if (classified.geniusPagePath && classified.geniusPagePath !== resolved.defaultGeniusPagePath) {
    messages.push(`Using WHurl schedule path: ${geniusPagePath}`);
  }
  messages.push(`Discovered ${games.length} games from competition ${competitionId}.`);
  messages.push(
    `Schedule diagnostics: ${diagnostics.rawExtfixUniqueCount} raw extfix ids, ${diagnostics.parsedMatchCount} parsed, ${diagnostics.discarded.length} discarded.`
  );

  return {
    provider: "statshub-v1",
    sourceUrl,
    canonicalUrl: classified.canonicalUrl,
    pageType: "competition",
    competitionId,
    competitionTitle: title,
    inferredAgeGroup: inferAgeGroupFromText(title),
    inferredGender: inferGender(title),
    inferredSeasonYear: inferSeasonYear(title),
    games,
    messages,
    diagnostics
  };
}

async function loadScheduleByMatchId(
  sourceUrl: string,
  scheduleByMatchId?: Map<string, ExternalGameIndex>
) {
  if (scheduleByMatchId) return scheduleByMatchId;

  try {
    const discovery = await discoverStatsHubImport(sourceUrl);
    return new Map(discovery.games.map((game) => [game.matchId, game]));
  } catch {
    return new Map<string, ExternalGameIndex>();
  }
}

export async function buildStatsHubSubmissionPackage(options: {
  sourceUrl: string;
  competitionId: string | null;
  leagueName: string;
  ageGroup: string;
  gender: "BOYS" | "GIRLS";
  seasonName?: string;
  seasonYear?: number;
  city?: string;
  region?: string;
  games: Array<{ matchId: string; gameNumber: string; sourceUrl: string }>;
  scheduleByMatchId?: Map<string, ExternalGameIndex>;
  gameDateByMatchId?: Record<string, string>;
}) {
  if (!options.games.length) throw new Error("Select at least one game to import.");
  if (options.games.length > MAX_IMPORT_GAMES) {
    throw new Error(`Import up to ${MAX_IMPORT_GAMES} games at a time.`);
  }

  const city = options.city?.trim() || "Metro Manila";
  const region = options.region?.trim() || "NCR";
  const scheduleByMatchId = await loadScheduleByMatchId(options.sourceUrl, options.scheduleByMatchId);
  const submissionGames = [];
  let reconciliationCount = 0;
  const reconciledMatchIds: string[] = [];
  const inaccessibleFeedMatchIds: string[] = [];

  for (const selected of options.games) {
    const scheduleGame = scheduleByMatchId.get(selected.matchId);
    const feedResult = await fetchFibaMatchDataResult(selected.matchId);

    if (!feedResult.ok && isInaccessibleFeedStatus(feedResult.status)) {
      if (!shouldReconcileInaccessibleFeed({ scheduleGame, feedHttpStatus: feedResult.status })) {
        throw new Error(
          `Match ${selected.matchId}: data.json returned HTTP ${feedResult.status} and schedule lacks authoritative final scores.`
        );
      }

      const baseDraft = scheduleGameToSubmissionDraft(selected.matchId, scheduleGame!, {
        gameNumber: selected.gameNumber,
        city,
        region,
        sourceUrl: selected.sourceUrl
      });
      const reconciled = reconcileInaccessibleFeedSubmissionGame({
        matchId: selected.matchId,
        draft: baseDraft,
        scheduleGame: scheduleGame!,
        feedHttpStatus: feedResult.status
      });
      reconciliationCount += 1;
      reconciledMatchIds.push(selected.matchId);
      inaccessibleFeedMatchIds.push(selected.matchId);
      submissionGames.push(
        applyPreferredGameDate(reconciled.draft, selected.matchId, {
          scheduleGame,
          gameDateByMatchId: options.gameDateByMatchId
        })
      );
      continue;
    }

    if (!feedResult.ok) {
      throw new Error(
        `Request failed (${feedResult.status}) for https://fibalivestats.dcd.shared.geniussports.com/data/${selected.matchId}/data.json`
      );
    }

    const data = feedResult.data;
    const rawDraft = fibaMatchToSubmissionGame(selected.matchId, data, {
      gameNumber: selected.gameNumber,
      city,
      region,
      sourceUrl: selected.sourceUrl
    });
    const reconciled = reconcileSubmissionGame({
      matchId: selected.matchId,
      draft: rawDraft,
      fibaData: data as Record<string, unknown>,
      scheduleGame
    });
    if (reconciled.reconciliationApplied) {
      reconciliationCount += 1;
      reconciledMatchIds.push(selected.matchId);
    }
    submissionGames.push(
      applyPreferredGameDate(reconciled.draft, selected.matchId, {
        scheduleGame,
        gameDateByMatchId: options.gameDateByMatchId
      })
    );
  }

  const packageDraft = buildSubmissionPackageDraft({
    leagueName: options.leagueName,
    ageGroup: options.ageGroup,
    gender: options.gender,
    seasonName: options.seasonName,
    seasonYear: options.seasonYear,
    city,
    region,
    sourceUrl: options.sourceUrl,
    competitionId: options.competitionId,
    games: submissionGames
  });

  const rawText = packageDraftToRawText(packageDraft);
  if (Buffer.byteLength(rawText, "utf8") > 5 * 1024 * 1024) {
    throw new Error("Draft JSON exceeds 5 MB. Import fewer games per submission.");
  }

  const review = buildSubmissionReview({
    rawText,
    parsedPreview: null,
    title: options.leagueName,
    leagueName: options.leagueName
  });

  return {
    packageDraft,
    rawText,
    review,
    gameCount: submissionGames.length,
    reconciliationCount,
    reconciliationSummary: {
      reconciledMatchIds,
      inaccessibleFeedMatchIds
    }
  };
}

export { MAX_IMPORT_GAMES };
