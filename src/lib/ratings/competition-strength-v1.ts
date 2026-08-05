export const COMPETITION_STRENGTH_POLICY_ID = "competition-strength-v1.1-continuous-shadow";

export type CompetitionStrengthInput = {
  poolKey: string;
  leagueId: string;
  seasonId: string;
  label: string;
  tier: number;
  qualityScore: number;
  governanceVerified?: boolean;
  governanceEvidenceScore?: number;
  gameCount: number;
  teamCount: number;
  playerCount: number;
  crossoverPlayerCount: number;
  independentPlayerRatings: number[];
  teamPerformanceRatings: number[];
  crossoverDeltas: number[];
};

export type CompetitionStrengthProfile = {
  poolKey: string;
  leagueId: string;
  seasonId: string;
  label: string;
  governancePrior: number;
  observedStrength: number;
  strengthRating: number;
  displayTier: 1 | 2 | 3 | 4;
  confidence: number;
  confidenceSource: "OBSERVED" | "VERIFIED_GOVERNANCE";
  provisional: boolean;
  translationScale: number;
  translationOffset: number;
  evidenceWeight: number;
  highQualityEvidence: boolean;
  diagnostics: {
    gameCount: number;
    teamCount: number;
    playerCount: number;
    crossoverPlayerCount: number;
    teamStrength: number | null;
    playerDepth: number | null;
    crossoverStrength: number | null;
  };
};

const TIER_PRIOR: Record<1 | 2 | 3 | 4, number> = {
  1: 92,
  2: 80,
  3: 67,
  4: 55
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function tierKey(tier: number): 1 | 2 | 3 | 4 {
  return clamp(Math.round(tier), 1, 4) as 1 | 2 | 3 | 4;
}

export function competitionTierFromStrength(strengthRating: number): 1 | 2 | 3 | 4 {
  if (strengthRating >= 85) return 1;
  if (strengthRating >= 70) return 2;
  if (strengthRating >= 55) return 3;
  return 4;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function percentile(values: number[], target: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * target;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}


export function governanceCompetitionPrior(tier: number, qualityScore: number) {
  const tierPrior = TIER_PRIOR[tierKey(tier)];
  if (!Number.isFinite(qualityScore) || qualityScore <= 0) return tierPrior;
  return clamp(tierPrior * 0.6 + clamp(qualityScore, 0, 100) * 0.4, 35, 98);
}

export function buildCompetitionStrengthProfile(input: CompetitionStrengthInput): CompetitionStrengthProfile {
  const governancePrior = governanceCompetitionPrior(input.tier, input.qualityScore);
  const teamMedian = percentile(input.teamPerformanceRatings, 0.5);
  const teamUpper = percentile(input.teamPerformanceRatings, 0.75);
  const teamStrength = teamMedian === null || teamUpper === null ? null : teamMedian * 0.55 + teamUpper * 0.45;
  const playerMedian = percentile(input.independentPlayerRatings, 0.5);
  const playerUpper = percentile(input.independentPlayerRatings, 0.75);
  const playerDepth = playerMedian === null || playerUpper === null ? null : playerMedian * 0.4 + playerUpper * 0.6;
  const crossoverDelta = average(input.crossoverDeltas);
  // The same player's lower relative production in a pool is evidence that the
  // pool is harder, not weaker. Pool-local percentiles and team ratings remain
  // diagnostics because both are centered inside their own competitions and
  // cannot establish absolute national strength without bridge evidence.
  const crossoverStrength = crossoverDelta === null
    ? null
    : clamp(governancePrior - clamp(crossoverDelta * 1.5, -12, 12), 35, 98);

  const scheduleConfidence = Math.min(1, input.gameCount / 32);
  const teamConfidence = Math.min(1, input.teamCount / 8);
  const playerConfidence = Math.min(1, input.playerCount / 80);
  const crossoverConfidence = Math.min(1, input.crossoverPlayerCount / 12);
  const evidenceConfidence = clamp(
    scheduleConfidence * 0.3 + teamConfidence * 0.2 + playerConfidence * 0.25 + crossoverConfidence * 0.25,
    0,
    1
  );
  const governanceConfidence = input.governanceVerified
    ? clamp(0.45 + clamp(input.governanceEvidenceScore ?? input.qualityScore, 0, 100) * 0.0035, 0.45, 0.8)
    : 0;
  const confidence = Math.max(evidenceConfidence, governanceConfidence);
  const confidenceSource = governanceConfidence > evidenceConfidence ? "VERIFIED_GOVERNANCE" : "OBSERVED";
  const observedStrength = crossoverStrength ?? governancePrior;
  const learnedWeight = crossoverStrength === null ? 0 : 0.65 * crossoverConfidence;
  const strengthRating = clamp(
    governancePrior * (1 - learnedWeight) + observedStrength * learnedWeight,
    35,
    98
  );

  // A single monotonic translation replaces the contradictory v1 tier multipliers.
  const translationScale = 0.6 + 0.4 * (strengthRating / 100);
  const translationOffset = 12 * (strengthRating / 100 - 0.75);
  const evidenceWeight = 0.35 + 0.65 * (strengthRating / 100);

  return {
    poolKey: input.poolKey,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    label: input.label,
    governancePrior: Number(governancePrior.toFixed(2)),
    observedStrength: Number(observedStrength.toFixed(2)),
    strengthRating: Number(strengthRating.toFixed(2)),
    displayTier: competitionTierFromStrength(strengthRating),
    confidence: Number(confidence.toFixed(3)),
    confidenceSource,
    provisional: confidence < 0.45,
    translationScale: Number(translationScale.toFixed(4)),
    translationOffset: Number(translationOffset.toFixed(4)),
    evidenceWeight: Number(evidenceWeight.toFixed(4)),
    highQualityEvidence: strengthRating >= 78 && confidence >= 0.45,
    diagnostics: {
      gameCount: input.gameCount,
      teamCount: input.teamCount,
      playerCount: input.playerCount,
      crossoverPlayerCount: input.crossoverPlayerCount,
      teamStrength: teamStrength === null ? null : Number(teamStrength.toFixed(2)),
      playerDepth: playerDepth === null ? null : Number(playerDepth.toFixed(2)),
      crossoverStrength: crossoverStrength === null ? null : Number(crossoverStrength.toFixed(2))
    }
  };
}

export function translateScoreByCompetition(score: number, profile: CompetitionStrengthProfile) {
  return clamp(50 + (score - 50) * profile.translationScale + profile.translationOffset, 1, 100);
}
