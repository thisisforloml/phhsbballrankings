import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseImportedMinutes } from "@/lib/game-stat-import-integrity";
import {
  canonicalPlayerName,
  fibaMatchToSubmissionGame,
  formatMinutes,
  normalizeColonClockString
} from "@/lib/stats-import/adapters/statshub-v1/fetch-match-data";

describe("normalizeColonClockString", () => {
  it("carries seconds overflow into minutes", () => {
    assert.equal(normalizeColonClockString("10:60"), "11:00");
    assert.equal(normalizeColonClockString("15:60"), "16:00");
    assert.equal(normalizeColonClockString("59:60"), "60:00");
    assert.equal(normalizeColonClockString("199:60"), "200:00");
  });

  it("preserves valid clocks unchanged", () => {
    assert.equal(normalizeColonClockString("10:59"), "10:59");
    assert.equal(normalizeColonClockString("00:45"), "00:45");
    assert.equal(normalizeColonClockString("11:00"), "11:00");
  });

  it("returns null for malformed clocks", () => {
    assert.equal(normalizeColonClockString("abc"), null);
    assert.equal(normalizeColonClockString("10"), null);
    assert.equal(normalizeColonClockString("10:6"), null);
    assert.equal(normalizeColonClockString(""), null);
  });
});

describe("formatMinutes", () => {
  it("normalizes colon strings with second overflow", () => {
    assert.equal(formatMinutes("10:60"), "11:00");
    assert.equal(formatMinutes("15:60"), "16:00");
    assert.equal(formatMinutes("199:60"), "200:00");
  });

  it("preserves valid colon strings", () => {
    assert.equal(formatMinutes("10:59"), "10:59");
    assert.equal(formatMinutes("00:45"), "00:45");
    assert.equal(formatMinutes("11:00"), "11:00");
  });

  it("falls back to 00:00 for malformed colon strings", () => {
    assert.equal(formatMinutes("abc"), "00:00");
    assert.equal(formatMinutes("10:6"), "00:00");
    assert.equal(formatMinutes("not-a-clock"), "00:00");
  });

  it("formats numeric values as total seconds", () => {
    assert.equal(formatMinutes(660), "11:00");
    assert.equal(formatMinutes(45), "00:45");
  });
});

describe("Roberto Sancho Sison match 2776848 minutes", () => {
  it("imports MIN as 11:00 and passes validation", () => {
    const game = fibaMatchToSubmissionGame(
      "2776848",
      {
        tm: {
          "1": {
            shortName: "San Beda",
            score: 71,
            pl: {
              "1": {
                firstName: "Roberto Sancho",
                familyName: "Sison",
                sMinutes: "10:60",
                sPoints: 2
              }
            }
          },
          "2": {
            shortName: "GTG",
            score: 59,
            pl: {
              "1": {
                firstName: "Other",
                familyName: "Player",
                sMinutes: "8:00",
                sPoints: 0
              }
            }
          }
        }
      },
      {
        city: "Metro Manila",
        region: "NCR",
        sourceUrl: "https://example.com"
      }
    );

    const roberto = game.players.find((player) => player.name === canonicalPlayerName({
      firstName: "Roberto Sancho",
      familyName: "Sison"
    }));
    assert.ok(roberto);
    assert.equal(roberto.MIN, "11:00");
    assert.equal(parseImportedMinutes(roberto.MIN, "Roberto Sancho Sison"), 11);
  });
});
