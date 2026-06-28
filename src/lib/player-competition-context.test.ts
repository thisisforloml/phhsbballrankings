import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCompetitionParticipationFromStats,
  formatPrimaryCompetitionLine,
  shortenCompetitionName
} from "@/lib/player-competition-context";

describe("player-competition-context", () => {
  it("shortens league names for compact display", () => {
    assert.equal(shortenCompetitionName("UAAP Season 88 HS Boys Basketball"), "UAAP S88 HS Boys");
  });

  it("picks primary competition by verified game count", () => {
    const summary = buildCompetitionParticipationFromStats([
      {
        game: {
          gameDate: new Date("2025-01-01"),
          season: { name: "Season 88", league: { id: "l1", name: "UAAP Season 88 HS Boys Basketball", tier: 1 } }
        }
      },
      {
        game: {
          gameDate: new Date("2025-02-01"),
          season: { name: "Season 88", league: { id: "l1", name: "UAAP Season 88 HS Boys Basketball", tier: 1 } }
        }
      },
      {
        game: {
          gameDate: new Date("2025-03-01"),
          season: { name: "Season 101", league: { id: "l2", name: "NCAA Season 101 Junior's Basketball", tier: 1 } }
        }
      }
    ]);

    assert.equal(summary.primary?.verifiedGameCount, 2);
    assert.equal(summary.competitionCount, 2);
    assert.equal(formatPrimaryCompetitionLine(summary.primary!), "UAAP S88 HS Boys · 2 games");
  });
});
