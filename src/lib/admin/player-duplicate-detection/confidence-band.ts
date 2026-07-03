import type { DuplicateConfidenceBand } from "@/lib/admin/player-duplicate-detection/types";

export function confidenceBandForScore(score: number): DuplicateConfidenceBand {
  if (score >= 95) return "Almost Certain";
  if (score >= 80) return "Very Likely";
  if (score >= 60) return "Possible";
  return "Low Confidence";
}
