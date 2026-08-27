import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeSubmissionJsonShape } from "./submission-json-normalization";

const nestedGame = {
  competition: { name: "UAAP Season 89 16u Basketball", season: 89, division: "16u", sport: "Basketball" },
  game: {
    game_number: 1,
    date: "2026-08-15",
    venue: "FEU Diliman",
    home_team: "UE",
    away_team: "UP",
    final_score: { UE: 18, UP: 8 },
  },
  teams: [
    {
      team_name: "UE Jrs",
      team_code: "UE",
      players: [{
        number: 77,
        name: "Xerone Dizon",
        minutes: "20:28",
        points: 18,
        fg: { made: 8, attempted: 17 },
        two_pt: { made: 8, attempted: 17 },
        three_pt: { made: 0, attempted: 0 },
        ft: { made: 2, attempted: 4 },
        rebounds: { offensive: 3, defensive: 3, total: 6 },
        assists: 0,
        steals: 3,
        blocks: 0,
        turnovers: 1,
        fouls: { personal: 2, drawn: 4 },
        plus_minus: 9,
      }],
    },
    {
      team_name: "UPIS Jrs",
      team_code: "UP",
      players: [{
        name: "Kean Poquiz",
        minutes: "34:28",
        points: 8,
        fg: { made: 2, attempted: 5 },
        two_pt: { made: 1, attempted: 3 },
        three_pt: { made: 1, attempted: 2 },
        ft: { made: 3, attempted: 4 },
        rebounds: { offensive: 1, defensive: 2, total: 3 },
        assists: 2,
        steals: 1,
        blocks: 0,
        turnovers: 2,
        fouls: { personal: 1, drawn: 2 },
        plus_minus: -9,
      }],
    },
  ],
};

describe("submission JSON shape normalization", () => {
  it("converts a nested box score into the canonical submission package", () => {
    const result = normalizeSubmissionJsonShape(nestedGame) as Record<string, any>;
    assert.equal(result.league.ageGroup, "U16");
    assert.equal(result.season.name, "Season 89");
    assert.equal(result.season.seasonYear, 2026);
    assert.equal(result.gender, "BOYS");
    assert.equal(result.games[0].homeTeamName, "UE Jrs");
    assert.equal(result.games[0].awayTeamName, "UPIS Jrs");
    assert.equal(result.games[0].city, "Quezon City");
    assert.equal(result.games[0].players[0].PTS, 18);
    assert.equal(result.games[0].players[0]["+/-"], 9);
  });

  it("combines an array of nested games into one importable package", () => {
    const second = structuredClone(nestedGame);
    second.game.game_number = 2;
    const result = normalizeSubmissionJsonShape([nestedGame, second]) as Record<string, any>;
    assert.equal(result.games.length, 2);
    assert.deepEqual(result.games.map((game: Record<string, unknown>) => game.gameNumber), ["1", "2"]);
  });

  it("leaves the existing canonical package unchanged", () => {
    const canonical = { league: { name: "Test" }, season: { name: "Season 1" }, games: [] };
    assert.equal(normalizeSubmissionJsonShape(canonical), canonical);
  });

  it("accepts camelCase team stats and nested match metadata", () => {
    const input = {
      league: nestedGame.competition,
      match: { gameNo: "1", gameDate: "2026-08-15", venueName: "FEU Diliman", homeTeam: "UE", awayTeam: "UP", homeScore: "18", awayScore: "8" },
      teamStats: nestedGame.teams.map((team) => ({ teamName: team.team_name, code: team.team_code, playerStats: team.players })),
    };
    const result = normalizeSubmissionJsonShape(input) as Record<string, any>;
    assert.equal(result.games[0].homeScore, 18);
    assert.equal(result.games[0].players.length, 2);
    assert.equal(result.games[0].players[0].FGM, 8);
  });

  it("accepts a matches envelope and flat player stat aliases", () => {
    const input = {
      tournament: { name: "Test U19 Boys", ageGroup: "U19" },
      season: { name: "Season 2", year: 2026 },
      gender: "BOYS",
      matches: [{
        matchId: "game-1", date: "2026-08-15", city: "Quezon City", region: "NCR",
        homeTeam: { name: "Home", score: 2 }, awayTeam: { name: "Away", score: 0 },
        playerStats: [{ playerName: "Player One", teamName: "Home", minutes: "10:00", points: "2", fieldGoalsMade: "1", fieldGoalsAttempted: "2", plusMinus: -3 }],
      }],
    };
    const result = normalizeSubmissionJsonShape(input) as Record<string, any>;
    assert.equal(result.games[0].awayScore, 0);
    assert.equal(result.games[0].players[0].FGM, 1);
    assert.equal(result.games[0].players[0]["+/-"], -3);
    assert.equal(result.games[0].players[0].FTA, undefined);
  });

  it("does not combine mixed competitions or explicit genders", () => {
    const second = structuredClone(nestedGame);
    second.competition.season = 90;
    const mixed = [nestedGame, second];
    assert.equal(normalizeSubmissionJsonShape(mixed), mixed);
    const mixedGender = [{ ...nestedGame, gender: "BOYS" }, { ...nestedGame, gender: "GIRLS" }];
    assert.equal(normalizeSubmissionJsonShape(mixedGender), mixedGender);
  });

  it("does not swap home and away identities based on team order", () => {
    const input = structuredClone(nestedGame);
    input.teams.reverse();
    const result = normalizeSubmissionJsonShape(input) as Record<string, any>;
    assert.equal(result.games[0].homeTeamName, "UE Jrs");
    assert.equal(result.games[0].awayTeamName, "UPIS Jrs");
  });
});
