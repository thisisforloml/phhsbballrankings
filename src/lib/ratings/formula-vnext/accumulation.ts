import { PlayerGender } from "@prisma/client";
import { starFromAdjustedRating } from "@/lib/player-rating-cumulative";
import type { RankingAgeBracket } from "@/lib/ranking-eligibility";
import {
  advancedCompositeBonus,
  ageFactor,
  leagueTierWeight,
  opponentFactor,
  recencyWeight,
  teamFactor
} from "./context-factors";
import type {
  AdjustedGameScore,
  FormulaVnextParams,
  LoadedGameEvidence,
  ShadowPlayerRating
} from "./types";

export function adjustGameScore(
  evidence: LoadedGameEvidence,
  params: FormulaVnextParams,
  asOfDate: Date
): AdjustedGameScore {
  const oppF = opponentFactor(evidence.opponentProgramRating, params);
  const teamF = teamFactor(evidence.teamMateAvgBaseScore, evidence.playerPriorRating, params);
  const leagueW = leagueTierWeight(evidence.leagueTier, params);
  const ageF = ageFactor(evidence.evidenceRole, params);
  const advBonus = advancedCompositeBonus(
    {
      per: evidence.playerEfficiencyRating,
      winShares: evidence.winShares,
      pie: evidence.pie,
      efgPct: evidence.effectiveFieldGoalPct,
      tsPct: evidence.trueShootingPct
    },
    params
  );
  const recW = recencyWeight(evidence.gameDate, asOfDate, params);
  const contextMultiplier = oppF * teamF * leagueW * ageF;
  const adjustedGameScore = Math.min(100, evidence.baseGameScore * contextMultiplier + advBonus);
  const effectiveWeight = recW * (evidence.evidenceRole === "PLAYING_DOWN" ? 0.85 : 1);

  return {
    ...evidence,
    opponentFactor: oppF,
    teamFactor: teamF,
    leagueWeight: leagueW,
    ageFactor: ageF,
    advancedBonus: advBonus,
    recencyWeight: recW,
    adjustedGameScore,
    effectiveWeight
  };
}

function shrinkagePriorGames(gender: PlayerGender, params: FormulaVnextParams): number {
  return gender === PlayerGender.GIRLS ? params.shrinkagePriorGamesGirls : params.shrinkagePriorGamesBoys;
}

export function accumulatePlayerRating(
  playerId: string,
  displayName: string,
  gender: PlayerGender,
  homeBracket: RankingAgeBracket,
  games: AdjustedGameScore[],
  boardMeanRating: number,
  params: FormulaVnextParams
): ShadowPlayerRating | null {
  if (!games.length || homeBracket === "OUT_OF_RANGE") return null;

  const totalWeight = games.reduce((sum, game) => sum + game.effectiveWeight, 0);
  if (totalWeight <= 0) return null;

  const observedRating = Number(
    (games.reduce((sum, game) => sum + game.adjustedGameScore * game.effectiveWeight, 0) / totalWeight).toFixed(2)
  );
  const priorGames = shrinkagePriorGames(gender, params);
  const adjustedRating = Number(
    ((games.length * observedRating + priorGames * boardMeanRating) / (games.length + priorGames)).toFixed(2)
  );

  const evidenceRoles = games.reduce<Record<string, number>>((acc, game) => {
    acc[game.evidenceRole] = (acc[game.evidenceRole] ?? 0) + 1;
    return acc;
  }, {});

  const homeCount = evidenceRoles.HOME ?? 0;
  const playingUpCount = evidenceRoles.PLAYING_UP ?? 0;
  const ratingBasis =
    homeCount > 0 && playingUpCount > 0 ? "BLENDED" : playingUpCount > 0 && homeCount === 0 ? "PROJECTED" : "DIRECT";

  return {
    playerId,
    displayName,
    gender,
    homeBracket,
    observedRating,
    adjustedRating,
    verifiedGameCount: games.length,
    effectiveGameWeight: Number(totalWeight.toFixed(2)),
    starRating: starFromAdjustedRating(adjustedRating),
    ratingBasis,
    evidenceRoles: evidenceRoles as ShadowPlayerRating["evidenceRoles"],
    avgOpponentFactor: Number((games.reduce((s, g) => s + g.opponentFactor, 0) / games.length).toFixed(3)),
    avgAgeFactor: Number((games.reduce((s, g) => s + g.ageFactor, 0) / games.length).toFixed(3))
  };
}

export function buildShadowRatings(
  evidence: LoadedGameEvidence[],
  params: FormulaVnextParams,
  asOfDate = new Date()
): ShadowPlayerRating[] {
  const adjusted = evidence.map((row) => adjustGameScore(row, params, asOfDate));
  const byPlayerBracket = new Map<string, AdjustedGameScore[]>();

  for (const game of adjusted) {
    if (!game.homeBracket || game.homeBracket === "OUT_OF_RANGE") continue;
    const key = `${game.playerId}|${game.homeBracket}`;
    const bucket = byPlayerBracket.get(key) ?? [];
    bucket.push(game);
    byPlayerBracket.set(key, bucket);
  }

  const boardMeans = new Map<string, number>();
  for (const [key, games] of byPlayerBracket) {
    const mean =
      games.reduce((sum, game) => sum + game.baseGameScore, 0) / Math.max(games.length, 1);
    boardMeans.set(key, mean);
  }

  const ratings: ShadowPlayerRating[] = [];
  for (const [key, games] of byPlayerBracket) {
    const [playerId, homeBracket] = key.split("|") as [string, RankingAgeBracket];
    const first = games[0];
    const boardMean = boardMeans.get(key) ?? 50;
    const rating = accumulatePlayerRating(
      playerId,
      first.displayName,
      first.gender,
      homeBracket,
      games,
      boardMean,
      params
    );
    if (rating) ratings.push(rating);
  }

  return ratings.sort((a, b) => b.adjustedRating - a.adjustedRating);
}
