import type { ExternalGameIndex, ScoreReconciliationMetadata, SubmissionGameDraft } from "@/lib/stats-import/types";

export type FeedCompleteness = "empty" | "partial" | "complete";

export type { ScoreReconciliationMetadata };

export type FeedAssessment = {
  completeness: FeedCompleteness;
  homeScore: number;
  awayScore: number;
  sumHomePts: number;
  sumAwayPts: number;
  playersWithBoxFields: number;
  totalPlayers: number;
  signals: string[];
};

export type ReconcileSubmissionGameInput = {
  matchId: string;
  draft: SubmissionGameDraft;
  fibaData: Record<string, unknown>;
  scheduleGame: ExternalGameIndex | null | undefined;
};

export type ReconcileSubmissionGameResult = {
  draft: SubmissionGameDraft;
  reconciliationApplied: boolean;
};
