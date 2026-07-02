import { AgeGroup, PlayerGender } from "@prisma/client";

import { DEFAULT_TPI_V1_PARAMETERS, type TpiV1Parameters } from "./constants";

export type TeamStandingsGender = "Boys" | "Girls";

export type TeamTpiGameInput = {
  gameId: string;
  gameNumber: string | null;
  gameDate: Date;
  homeScore: number;
  awayScore: number;
  homeProgramId: string;
  awayProgramId: string;
  homeProgramName: string;
  awayProgramName: string;
  leagueTier: number;
  leagueId: string;
  seasonId: string;
  ageGroup: AgeGroup;
  gender: TeamStandingsGender;
};

type PendingGame = {
  gameId: string;
  gameDate: Date;
  opponentProgramId: string;
  opponentName: string;
  won: boolean;
  pointDiff: number;
  leagueTier: number;
  competitionKey: string;
};

export type TeamTpiProgramState = {
  programId: string;
  programName: string;
  ageGroup: AgeGroup;
  gender: TeamStandingsGender;
  verifiedGames: number;
  opponents: Set<string>;
  competitions: Set<string>;
  wins: number;
  losses: number;
  tierWeightedWins: number;
  tierWeightedGames: number;
  games: PendingGame[];
};

export type TeamTpiProgramResult = {
  programId: string;
  programName: string;
  ageGroup: AgeGroup;
  gender: TeamStandingsGender;
  verifiedGames: number;
  verifiedOpponents: number;
  verifiedCompetitions: number;
  wins: number;
  losses: number;
  pass0Strength: number;
  pass1ObservedFinal: number;
  tpiObservedRaw: number;
  effectiveWeight: number;
  tpiAdjusted: number;
  shrinkageEffect: number;
  publicBoardEligible: boolean;
};

const TIER_WEIGHT: Record<number, number> = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.4 };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function inferTeamStandingsGender(
  leagueName: string,
  homeTeamName: string,
  awayTeamName?: string | null
): TeamStandingsGender {
  const text = [leagueName, homeTeamName, awayTeamName].filter(Boolean).join(" ").toLowerCase();
  return text.includes("girls") ? "Girls" : "Boys";
}

export function teamStandingsGenderToPlayerGender(gender: TeamStandingsGender): PlayerGender {
  return gender === "Girls" ? PlayerGender.GIRLS : PlayerGender.BOYS;
}

export function playerGenderToTeamStandingsGender(gender: PlayerGender): TeamStandingsGender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

export function boardGroupKey(ageGroup: AgeGroup, gender: TeamStandingsGender) {
  return `${ageGroup}:${gender}`;
}

export function dedupeTeamTpiGames(rows: TeamTpiGameInput[]): TeamTpiGameInput[] {
  const seen = new Map<string, TeamTpiGameInput>();
  for (const g of rows) {
    const key = g.gameNumber ?? g.gameId;
    if (!seen.has(key)) seen.set(key, g);
  }
  return [...seen.values()];
}

export function recencyWeight(gameDate: Date, evaluationDate: Date, params: TpiV1Parameters) {
  const ageDays = Math.max(0, Math.floor((evaluationDate.getTime() - gameDate.getTime()) / 86_400_000));
  if (ageDays > params.maxAgeDays) return 0;
  return Math.exp((-Math.LN2 / params.halfLifeDays) * ageDays);
}

export function opponentFactor(strength: number) {
  return clamp(1 + (strength - 50) / 400, 0.85, 1.15);
}

export function computeGameScore(
  won: boolean,
  pointDiff: number,
  opponentStrength: number,
  leagueTier: number,
  gameDate: Date,
  evaluationDate: Date,
  params: TpiV1Parameters
) {
  const outcomeBase = won ? 55 : pointDiff === 0 ? 50 : 45;
  const marginAdj = clamp(pointDiff / 20, -5, 5);
  const oppAdj = (opponentStrength - 50) * 0.12;
  const preMultiplier = outcomeBase + marginAdj + oppAdj;
  const leagueTierWeight = TIER_WEIGHT[leagueTier] ?? 1.0;
  const recW = recencyWeight(gameDate, evaluationDate, params);
  const oppF = opponentFactor(opponentStrength);
  const gameScore = preMultiplier * leagueTierWeight * recW * oppF;
  return { gameScore, recencyWeight: recW, leagueTierWeight };
}

function pass0Strength(p: TeamTpiProgramState) {
  return 30 + 40 * (p.tierWeightedWins / Math.max(p.tierWeightedGames, 1));
}

function evaluatePrograms(
  programs: TeamTpiProgramState[],
  opponentStrengths: Map<string, number>,
  evaluationDate: Date,
  params: TpiV1Parameters
) {
  const observed = new Map<string, number>();
  const effectiveWeights = new Map<string, number>();
  const rawSums = new Map<string, number>();

  for (const p of programs) {
    let effectiveWeight = 0;
    let rawSum = 0;
    for (const g of p.games) {
      const oppStrength = opponentStrengths.get(g.opponentProgramId) ?? 50;
      const calc = computeGameScore(g.won, g.pointDiff, oppStrength, g.leagueTier, g.gameDate, evaluationDate, params);
      rawSum += calc.gameScore;
      effectiveWeight += calc.recencyWeight;
    }
    rawSums.set(p.programId, rawSum);
    effectiveWeights.set(p.programId, effectiveWeight);
    observed.set(
      p.programId,
      effectiveWeight > 0 ? clamp(rawSum / effectiveWeight, 25, 75) : params.boardPrior
    );
  }

  return { observed, effectiveWeights, rawSums };
}

function shrinkage(effectiveWeight: number, observed: number, params: TpiV1Parameters) {
  return (effectiveWeight * observed + params.shrinkageK * params.boardPrior) / (effectiveWeight + params.shrinkageK);
}

export function buildTeamTpiPrograms(gameRows: TeamTpiGameInput[]): TeamTpiProgramState[] {
  const map = new Map<string, TeamTpiProgramState>();

  function ensure(programId: string, name: string, ageGroup: AgeGroup, gender: TeamStandingsGender) {
    let p = map.get(programId);
    if (!p) {
      p = {
        programId,
        programName: name,
        ageGroup,
        gender,
        verifiedGames: 0,
        opponents: new Set(),
        competitions: new Set(),
        wins: 0,
        losses: 0,
        tierWeightedWins: 0,
        tierWeightedGames: 0,
        games: []
      };
      map.set(programId, p);
    }
    return p;
  }

  for (const g of gameRows) {
    const tierW = TIER_WEIGHT[g.leagueTier] ?? 1.0;
    const homeWon = g.homeScore > g.awayScore;
    const awayWon = g.awayScore > g.homeScore;
    const competitionKey = `${g.leagueId}:${g.seasonId}`;
    const home = ensure(g.homeProgramId, g.homeProgramName, g.ageGroup, g.gender);
    const away = ensure(g.awayProgramId, g.awayProgramName, g.ageGroup, g.gender);

    home.verifiedGames += 1;
    away.verifiedGames += 1;
    home.opponents.add(g.awayProgramId);
    away.opponents.add(g.homeProgramId);
    home.competitions.add(competitionKey);
    away.competitions.add(competitionKey);
    home.tierWeightedGames += tierW;
    away.tierWeightedGames += tierW;

    if (homeWon) {
      home.wins += 1;
      home.tierWeightedWins += tierW;
      away.losses += 1;
    } else if (awayWon) {
      away.wins += 1;
      away.tierWeightedWins += tierW;
      home.losses += 1;
    }

    home.games.push({
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponentProgramId: g.awayProgramId,
      opponentName: g.awayProgramName,
      won: homeWon,
      pointDiff: g.homeScore - g.awayScore,
      leagueTier: g.leagueTier,
      competitionKey
    });
    away.games.push({
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponentProgramId: g.homeProgramId,
      opponentName: g.homeProgramName,
      won: awayWon,
      pointDiff: g.awayScore - g.homeScore,
      leagueTier: g.leagueTier,
      competitionKey
    });
  }

  return [...map.values()];
}

export function computeTeamTpiForPrograms(
  programs: TeamTpiProgramState[],
  evaluationDate: Date,
  params: TpiV1Parameters = DEFAULT_TPI_V1_PARAMETERS
): TeamTpiProgramResult[] {
  const pass0 = new Map(programs.map((p) => [p.programId, pass0Strength(p)]));
  const pass0Eval = evaluatePrograms(programs, pass0, evaluationDate, params);
  const pass1Strength = new Map(pass0Eval.observed);
  const pass1Eval = evaluatePrograms(programs, pass1Strength, evaluationDate, params);

  return programs.map((p) => {
    const effectiveWeight = pass1Eval.effectiveWeights.get(p.programId) ?? 0;
    const observedClamped = pass1Eval.observed.get(p.programId) ?? params.boardPrior;
    const rawObserved =
      effectiveWeight > 0 ? (pass1Eval.rawSums.get(p.programId) ?? 0) / effectiveWeight : params.boardPrior;
    const tpiAdjusted = shrinkage(effectiveWeight, observedClamped, params);
    const publicBoardEligible =
      p.verifiedGames >= params.minGames && p.opponents.size >= params.minOpponents;

    return {
      programId: p.programId,
      programName: p.programName,
      ageGroup: p.ageGroup,
      gender: p.gender,
      verifiedGames: p.verifiedGames,
      verifiedOpponents: p.opponents.size,
      verifiedCompetitions: p.competitions.size,
      wins: p.wins,
      losses: p.losses,
      pass0Strength: round2(pass0.get(p.programId)!),
      pass1ObservedFinal: round2(observedClamped),
      tpiObservedRaw: round2(rawObserved),
      effectiveWeight: round2(effectiveWeight),
      tpiAdjusted: round2(tpiAdjusted),
      shrinkageEffect: round2(tpiAdjusted - observedClamped),
      publicBoardEligible
    };
  });
}

export function computeTeamTpiBoard(
  gameRows: TeamTpiGameInput[],
  evaluationDate: Date,
  params: TpiV1Parameters = DEFAULT_TPI_V1_PARAMETERS
): TeamTpiProgramResult[] {
  const programs = buildTeamTpiPrograms(gameRows);
  return computeTeamTpiForPrograms(programs, evaluationDate, params);
}

export function groupTeamTpiGamesByBoard(games: TeamTpiGameInput[]) {
  const boards = new Map<string, TeamTpiGameInput[]>();
  for (const g of games) {
    const key = boardGroupKey(g.ageGroup, g.gender);
    if (!boards.has(key)) boards.set(key, []);
    boards.get(key)!.push(g);
  }
  return boards;
}
