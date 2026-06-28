import { assessFeedCompleteness } from "@/lib/stats-import/reconciliation/assess-feed";
import type {
  FeedCompleteness,
  ReconcileSubmissionGameInput,
  ReconcileSubmissionGameResult,
  ScoreReconciliationMetadata
} from "@/lib/stats-import/reconciliation/types";
import type { ExternalGameIndex } from "@/lib/stats-import/types";

export function isInaccessibleFeedStatus(status: number) {
  return status === 403 || status === 404;
}

export function hasScheduleAuthority(scheduleGame: ExternalGameIndex | null | undefined) {
  return (
    scheduleGame?.status === "final" &&
    scheduleGame.homeScore !== null &&
    scheduleGame.awayScore !== null
  );
}

function scoresMismatch(
  scheduleHome: number,
  scheduleAway: number,
  feedHome: number,
  feedAway: number
) {
  return scheduleHome !== feedHome || scheduleAway !== feedAway;
}

export function shouldApplyScoreReconciliation(params: {
  scheduleGame: ExternalGameIndex | null | undefined;
  feedCompleteness: FeedCompleteness;
  feedHomeScore: number;
  feedAwayScore: number;
}) {
  if (!hasScheduleAuthority(params.scheduleGame)) return false;
  if (params.feedCompleteness !== "empty") return false;

  const scheduleHome = params.scheduleGame!.homeScore!;
  const scheduleAway = params.scheduleGame!.awayScore!;
  return scoresMismatch(scheduleHome, scheduleAway, params.feedHomeScore, params.feedAwayScore);
}

export function shouldReconcileInaccessibleFeed(params: {
  scheduleGame: ExternalGameIndex | null | undefined;
  feedHttpStatus: number;
}) {
  if (!isInaccessibleFeedStatus(params.feedHttpStatus)) return false;
  return hasScheduleAuthority(params.scheduleGame);
}

function buildEmptyFeedReconciliationNote(homeScore: number, awayScore: number) {
  return `Schedule reports final result (${homeScore}–${awayScore}). FIBA livestats feed is incomplete (no box-score stats). Scores taken from competition schedule; no player stats imported.`;
}

function buildInaccessibleFeedReconciliationNote(homeScore: number, awayScore: number, feedHttpStatus: number) {
  return `Schedule reports final result (${homeScore}–${awayScore}). FIBA livestats feed is inaccessible (HTTP ${feedHttpStatus}). Scores taken from competition schedule; no player stats imported.`;
}

function isDefaultWinPattern(homeScore: number, awayScore: number) {
  const winner = Math.max(homeScore, awayScore);
  const loser = Math.min(homeScore, awayScore);
  return winner > 0 && loser === 0;
}

function applyScheduleAuthorityDraft(input: {
  matchId: string;
  draft: ReconcileSubmissionGameInput["draft"];
  scheduleGame: ExternalGameIndex;
  metadata: ScoreReconciliationMetadata;
  note: string;
}): ReconcileSubmissionGameResult {
  const scheduleHome = input.scheduleGame.homeScore!;
  const scheduleAway = input.scheduleGame.awayScore!;
  const defaultWin = isDefaultWinPattern(scheduleHome, scheduleAway);

  const draft = {
    ...input.draft,
    homeScore: scheduleHome,
    awayScore: scheduleAway,
    game: `${input.draft.homeTeamName} ${scheduleHome} - ${scheduleAway} ${input.draft.awayTeamName}`,
    players: [],
    teamResultOnly: true,
    defaultWin,
    note: input.note,
    gameDate: input.scheduleGame.gameDate ?? input.draft.gameDate,
    _reconciliation: input.metadata
  };

  return { draft, reconciliationApplied: true };
}

export function reconcileInaccessibleFeedSubmissionGame(input: {
  matchId: string;
  draft: ReconcileSubmissionGameInput["draft"];
  scheduleGame: ExternalGameIndex;
  feedHttpStatus: number;
}): ReconcileSubmissionGameResult {
  if (!shouldReconcileInaccessibleFeed({ scheduleGame: input.scheduleGame, feedHttpStatus: input.feedHttpStatus })) {
    throw new Error(
      `Match ${input.matchId} cannot be reconciled from schedule (feed HTTP ${input.feedHttpStatus}).`
    );
  }

  const scheduleHome = input.scheduleGame.homeScore!;
  const scheduleAway = input.scheduleGame.awayScore!;
  const reconciledAt = new Date().toISOString();

  return applyScheduleAuthorityDraft({
    matchId: input.matchId,
    draft: input.draft,
    scheduleGame: input.scheduleGame,
    note: buildInaccessibleFeedReconciliationNote(scheduleHome, scheduleAway, input.feedHttpStatus),
    metadata: {
      applied: true,
      reason: "schedule_authority_over_inaccessible_feed",
      matchId: input.matchId,
      scheduleScore: { home: scheduleHome, away: scheduleAway },
      feedHttpStatus: input.feedHttpStatus,
      reconciledAt
    }
  });
}

export function reconcileSubmissionGame(input: ReconcileSubmissionGameInput): ReconcileSubmissionGameResult {
  const assessment = assessFeedCompleteness(input.fibaData);
  const scheduleGame = input.scheduleGame;

  if (
    !shouldApplyScoreReconciliation({
      scheduleGame,
      feedCompleteness: assessment.completeness,
      feedHomeScore: assessment.homeScore,
      feedAwayScore: assessment.awayScore
    })
  ) {
    return { draft: input.draft, reconciliationApplied: false };
  }

  const scheduleHome = scheduleGame!.homeScore!;
  const scheduleAway = scheduleGame!.awayScore!;
  const reconciledAt = new Date().toISOString();

  return applyScheduleAuthorityDraft({
    matchId: input.matchId,
    draft: input.draft,
    scheduleGame: scheduleGame!,
    note: buildEmptyFeedReconciliationNote(scheduleHome, scheduleAway),
    metadata: {
      applied: true,
      reason: "schedule_authority_over_empty_feed",
      matchId: input.matchId,
      scheduleScore: { home: scheduleHome, away: scheduleAway },
      feedScore: { home: assessment.homeScore, away: assessment.awayScore },
      feedCompleteness: assessment.completeness,
      reconciledAt
    }
  });
}
