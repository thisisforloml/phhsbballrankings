export type NullableNumber = number | null;

export type StatLine = {
  min: number;
  pts: number;
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  trb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
};

export type TeamTotals = StatLine & {
  teamMin: number;
  possessions?: number;
  rating?: number;
};

export type LeagueAverages = {
  pts: number;
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  trb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  poss: number;
  ptsPerPoss: number;
  trueShootingPct: number;
  averageUper: number;
  averageOrtg: number;
  averageDrtg: number;
};

export type AdvancedMetricResult = {
  efgPct: NullableNumber;
  tsPct: NullableNumber;
  usagePct: NullableNumber;
  uper: NullableNumber;
  per: NullableNumber;
  ortg: NullableNumber;
  drtg: NullableNumber;
  pie: NullableNumber;
  ows: NullableNumber;
  dws: NullableNumber;
  ws: NullableNumber;
  wsPer48: NullableNumber;
  apmBox: NullableNumber;
  rpmEstimate: NullableNumber;
  productionScore: number;
  advancedBonus: number;
  finalPerformanceScore: number;
};

function safeDivide(numerator: number, denominator: number, fallback: NullableNumber = null) {
  return denominator === 0 ? fallback : numerator / denominator;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function possessionEstimate(team: Pick<StatLine, "fga" | "oreb" | "tov" | "fta">) {
  return team.fga - team.oreb + team.tov + 0.44 * team.fta;
}

export function effectiveFieldGoalPct(stat: Pick<StatLine, "fgm" | "threePm" | "fga">): NullableNumber {
  return safeDivide(stat.fgm + 0.5 * stat.threePm, stat.fga);
}

export function trueShootingPct(stat: Pick<StatLine, "pts" | "fga" | "fta">): NullableNumber {
  return safeDivide(stat.pts, 2 * (stat.fga + 0.44 * stat.fta));
}

export function usagePct(stat: Pick<StatLine, "fga" | "fta" | "tov" | "min">, team: Pick<TeamTotals, "teamMin" | "fga" | "fta" | "tov">): NullableNumber {
  if (stat.min === 0) return null;
  return safeDivide(100 * ((stat.fga + 0.44 * stat.fta + stat.tov) * (team.teamMin / 5)), stat.min * (team.fga + 0.44 * team.fta + team.tov));
}

export function leagueConstants(league: LeagueAverages) {
  const lgFgmPerFtm = league.ftm === 0 ? 1 : league.fgm / league.ftm;
  const factor = (2 / 3) - (0.5 * safeDivide(league.ast, league.fgm, 0)!) / (2 * lgFgmPerFtm);
  const vop = safeDivide(league.pts, league.fga - league.oreb + league.tov + 0.44 * league.fta, 0)!;
  const drbPct = safeDivide(league.trb - league.oreb, league.trb, 0)!;
  return { factor, vop, drbPct };
}

export function unadjustedPer(stat: StatLine, team: TeamTotals, league: LeagueAverages): NullableNumber {
  if (stat.min === 0) return null;
  const { factor, vop, drbPct } = leagueConstants(league);
  const teamAstToFgm = team.fgm === 0 ? 0 : team.ast / team.fgm;
  const pfTerm = league.pf === 0 ? 0 : stat.pf * ((league.ftm / league.pf) - 0.44 * (league.fta / league.pf) * vop);
  const value =
    stat.threePm +
    (2 / 3) * stat.ast +
    (2 - factor * teamAstToFgm) * stat.fgm +
    stat.ftm * 0.5 * (1 + (1 - teamAstToFgm) + (2 / 3) * teamAstToFgm) -
    vop * stat.tov -
    vop * drbPct * (stat.fga - stat.fgm) -
    vop * 0.44 * (0.44 + 0.56 * drbPct) * (stat.fta - stat.ftm) +
    vop * (1 - drbPct) * (stat.trb - stat.oreb) +
    vop * drbPct * stat.oreb +
    vop * stat.stl +
    vop * drbPct * stat.blk -
    pfTerm;
  return value / stat.min;
}

export function normalizePer(uper: NullableNumber, leagueAverageUper: number): NullableNumber {
  if (uper === null || leagueAverageUper === 0) return null;
  return uper * (15 / leagueAverageUper);
}

export function offensiveRating(stat: StatLine, team: TeamTotals, opponent: TeamTotals) {
  const teamAstToFgm = safeDivide(team.ast, team.fgm, 0)!;
  const qastDenominator = (team.fgm / team.teamMin) * stat.min * 5 - stat.fgm;
  const qast =
    team.fgm === stat.fgm || qastDenominator === 0
      ? 0
      : (stat.min / (team.teamMin / 5)) * (1.14 * safeDivide(team.ast - stat.ast, team.fgm, 0)!) +
        (((team.ast / team.teamMin) * stat.min * 5 - stat.ast) / qastDenominator) *
          (1 - stat.min / (team.teamMin / 5));
  const fgPart = stat.fgm * (1 - 0.5 * safeDivide(stat.pts - stat.ftm, 2 * stat.fga, 0)! * qast);
  const astPart = 0.5 * safeDivide(team.pts - team.ftm - (stat.pts - stat.ftm), 2 * (team.fga - stat.fga), 0)! * stat.ast;
  const ftPart = stat.fta > 0 ? (1 - Math.pow(1 - stat.ftm / stat.fta, 2)) * 0.4 * stat.fta : 0;
  const teamScoringPoss = team.fgm + (team.fta > 0 ? (1 - Math.pow(1 - team.ftm / team.fta, 2)) * 0.4 * team.fta : 0);
  const teamPlayPct = safeDivide(teamScoringPoss, team.fga + 0.4 * team.fta + team.tov, 0)!;
  const teamOrbPct = safeDivide(team.oreb, team.oreb + opponent.dreb, 0)!;
  const teamOrbWeight = safeDivide(teamOrbPct * (1 - teamPlayPct), teamOrbPct * (1 - teamPlayPct) + (1 - teamOrbPct) * teamPlayPct, 0)!;
  const orbPart = stat.oreb * teamOrbWeight * teamPlayPct;
  const scPoss = (fgPart + astPart + ftPart) * (1 - safeDivide(team.oreb, teamScoringPoss, 0)! * teamOrbWeight * teamPlayPct) + orbPart;
  const fgxPoss = (stat.fga - stat.fgm) * (1 - 1.07 * teamOrbPct);
  const ftxPoss = stat.fta > 0 ? Math.pow(1 - stat.ftm / stat.fta, 2) * 0.4 * stat.fta : 0;
  const totalPoss = scPoss + fgxPoss + ftxPoss + stat.tov;
  const pprodFgPart = 2 * (stat.fgm + 0.5 * stat.threePm) * (1 - 0.5 * safeDivide(stat.pts - stat.ftm, 2 * stat.fga, 0)! * qast);
  const pprodAstPart =
    2 *
    safeDivide(team.fgm - stat.fgm + 0.5 * (team.threePm - stat.threePm), team.fgm - stat.fgm, 0)! *
    0.5 *
    safeDivide(team.pts - team.ftm - (stat.pts - stat.ftm), 2 * (team.fga - stat.fga), 0)! *
    stat.ast;
  const pprodOrbPart = stat.oreb * teamOrbWeight * teamPlayPct * safeDivide(team.pts, teamScoringPoss, 0)!;
  const pointsProduced =
    (pprodFgPart + pprodAstPart + pprodOrbPart) *
      (1 - safeDivide(team.oreb, teamScoringPoss, 0)! * teamOrbWeight * teamPlayPct) +
    pprodOrbPart;
  return {
    qast,
    scoringPossessions: scPoss,
    totalPossessions: totalPoss,
    pointsProduced,
    rating: totalPoss === 0 ? null : 100 * (pointsProduced / totalPoss),
    teamAstToFgm
  };
}

export function defensiveRating(stat: StatLine, team: TeamTotals, opponent: TeamTotals): { rating: NullableNumber; stopPct: NullableNumber; opponentPossessions: number } {
  const drebPct = safeDivide(stat.dreb, stat.dreb + opponent.oreb, 0)!;
  const oppOrbPct = safeDivide(opponent.oreb, opponent.oreb + team.dreb, 0)!;
  const fmwt = safeDivide(drebPct * (1 - 1.07 * oppOrbPct), drebPct * (1 - 1.07 * oppOrbPct) + (1 - drebPct) * 1.07 * oppOrbPct, 0)!;
  const stops1 = stat.stl + stat.blk * fmwt * (1 - 1.07 * oppOrbPct) + stat.dreb * (1 - fmwt);
  const stops2 =
    (safeDivide(opponent.fga - opponent.fgm - team.blk, team.teamMin, 0)! * fmwt * (1 - 1.07 * oppOrbPct) +
      safeDivide(opponent.tov - team.stl, team.teamMin, 0)!) *
      stat.min +
    stat.stl * (1 - fmwt);
  const stops = stops1 + stops2;
  const oppPoss = possessionEstimate(opponent);
  const stopPct = safeDivide(stops * oppPoss, (opponent.fga + 0.44 * opponent.fta + opponent.tov) * stat.min);
  const teamDrtg = safeDivide(100 * opponent.pts, oppPoss);
  const dPtsPerScPoss = safeDivide(opponent.pts, opponent.fgm + (opponent.fta > 0 ? (1 - Math.pow(1 - opponent.ftm / opponent.fta, 2)) * 0.4 * opponent.fta : 0));
  if (teamDrtg === null || dPtsPerScPoss === null || stopPct === null) return { rating: null, stopPct, opponentPossessions: oppPoss };
  return {
    rating: teamDrtg + 0.2 * (100 * dPtsPerScPoss * (1 - stopPct) - teamDrtg),
    stopPct,
    opponentPossessions: oppPoss
  };
}

export function playerImpactEstimate(stat: StatLine, gameStats: StatLine[]): NullableNumber {
  const total = (line: StatLine) => line.pts + line.fgm - line.fga + line.ftm - line.fta + line.dreb + 0.5 * line.oreb + line.ast + line.stl + 0.5 * line.blk - line.pf - line.tov;
  const playerTotal = total(stat);
  const gameTotal = gameStats.reduce((sum, line) => sum + total(line), 0);
  return safeDivide(playerTotal, gameTotal);
}

export function winShares(stat: StatLine, team: TeamTotals, league: LeagueAverages, ortg: ReturnType<typeof offensiveRating>, drtg: ReturnType<typeof defensiveRating>) {
  const teamPoss = team.possessions ?? possessionEstimate(team);
  const leaguePossPerGame = Math.max(league.poss, 1);
  const marginalPointsPerWin = 0.32 * league.ptsPerPoss * (teamPoss / leaguePossPerGame);
  const offensivePoss = ortg.totalPossessions;
  const marginalOffense = ortg.pointsProduced - 0.92 * league.ptsPerPoss * offensivePoss;
  const ows = safeDivide(marginalOffense, 2 * marginalPointsPerWin, 0)!;
  const teamDrtg = safeDivide(100 * team.pts, teamPoss, 0)!;
  const stopPct = drtg.stopPct ?? 0;
  const drtgContribution = (stopPct - 1) * safeDivide(stat.min, team.teamMin, 0)!;
  const marginalDefense = safeDivide(stat.min, team.teamMin, 0)! * teamPoss * (1.08 * league.ptsPerPoss - (teamDrtg / 100 + drtgContribution * 0.2));
  const dws = safeDivide(marginalDefense, 2 * marginalPointsPerWin, 0)!;
  const ws = ows + dws;
  return { ows, dws, ws, wsPer48: stat.min === 0 ? null : (ws * 48) / stat.min };
}

export function apmBox(ortg: NullableNumber, drtg: NullableNumber, usg: NullableNumber, totalPoss: number, oppPoss: number, league: LeagueAverages, poss: number): NullableNumber {
  if (ortg === null || drtg === null || usg === null || poss === 0) return null;
  const roleFactor = usg / 20;
  const offensiveValue = ((ortg - league.averageOrtg) * totalPoss) / 100 * roleFactor;
  const defensiveValue = ((league.averageDrtg - drtg) * oppPoss) / 100;
  return (offensiveValue + defensiveValue) * (100 / poss);
}

export function rpmEstimate(apmRaw: NullableNumber, seasonMinutes: number): NullableNumber {
  if (apmRaw === null || seasonMinutes === 0) return null;
  const shrinkageConstant = 500 / seasonMinutes;
  return (seasonMinutes * apmRaw) / (seasonMinutes + shrinkageConstant);
}

export function productionScore(stat: StatLine, league: LeagueAverages, ageGroup90thPercentileProduction: number) {
  const base = stat.pts + 1.5 * stat.ast + 1.2 * stat.trb;
  const ts = trueShootingPct(stat);
  let efficiencyBonus = 0;
  if (stat.fga > 0 && stat.fta > 0 && ts !== null) {
    efficiencyBonus += (ts - league.trueShootingPct) * stat.pts * 0.5;
  }
  const astToRatio = stat.ast / Math.max(stat.tov, 1);
  const turnoverPenalty = stat.tov * (league.ptsPerPoss * 0.85);
  efficiencyBonus += (astToRatio - 2.0) * 1.5;
  efficiencyBonus -= turnoverPenalty * 0.1;
  efficiencyBonus += stat.stl * 1.5;
  efficiencyBonus += stat.blk * 1.2;
  const raw = base + efficiencyBonus;
  return ageGroup90thPercentileProduction <= 0 ? 0 : Math.min(100, (raw / ageGroup90thPercentileProduction) * 90);
}

export function finalPerformanceScore(input: {
  productionScore: number;
  leagueTier: 1 | 2 | 3 | 4;
  opponentTeamRating?: number;
  teamAverageRating?: number;
  playerRating?: number;
  per: NullableNumber;
  winShares: NullableNumber;
  pie: NullableNumber;
  apmBox: NullableNumber;
}) {
  const leagueWeight = ({ 1: 1, 2: 1.1, 3: 1.25, 4: 1.4 } as const)[input.leagueTier];
  const opponentFactor = clamp(1 + (((input.opponentTeamRating ?? 50) - 50) / 400), 0.85, 1.15);
  const teamContextFactor =
    input.teamAverageRating === undefined || input.playerRating === undefined
      ? 1
      : clamp(1 - ((input.teamAverageRating - input.playerRating) / 500), 0.9, 1.1);
  const performanceScore = input.productionScore * leagueWeight * opponentFactor * teamContextFactor;
  const perBonus = input.per === null ? 0 : (input.per - 15) / 100;
  const wsBonus = input.winShares === null ? 0 : input.winShares * 0.5;
  const pieBonus = input.pie === null ? 0 : (input.pie - 0.1) * 20;
  const apmBonus = input.apmBox === null ? 0 : input.apmBox * 0.02;
  const advancedBonus = clamp(perBonus + wsBonus + pieBonus + apmBonus, -5, 10);
  return {
    leagueWeight,
    opponentFactor,
    teamContextFactor,
    performanceScore,
    advancedBonus,
    finalPerformanceScore: Math.min(100, performanceScore + advancedBonus)
  };
}

export function weeklyGameWeight(gameDate: Date, updateDate: Date) {
  const ageMs = updateDate.getTime() - gameDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ageMs <= 14 * dayMs) return 1;
  if (ageMs <= 31 * dayMs) return 0.8;
  return 0.6;
}

export function adjustedRating(gamesPlayed: number, observedRating: number, ageGroupMeanRating: number, gender: "Boys" | "Girls") {
  const priorGames = gender === "Girls" ? 5 : 10;
  return ((gamesPlayed * observedRating) + (priorGames * ageGroupMeanRating)) / (gamesPlayed + priorGames);
}

export type FormulaV2StatInput = {
  points: number;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
};

export type FormulaV2LeagueContext = {
  points: number;
  fieldGoalsAttempt: number;
  fieldGoalsMade: number;
  freeThrowsAttempt: number;
  freeThrowsMade: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  turnovers: number;
  fouls: number;
  possessions: number;
  leaguePPP: number;
  leagueDRBPct: number;
  leagueORBPct: number;
  leagueFTCostPerFoul: number;
};

function statNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function computeFormulaV2LeagueContext(stats: FormulaV2StatInput[]): FormulaV2LeagueContext {
  const totals = stats.reduce(
    (sum, stat) => {
      const fga = statNumber(stat.fieldGoalsAttempt);
      const fgm = statNumber(stat.fieldGoalsMade);
      const fta = statNumber(stat.freeThrowsAttempt);
      const ftm = statNumber(stat.freeThrowsMade);
      const oreb = statNumber(stat.offensiveRebounds);
      const dreb = statNumber(stat.defensiveRebounds);
      const rebounds = statNumber(stat.rebounds);
      const turnovers = statNumber(stat.turnovers);
      const fouls = statNumber(stat.fouls);

      return {
        points: sum.points + statNumber(stat.points),
        fieldGoalsAttempt: sum.fieldGoalsAttempt + fga,
        fieldGoalsMade: sum.fieldGoalsMade + fgm,
        freeThrowsAttempt: sum.freeThrowsAttempt + fta,
        freeThrowsMade: sum.freeThrowsMade + ftm,
        offensiveRebounds: sum.offensiveRebounds + oreb,
        defensiveRebounds: sum.defensiveRebounds + dreb,
        rebounds: sum.rebounds + rebounds,
        turnovers: sum.turnovers + turnovers,
        fouls: sum.fouls + fouls
      };
    },
    {
      points: 0,
      fieldGoalsAttempt: 0,
      fieldGoalsMade: 0,
      freeThrowsAttempt: 0,
      freeThrowsMade: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      rebounds: 0,
      turnovers: 0,
      fouls: 0
    }
  );

  const possessions = totals.fieldGoalsAttempt - totals.offensiveRebounds + totals.turnovers + 0.44 * totals.freeThrowsAttempt;
  const totalRebounds = totals.rebounds || totals.offensiveRebounds + totals.defensiveRebounds;
  const leaguePPP = safeDivide(totals.points, possessions, 0)!;
  const leagueDRBPct = safeDivide(totals.defensiveRebounds, totalRebounds, 0)!;
  const leagueORBPct = safeDivide(totals.offensiveRebounds, totalRebounds, 0)!;
  const leagueFTCostPerFoul = totals.fouls === 0 ? 0 : (totals.freeThrowsMade * leaguePPP) / totals.fouls;

  return {
    ...totals,
    possessions,
    leaguePPP,
    leagueDRBPct,
    leagueORBPct,
    leagueFTCostPerFoul
  };
}

export function computeFormulaV2RawGameValue(stat: FormulaV2StatInput, context: FormulaV2LeagueContext) {
  const fgm = statNumber(stat.fieldGoalsMade);
  const fga = statNumber(stat.fieldGoalsAttempt);
  const ftm = statNumber(stat.freeThrowsMade);
  const fta = statNumber(stat.freeThrowsAttempt);
  const missedFG = Math.max(0, fga - fgm);
  const missedFT = Math.max(0, fta - ftm);
  const foulsDrawnValue = stat.foulsDrawn === null || stat.foulsDrawn === undefined ? 0 : statNumber(stat.foulsDrawn) * context.leagueFTCostPerFoul;

  return (
    statNumber(stat.points) -
    missedFG * context.leaguePPP * context.leagueDRBPct -
    missedFT * 0.44 * context.leaguePPP +
    statNumber(stat.offensiveRebounds) * context.leaguePPP +
    statNumber(stat.defensiveRebounds) * context.leaguePPP * context.leagueORBPct +
    statNumber(stat.assists) * context.leaguePPP * 0.35 +
    statNumber(stat.steals) * context.leaguePPP +
    statNumber(stat.blocks) * context.leaguePPP * 0.65 -
    statNumber(stat.turnovers) * context.leaguePPP -
    statNumber(stat.fouls) * context.leagueFTCostPerFoul +
    foulsDrawnValue
  );
}

export function percentileScaleToRating(values: number[]) {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const percentileByValue = new Map<number, number>();

  for (let index = 0; index < sorted.length; index += 1) {
    const value = sorted[index];
    if (percentileByValue.has(value)) continue;

    let last = index;
    while (last + 1 < sorted.length && sorted[last + 1] === value) last += 1;

    const percentile = sorted.length === 1 ? 1 : ((index + last) / 2) / (sorted.length - 1);
    percentileByValue.set(value, percentile);
    index = last;
  }

  return values.map((value) => 1 + (percentileByValue.get(value) ?? 0) * 99);
}
