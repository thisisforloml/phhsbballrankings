import { parseScheduleHtml } from "@/lib/stats-import/adapters/statshub-v1/parse-schedule";
import { fetchGeniusEmbedSchedule } from "@/lib/stats-import/adapters/statshub-v1/resolve-competition";
import type { SubmissionGameDraft } from "@/lib/stats-import/types";
import type { ExternalGameIndex } from "@/lib/stats-import/types";

const STATS_HUB_GAME_NUMBER_PATTERN = /^SH-(\d+)-(\d+)$/;

export function parseStatsHubGameNumber(gameNumber: string | null | undefined) {
  if (!gameNumber) return null;
  const match = gameNumber.match(STATS_HUB_GAME_NUMBER_PATTERN);
  if (!match) return null;
  return { competitionId: match[1], matchId: match[2] };
}

function schedulePathsForCompetition(competitionId: string) {
  return [
    `/competition/${competitionId}/schedule`,
    `/competition/${competitionId}/schedule?phaseName=Eliminations`,
    `/competition/${competitionId}/schedule?phaseName=Playoffs`
  ];
}

export async function fetchCompetitionScheduleDates(competitionId: string) {
  const datesByMatchId = new Map<string, string>();
  const pathsLoaded: string[] = [];

  for (const path of schedulePathsForCompetition(competitionId)) {
    try {
      const { html } = await fetchGeniusEmbedSchedule(path);
      const games = parseScheduleHtml(html, competitionId, path);
      pathsLoaded.push(path);
      for (const game of games) {
        if (game.matchId && game.gameDate) {
          datesByMatchId.set(game.matchId, game.gameDate);
        }
      }
    } catch {
      // Some competitions omit eliminations or playoffs; continue with other paths.
    }
  }

  return { datesByMatchId, pathsLoaded };
}

export function applyPreferredGameDate(
  draft: SubmissionGameDraft,
  matchId: string,
  options?: {
    scheduleGame?: ExternalGameIndex;
    gameDateByMatchId?: Record<string, string>;
  }
): SubmissionGameDraft {
  let gameDate = draft.gameDate;

  if (options?.scheduleGame?.gameDate) {
    gameDate = options.scheduleGame.gameDate;
  }

  const override = options?.gameDateByMatchId?.[matchId]?.trim();
  if (override) {
    gameDate = override;
  }

  return gameDate === draft.gameDate ? draft : { ...draft, gameDate };
}
