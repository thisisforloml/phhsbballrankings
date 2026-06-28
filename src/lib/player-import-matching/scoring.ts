import type { PlayerConfidenceBand } from "@/lib/stats-import/types";

export const SCOPED_TEAM_BONUS = 10;
export const PROGRAM_SCOPE_BONUS = 5;
export const PROVISIONAL_SCOPE_BONUS = 5;
export const SCOPED_STRONG_THRESHOLD = 80;
export const SCOPED_EXACT_THRESHOLD = 92;
export const GLOBAL_STRONG_THRESHOLD = 85;
export const GLOBAL_EXACT_THRESHOLD = 95;

export function teamEvidenceBonus(input: {
  onScopedRoster: boolean;
  onProgramRoster: boolean;
  provisionalScopedToTeam: boolean;
}) {
  if (input.onScopedRoster) {
    return SCOPED_TEAM_BONUS + (input.provisionalScopedToTeam ? PROVISIONAL_SCOPE_BONUS : 0);
  }
  if (input.onProgramRoster) {
    return PROGRAM_SCOPE_BONUS + (input.provisionalScopedToTeam ? PROVISIONAL_SCOPE_BONUS : 0);
  }
  return 0;
}

export function applyTeamScoreBonus(baseScore: number, bonus: number) {
  return Math.min(100, baseScore + bonus);
}

export function confidenceBandFromScore(
  score: number,
  ambiguous: boolean,
  scopedContext: boolean
): PlayerConfidenceBand {
  if (ambiguous) return "Review Needed";
  if (scopedContext) {
    if (score >= SCOPED_EXACT_THRESHOLD) return "Exact";
    if (score >= SCOPED_STRONG_THRESHOLD) return "Strong Match";
  }
  if (score >= GLOBAL_EXACT_THRESHOLD) return "Exact";
  if (score >= GLOBAL_STRONG_THRESHOLD) return "Strong Match";
  if (score >= 50) return "Review Needed";
  return "Unmatched";
}

export function wasPromotedByTeamEvidence(
  baseScore: number,
  finalScore: number,
  ambiguous: boolean,
  scopedContext: boolean
) {
  if (!scopedContext || ambiguous) return false;
  const baseBand = confidenceBandFromScore(baseScore, false, false);
  const finalBand = confidenceBandFromScore(finalScore, false, scopedContext);
  const baseAuto = baseBand === "Exact" || baseBand === "Strong Match";
  const finalAuto = finalBand === "Exact" || finalBand === "Strong Match";
  return !baseAuto && finalAuto;
}
