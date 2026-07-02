import type { AgeGroup } from "@prisma/client";

import { clamp } from "@/lib/advanced-metrics";
import type { RankingAgeBracket } from "@/lib/ranking-eligibility";

import type { EvidenceRole, FormulaVnextParams } from "./types";

const BRACKET_ORDER: Record<"U13" | "U16" | "U19", number> = { U13: 1, U16: 2, U19: 3 };

function bracketToOrder(bracket: RankingAgeBracket | AgeGroup | null): number | null {
  if (!bracket || bracket === "OUT_OF_RANGE") return null;
  return BRACKET_ORDER[bracket as "U13" | "U16" | "U19"] ?? null;
}

export function deriveEvidenceRole(
  homeBracket: RankingAgeBracket | null,
  competitionAgeGroup: AgeGroup
): EvidenceRole {
  const homeOrder = bracketToOrder(homeBracket);
  const compOrder = bracketToOrder(competitionAgeGroup);
  if (homeOrder === null || compOrder === null) return "UNKNOWN";
  if (homeOrder === compOrder) return "HOME";
  if (homeOrder < compOrder) return "PLAYING_UP";
  return "PLAYING_DOWN";
}

export function opponentFactor(
  opponentRating: number | null | undefined,
  params: FormulaVnextParams
): number {
  const rating = opponentRating ?? params.opponentRatingNeutral;
  return clamp(
    1 + (rating - params.opponentRatingNeutral) * params.opponentSlope,
    params.opponentFactorMin,
    params.opponentFactorMax
  );
}

export function teamFactor(
  teamMateAvgBaseScore: number | null | undefined,
  playerPriorRating: number | null | undefined,
  params: FormulaVnextParams
): number {
  if (teamMateAvgBaseScore === null || teamMateAvgBaseScore === undefined) return 1;
  if (playerPriorRating === null || playerPriorRating === undefined) return 1;
  return clamp(
    1 - (teamMateAvgBaseScore - playerPriorRating) * params.teamSlope,
    params.teamFactorMin,
    params.teamFactorMax
  );
}

export function leagueTierWeight(tier: number, params: FormulaVnextParams): number {
  const key = Math.min(4, Math.max(1, Math.round(tier))) as 1 | 2 | 3 | 4;
  return params.leagueTierWeight[key];
}

export function ageFactor(role: EvidenceRole, params: FormulaVnextParams): number {
  if (role === "HOME" || role === "UNKNOWN") return 1;
  if (role === "PLAYING_UP") {
    return Math.min(params.playingUpFactorMax, 1 + params.playingUpPerYear);
  }
  return Math.max(params.playingDownFactorMin, 1 - params.playingDownPerYear);
}

export function advancedCompositeBonus(input: {
  per: number | null;
  winShares: number | null;
  pie: number | null;
  efgPct: number | null;
  tsPct: number | null;
}, params: FormulaVnextParams): number {
  const perBonus = input.per === null ? 0 : (input.per - 15) / 100;
  const wsBonus = input.winShares === null ? 0 : input.winShares * 0.5;
  const pieBonus = input.pie === null ? 0 : (input.pie - 0.1) * 20;
  const efgBonus = input.efgPct === null ? 0 : (input.efgPct - 0.45) * 5;
  const tsBonus = input.tsPct === null ? 0 : (input.tsPct - 0.5) * 5;
  return clamp(perBonus + wsBonus + pieBonus + efgBonus * 0.25 + tsBonus * 0.25, params.advancedBonusMin, params.advancedBonusMax);
}

export function recencyWeight(gameDate: Date, asOfDate: Date, params: FormulaVnextParams): number {
  const ageMs = asOfDate.getTime() - gameDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs <= 14 * dayMs) return params.recencyWeight14d;
  if (ageMs <= 31 * dayMs) return params.recencyWeight31d;
  return params.recencyWeightOlder;
}
