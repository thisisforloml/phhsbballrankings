import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSubmissionReview } from "./submission-review";

describe("nested JSON submission review", () => {
  it("preserves the submitted UAAP season while normalizing the competition label", () => {
    const rawText = JSON.stringify({
      competition: { name: "UAAP Season 89 16u Basketball", season: 89, division: "16u" },
      game: {
        game_number: 1,
        date: "2026-08-15",
        venue: "FEU Diliman",
        home_team: "UE",
        away_team: "UP",
        final_score: { UE: 2, UP: 3 },
      },
      teams: [
        {
          team_name: "UE Jrs",
          team_code: "UE",
          players: [{ name: "Home Player", minutes: "10:00", points: 2, fg: { made: 1, attempted: 1 }, two_pt: { made: 1, attempted: 1 }, three_pt: { made: 0, attempted: 0 }, ft: { made: 0, attempted: 0 }, rebounds: { offensive: 0, defensive: 1, total: 1 }, fouls: { personal: 0, drawn: 0 } }],
        },
        {
          team_name: "UPIS Jrs",
          team_code: "UP",
          players: [{ name: "Away Player", minutes: "10:00", points: 3, fg: { made: 1, attempted: 1 }, two_pt: { made: 0, attempted: 0 }, three_pt: { made: 1, attempted: 1 }, ft: { made: 0, attempted: 0 }, rebounds: { offensive: 0, defensive: 1, total: 1 }, fouls: { personal: 0, drawn: 0 } }],
        },
      ],
    });

    const review = buildSubmissionReview({ rawText, parsedPreview: null, title: "Season 89", leagueName: null } as never);
    assert.equal(review.validJson, true);
    assert.equal(review.importReady, false);
    assert.ok(review.validation.missingRequiredFields.some((issue) => issue.missingFields.includes("AST")));
    assert.equal(review.summary.gameCount, 1);
    assert.equal(review.recommendations.recommendedLeagueName, "UAAP Season 89 16U Boys Basketball");
  });
});
