import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCompetitionStrengthProfile, competitionTierFromStrength, governanceCompetitionPrior, translateScoreByCompetition } from "./competition-strength-v1";

function input(overrides: Partial<Parameters<typeof buildCompetitionStrengthProfile>[0]> = {}) {
  return {
    poolKey: "season-1|U19|BOYS",
    leagueId: "league-1",
    seasonId: "season-1",
    label: "Competition",
    tier: 1,
    qualityScore: 0,
    gameCount: 40,
    teamCount: 8,
    playerCount: 100,
    crossoverPlayerCount: 12,
    independentPlayerRatings: [45, 50, 55, 60, 70, 80],
    teamPerformanceRatings: [45, 50, 55, 60, 65, 70],
    crossoverDeltas: [5, 4, 6],
    ...overrides
  };
}

test("tier governance is monotonic with tier 1 strongest", () => {
  assert.equal(governanceCompetitionPrior(1, 0) > governanceCompetitionPrior(2, 0), true);
  assert.equal(governanceCompetitionPrior(2, 0) > governanceCompetitionPrior(3, 0), true);
  assert.equal(governanceCompetitionPrior(3, 0) > governanceCompetitionPrior(4, 0), true);
});

test("weak competition cannot increase an identical independent score", () => {
  const strong = buildCompetitionStrengthProfile(input({ tier: 1 }));
  const weak = buildCompetitionStrengthProfile(input({ tier: 4, gameCount: 4, crossoverPlayerCount: 0, crossoverDeltas: [] }));
  assert.equal(translateScoreByCompetition(90, strong) > translateScoreByCompetition(90, weak), true);
  assert.equal(weak.evidenceWeight < strong.evidenceWeight, true);
});

test("data coverage changes confidence rather than masquerading as league strength", () => {
  const covered = buildCompetitionStrengthProfile(input());
  const sparse = buildCompetitionStrengthProfile(input({ gameCount: 2, teamCount: 2, playerCount: 10, crossoverPlayerCount: 0 }));
  assert.equal(covered.confidence > sparse.confidence, true);
});

test("lower crossover production means the target competition is harder", () => {
  const harder = buildCompetitionStrengthProfile(input({ crossoverDeltas: [-8, -6, -7] }));
  const easier = buildCompetitionStrengthProfile(input({ crossoverDeltas: [8, 6, 7] }));
  assert.equal(harder.strengthRating > easier.strengthRating, true);
});

test("uncalibrated within-pool depth cannot erase the governance anchor", () => {
  const profile = buildCompetitionStrengthProfile(input({
    independentPlayerRatings: [1, 2, 3],
    teamPerformanceRatings: [1, 2, 3],
    crossoverPlayerCount: 0,
    crossoverDeltas: []
  }));
  assert.equal(profile.strengthRating, profile.governancePrior);
});

test("display tiers are labels derived from the continuous strength score", () => {
  assert.equal(competitionTierFromStrength(85), 1);
  assert.equal(competitionTierFromStrength(70), 2);
  assert.equal(competitionTierFromStrength(55), 3);
  assert.equal(competitionTierFromStrength(54.99), 4);
});

test("competition translation remains continuous around display-tier boundaries", () => {
  const justBelow = buildCompetitionStrengthProfile(input({ qualityScore: 69.99, crossoverPlayerCount: 0, crossoverDeltas: [] }));
  const justAbove = buildCompetitionStrengthProfile(input({ qualityScore: 70.01, crossoverPlayerCount: 0, crossoverDeltas: [] }));
  assert.equal(Math.abs(translateScoreByCompetition(90, justAbove) - translateScoreByCompetition(90, justBelow)) < 0.1, true);
});
