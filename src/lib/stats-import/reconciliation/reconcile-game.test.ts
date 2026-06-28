import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessFeedCompleteness } from "@/lib/stats-import/reconciliation/assess-feed";
import {
  reconcileInaccessibleFeedSubmissionGame,
  reconcileSubmissionGame,
  shouldApplyScoreReconciliation,
  shouldReconcileInaccessibleFeed
} from "@/lib/stats-import/reconciliation/reconcile-game";
import {
  fibaMatchToSubmissionGame,
  scheduleGameToSubmissionDraft
} from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";
import type { ExternalGameIndex, SubmissionGameDraft } from "@/lib/stats-import/types";

const MATCH_2779286_FEED = {
  period: 1,
  periodLength: 10,
  clock: "10:00",
  inOT: 0,
  tm: {
    "1": {
      code: "ACS",
      shortName: "Aces Solar",
      name: "Aces Solar Locked In 13u",
      score: 0,
      pl: {
        "1": { scoreboardName: "B. Talacay", shirtNumber: "0", starter: 0, active: 0 },
        "2": { scoreboardName: "J. Cruz", shirtNumber: "12", starter: 0, active: 0 }
      }
    },
    "2": {
      code: "SBU",
      shortName: "San Beda",
      name: "JPM-TEC San Beda 13u",
      score: 0,
      pl: {
        "1": { scoreboardName: "X. Latay", shirtNumber: "9", starter: 0, active: 0 }
      }
    }
  }
};

const SCHEDULE_2779286: ExternalGameIndex = {
  providerGameKey: "2779286",
  matchId: "2779286",
  gameNumber: "SH-47340-2779286",
  gameDate: "2025-11-15",
  homeTeamLabel: "Aces Solar Locked In 13u",
  awayTeamLabel: "JPM-TEC San Beda 13u",
  homeScore: 20,
  awayScore: 0,
  status: "final",
  statsAvailable: true,
  sourceUrl: "https://www.fibalivestats.com/webcast/PRS/2779286/",
  warnings: []
};

const SCHEDULE_2785685: ExternalGameIndex = {
  providerGameKey: "2785685",
  matchId: "2785685",
  gameNumber: "SH-47340-2785685",
  gameDate: "2025-11-22",
  homeTeamLabel: "TOPS Mordeno 13u",
  awayTeamLabel: "Smile 360 Bullies 14u",
  homeScore: 0,
  awayScore: 20,
  status: "final",
  statsAvailable: true,
  sourceUrl: "https://www.fibalivestats.com/webcast/PRS/2785685/",
  warnings: []
};

const NORMAL_COMPLETED_FEED = {
  period: 4,
  clock: "00:00",
  periodLength: 10,
  inOT: 0,
  matchTime: "2025-11-01",
  tm: {
    "1": {
      shortName: "Home",
      score: 78,
      pl: {
        "1": {
          firstName: "Player",
          familyName: "One",
          sPoints: 20,
          sMinutes: "24:00",
          sFieldGoalsAttempted: 10,
          sFieldGoalsMade: 8
        },
        "2": {
          firstName: "Player",
          familyName: "Two",
          sPoints: 58,
          sMinutes: "28:00",
          sFieldGoalsAttempted: 30,
          sFieldGoalsMade: 22
        }
      }
    },
    "2": {
      shortName: "Away",
      score: 75,
      pl: {
        "1": {
          firstName: "Player",
          familyName: "Three",
          sPoints: 75,
          sMinutes: "32:00",
          sFieldGoalsAttempted: 40,
          sFieldGoalsMade: 30
        }
      }
    }
  }
};

const SCHEDULE_NORMAL: ExternalGameIndex = {
  providerGameKey: "2743092",
  matchId: "2743092",
  gameNumber: "SH-47340-2743092",
  gameDate: "2025-11-01",
  homeTeamLabel: "Home",
  awayTeamLabel: "Away",
  homeScore: 78,
  awayScore: 75,
  status: "final",
  statsAvailable: true,
  sourceUrl: "https://www.fibalivestats.com/webcast/PRS/2743092/",
  warnings: []
};

const COMPLETE_CONFLICT_FEED = {
  period: 4,
  clock: "00:00",
  periodLength: 10,
  inOT: 0,
  tm: {
    "1": {
      shortName: "Home",
      score: 70,
      pl: {
        "1": {
          firstName: "Alpha",
          familyName: "One",
          sPoints: 40,
          sMinutes: "30:00",
          sFieldGoalsAttempted: 20,
          sFieldGoalsMade: 16
        },
        "2": {
          firstName: "Beta",
          familyName: "Two",
          sPoints: 30,
          sMinutes: "28:00",
          sFieldGoalsAttempted: 18,
          sFieldGoalsMade: 12
        }
      }
    },
    "2": {
      shortName: "Away",
      score: 65,
      pl: {
        "1": {
          firstName: "Gamma",
          familyName: "Three",
          sPoints: 65,
          sMinutes: "32:00",
          sFieldGoalsAttempted: 35,
          sFieldGoalsMade: 25
        }
      }
    }
  }
};

const SCHEDULE_CONFLICT: ExternalGameIndex = {
  ...SCHEDULE_NORMAL,
  matchId: "9990001",
  homeScore: 72,
  awayScore: 68
};

function baseDraft(overrides: Partial<SubmissionGameDraft> = {}): SubmissionGameDraft {
  return {
    gameNumber: "TEST-1",
    gameDate: "2025-11-01",
    game: "Home 0 - 0 Away",
    homeTeamName: "Home",
    awayTeamName: "Away",
    homeScore: 0,
    awayScore: 0,
    city: "Metro Manila",
    region: "NCR",
    sourceName: "test",
    players: [{ team: "Home", name: "Player", MIN: "00:00", PTS: 0 }],
    ...overrides
  };
}

describe("assessFeedCompleteness", () => {
  it("marks match 2779286 feed as empty", () => {
    const assessment = assessFeedCompleteness(MATCH_2779286_FEED);
    assert.equal(assessment.completeness, "empty");
    assert.equal(assessment.homeScore, 0);
    assert.equal(assessment.awayScore, 0);
    assert.ok(assessment.signals.includes("pregame_clock"));
    assert.ok(assessment.signals.includes("no_box_stat_fields"));
  });

  it("marks a normal completed feed as complete", () => {
    const assessment = assessFeedCompleteness(NORMAL_COMPLETED_FEED);
    assert.equal(assessment.completeness, "complete");
    assert.equal(assessment.homeScore, 78);
    assert.equal(assessment.awayScore, 75);
  });
});

describe("shouldApplyScoreReconciliation", () => {
  it("triggers for 2779286 pattern", () => {
    const assessment = assessFeedCompleteness(MATCH_2779286_FEED);
    assert.equal(
      shouldApplyScoreReconciliation({
        scheduleGame: SCHEDULE_2779286,
        feedCompleteness: assessment.completeness,
        feedHomeScore: assessment.homeScore,
        feedAwayScore: assessment.awayScore
      }),
      true
    );
  });

  it("does not trigger when scores already match", () => {
    const assessment = assessFeedCompleteness(NORMAL_COMPLETED_FEED);
    assert.equal(
      shouldApplyScoreReconciliation({
        scheduleGame: SCHEDULE_NORMAL,
        feedCompleteness: assessment.completeness,
        feedHomeScore: assessment.homeScore,
        feedAwayScore: assessment.awayScore
      }),
      false
    );
  });

  it("does not auto-reconcile complete-feed conflicts", () => {
    const assessment = assessFeedCompleteness(COMPLETE_CONFLICT_FEED);
    assert.equal(assessment.completeness, "complete");
    assert.equal(
      shouldApplyScoreReconciliation({
        scheduleGame: SCHEDULE_CONFLICT,
        feedCompleteness: assessment.completeness,
        feedHomeScore: assessment.homeScore,
        feedAwayScore: assessment.awayScore
      }),
      false
    );
  });
});

describe("shouldReconcileInaccessibleFeed", () => {
  it("triggers for final schedule games with HTTP 403 or 404", () => {
    assert.equal(
      shouldReconcileInaccessibleFeed({ scheduleGame: SCHEDULE_2785685, feedHttpStatus: 403 }),
      true
    );
    assert.equal(
      shouldReconcileInaccessibleFeed({ scheduleGame: SCHEDULE_2785685, feedHttpStatus: 404 }),
      true
    );
  });

  it("does not trigger without schedule authority", () => {
    assert.equal(
      shouldReconcileInaccessibleFeed({
        scheduleGame: { ...SCHEDULE_2785685, status: "scheduled", homeScore: null },
        feedHttpStatus: 403
      }),
      false
    );
  });

  it("does not trigger for other HTTP errors", () => {
    assert.equal(
      shouldReconcileInaccessibleFeed({ scheduleGame: SCHEDULE_2785685, feedHttpStatus: 500 }),
      false
    );
  });
});

describe("reconcileSubmissionGame", () => {
  it("reconciles 2779286 to schedule 20-0 team-result-only", () => {
    const rawDraft = fibaMatchToSubmissionGame("2779286", MATCH_2779286_FEED as never, {
      gameNumber: "SH-47340-2779286",
      city: "Metro Manila",
      region: "NCR",
      sourceUrl: "https://example.com"
    });
    assert.ok(rawDraft.players.length > 0);

    const result = reconcileSubmissionGame({
      matchId: "2779286",
      draft: rawDraft,
      fibaData: MATCH_2779286_FEED,
      scheduleGame: SCHEDULE_2779286
    });

    assert.equal(result.reconciliationApplied, true);
    assert.equal(result.draft.homeScore, 20);
    assert.equal(result.draft.awayScore, 0);
    assert.equal(result.draft.players.length, 0);
    assert.equal(result.draft.teamResultOnly, true);
    assert.equal(result.draft.defaultWin, true);
    assert.match(result.draft.note ?? "", /Schedule reports final result \(20–0\)/);
    assert.equal(result.draft._reconciliation?.reason, "schedule_authority_over_empty_feed");
    assert.deepEqual(result.draft._reconciliation?.scheduleScore, { home: 20, away: 0 });
    assert.deepEqual(result.draft._reconciliation?.feedScore, { home: 0, away: 0 });
    assert.equal(result.draft.gameDate, "2025-11-15");
  });

  it("preserves normal completed games unchanged", () => {
    const rawDraft = fibaMatchToSubmissionGame("2743092", NORMAL_COMPLETED_FEED as never, {
      gameNumber: "SH-47340-2743092",
      city: "Metro Manila",
      region: "NCR",
      sourceUrl: "https://example.com"
    });

    const result = reconcileSubmissionGame({
      matchId: "2743092",
      draft: rawDraft,
      fibaData: NORMAL_COMPLETED_FEED,
      scheduleGame: SCHEDULE_NORMAL
    });

    assert.equal(result.reconciliationApplied, false);
    assert.equal(result.draft.homeScore, 78);
    assert.equal(result.draft.awayScore, 75);
    assert.ok(result.draft.players.length > 0);
    assert.equal(result.draft.teamResultOnly, undefined);
    assert.equal(result.draft._reconciliation, undefined);
  });

  it("does not auto-reconcile complete-feed score conflicts", () => {
    const rawDraft = baseDraft({ homeScore: 70, awayScore: 65, players: [{ team: "Home", name: "Alpha One", MIN: "30:00", PTS: 40 }] });

    const result = reconcileSubmissionGame({
      matchId: "9990001",
      draft: rawDraft,
      fibaData: COMPLETE_CONFLICT_FEED,
      scheduleGame: SCHEDULE_CONFLICT
    });

    assert.equal(result.reconciliationApplied, false);
    assert.equal(result.draft.homeScore, 70);
    assert.equal(result.draft.awayScore, 65);
    assert.equal(result.draft._reconciliation, undefined);
  });

  it("reconciles 2785685 inaccessible feed to schedule 0-20 team-result-only", () => {
    const baseDraft = scheduleGameToSubmissionDraft("2785685", SCHEDULE_2785685, {
      gameNumber: "SH-47340-2785685",
      city: "Metro Manila",
      region: "NCR",
      sourceUrl: "https://example.com"
    });

    const result = reconcileInaccessibleFeedSubmissionGame({
      matchId: "2785685",
      draft: baseDraft,
      scheduleGame: SCHEDULE_2785685,
      feedHttpStatus: 403
    });

    assert.equal(result.reconciliationApplied, true);
    assert.equal(result.draft.homeScore, 0);
    assert.equal(result.draft.awayScore, 20);
    assert.equal(result.draft.players.length, 0);
    assert.equal(result.draft.teamResultOnly, true);
    assert.equal(result.draft.defaultWin, true);
    assert.match(result.draft.note ?? "", /inaccessible \(HTTP 403\)/);
    assert.equal(result.draft._reconciliation?.reason, "schedule_authority_over_inaccessible_feed");
    assert.equal(result.draft._reconciliation?.feedHttpStatus, 403);
    assert.deepEqual(result.draft._reconciliation?.scheduleScore, { home: 0, away: 20 });
  });
});
