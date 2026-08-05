export type FormulaV3Params = {
  advancedMetricWeight: number;
  advancedAdjustmentMax: number;
  contextPriorGames: number;
  opponentTeamSlope: number;
  opponentTeamMax: number;
  opponentLineupSlope: number;
  opponentLineupMax: number;
  ownTeamSlope: number;
  ownTeamMax: number;
  teammateLineupSlope: number;
  teammateLineupMax: number;
  totalContextMax: number;
  recencyHalfLifeDays: number;
  recencyFloor: number;
  perMinuteWeight: number;
  perMinuteMinimumMinutes: number;
  perMinuteFullReliabilityMinutes: number;
  competitionTranslation: Record<1 | 2 | 3 | 4, { scale: number; offset: number; evidenceWeight: number }>;
  uncertaintyPenaltyFactor: number;
  competitionUncertaintyMax: number;
  establishedQualityGames: number;
  developingQualityGames: number;
  boysMinimumRawGames: number;
  girlsMinimumRawGames: number;
  boysMinimumQualityGames: number;
  girlsMinimumQualityGames: number;
};

/** Conservative shadow parameters. Every contextual adjustment is bounded. */
export const DEFAULT_FORMULA_V3_PARAMS: FormulaV3Params = {
  advancedMetricWeight: 0.12,
  advancedAdjustmentMax: 6,
  contextPriorGames: 5,
  opponentTeamSlope: 0.06,
  opponentTeamMax: 2,
  opponentLineupSlope: 0.1,
  opponentLineupMax: 1.5,
  ownTeamSlope: 0.03,
  ownTeamMax: 1,
  teammateLineupSlope: 0.07,
  teammateLineupMax: 1,
  totalContextMax: 4.5,
  recencyHalfLifeDays: 120,
  recencyFloor: 0.55,
  perMinuteWeight: 0.12,
  perMinuteMinimumMinutes: 8,
  perMinuteFullReliabilityMinutes: 32,
  competitionTranslation: {
    1: { scale: 1, offset: 0, evidenceWeight: 1 },
    2: { scale: 0.94, offset: -1, evidenceWeight: 0.85 },
    3: { scale: 0.82, offset: -4, evidenceWeight: 0.6 },
    4: { scale: 0.68, offset: -7, evidenceWeight: 0.4 }
  },
  // Conservative ranking adjustment. Expected ability remains separate for audits.
  uncertaintyPenaltyFactor: 0.5,
  competitionUncertaintyMax: 6,
  establishedQualityGames: 8,
  developingQualityGames: 3,
  boysMinimumRawGames: 10,
  girlsMinimumRawGames: 5,
  boysMinimumQualityGames: 8,
  girlsMinimumQualityGames: 4
};
