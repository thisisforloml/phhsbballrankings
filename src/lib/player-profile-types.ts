/**
 * Player profile types only — safe for "use client" imports.
 * Server loaders live in player-profile.ts (server-only).
 */

import type { EligibilityVerdict } from "./eligibility/types";
import type { CompetitionParticipationSummary } from "./player-competition-context";
import type { BenchmarkGranularity } from "./player-profile-analytics";

export type { BenchmarkGranularity };

export type PlayerProfileGame = {
  gameId: string;
  gameDate: string;
  gameNumber: string | null;
  leagueName: string;
  seasonName: string;
  teamName: string;
  opponentName: string;
  result: "W" | "L";
  teamScore: number;
  opponentScore: number;
  minutes: number | null;
  points: number;
  rebounds: number;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  plusMinus: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  twoMade: number | null;
  twoAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  fieldGoalPct: number | null;
  twoPointPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
  assistTurnoverRatio: number | null;
  boxEfficiency: number;
  finalPerformanceScore: number | null;
};

export type PlayerProfileLeague = {
  leagueName: string;
  seasonName: string;
  tier: number;
  tierLabel: "Entry" | "Developmental" | "Competitive" | "Elite";
  gamesPlayed: number;
  avgPoints: number;
  avgAssists: number;
  avgRebounds: number;
  avgBoxEfficiency: number;
  productionMarker: string;
};

export type PlayerProfileAverages = {
  gamesPlayed: number;
  minutes: number | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  plusMinus: number | null;
};

export type PlayerProfileShooting = {
  fieldGoalPct: number | null;
  twoPointPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
  effectiveFieldGoalPct: number | null;
  trueShootingPct: number | null;
};

export type PlayerProfileAdvancedMetric = {
  label: string;
  value: string;
  description: string;
};

export type PlayerProfileHigh = {
  label: string;
  value: number;
  gameNumber: string | null;
  opponentName: string;
  gameDate: string;
};

export type PlayerProfileRankingTrend = {
  weekOf: string;
  rank: number;
  movement: number;
  rating: number;
  ageVerificationStatus: "VERIFIED" | "PENDING" | null;
}[];

export type PlayerProfileRecentForm = {
  label: "Heating Up" | "Steady" | "Cooling" | "Limited Sample";
  explanation: string;
  gamesEvaluated: number;
  recentAverages: PlayerProfileAverages | null;
  recentBoxEfficiency: number | null;
  fullBoxEfficiency: number | null;
  pointsDelta: number | null;
  reboundsDelta: number | null;
  assistsDelta: number | null;
  boxEfficiencyDelta: number | null;
};

export type PlayerProfileBestGame = {
  game: PlayerProfileGame;
  selectionMetric: "Box Impact";
};

export type PlayerProfilePercentile = {
  key: "scoring" | "efficiency" | "rebounding" | "playmaking" | "defense" | "accuracy" | "sample";
  label: string;
  percentile: number | null;
  value: number;
  comparisonCount: number;
};

export type PlayerProfileBenchmarkStat = "points" | "rebounds" | "assists" | "trueShootingPct";

export type PlayerProfileBenchmark = {
  ageGroupAverage: number | null;
  leagueAverage: number | null;
};

export type PlayerProfilePeriodBenchmarkPoint = {
  periodKey: string;
  value: number;
};

export type PlayerProfileBenchmarks = {
  leagueName: string | null;
  comparisonCount: number;
  qualifyingMinutes: number;
  stats: Record<PlayerProfileBenchmarkStat, PlayerProfileBenchmark>;
  leaguePeriodAverages: Record<BenchmarkGranularity, Record<PlayerProfileBenchmarkStat, PlayerProfilePeriodBenchmarkPoint[]>>;
};

export type PlayerProfileSkillRating = {
  key: "scoring" | "efficiency" | "rebounding" | "playmaking" | "defense" | "accuracy";
  label: string;
  rating: number | null;
  rawValue: number;
};

export type PlayerProfileRoleArchetype = {
  label: "Primary Scorer" | "Efficient Finisher" | "Playmaker" | "Glass Cleaner" | "Defensive Disruptor" | "All-Around Contributor" | "Developing Contributor" | "Limited Sample";
  explanation: string;
};

export type PlayerProfileStrengthBadge = {
  label: string;
  reason: string;
};

export type PlayerProfileIntelligence = {
  roleArchetype: PlayerProfileRoleArchetype;
  percentiles: PlayerProfilePercentile[];
  skillRatings: PlayerProfileSkillRating[];
  strengthBadges: PlayerProfileStrengthBadge[];
  limitedSample: boolean;
  comparisonCount: number;
  benchmarks: PlayerProfileBenchmarks;
};

export type PlayerProfile = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  city: string;
  region: string;
  gender: "BOYS" | "GIRLS";
  position: string | null;
  heightCm: number | null;
  birthDate: string | null;
  birthYear: number | null;
  classYear: string | null;
  classYearOverride: number | null;
  schoolOverride: string | null;
  ageGroupOverride: "U13" | "U16" | "U19" | null;
  age: number | null;
  photoUrl: string | null;
  currentTeam: string;
  ageGroup: "U13" | "U16" | "U19";
  rating: number;
  observedRating: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  verifiedGameCount: number;
  nationalRank: number | null;
  regionRank: number | null;
  positionRank: number | null;
  snapshotWeekOf: string | null;
  eligibilityVerdict: EligibilityVerdict | null;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  bestFourthStat: {
    label: string;
    value: number | string;
  };
  latestFiveGames: PlayerProfileGame[];
  allGames: PlayerProfileGame[];
  leagues: PlayerProfileLeague[];
  competitionParticipation: CompetitionParticipationSummary;
  averages: PlayerProfileAverages;
  recentFiveAverages: PlayerProfileAverages | null;
  shooting: PlayerProfileShooting;
  advancedMetrics: PlayerProfileAdvancedMetric[];
  gameHighs: PlayerProfileHigh[];
  bestGame: PlayerProfileBestGame | null;
  roleIndicators: string[];
  intelligence: PlayerProfileIntelligence;
  recentForm: PlayerProfileRecentForm;
  rankingTrend: PlayerProfileRankingTrend;
};
