import type { AgeGroup } from "@prisma/client";
import type {
  PlayerProfileAverages,
  PlayerProfileBestGame,
  PlayerProfileGame,
  PlayerProfileHigh,
  PlayerProfileIntelligence,
  PlayerProfileLeague,
  PlayerProfileRankingTrend,
  PlayerProfileRecentForm,
  PlayerProfileShooting,
} from "./player-profile-types";
import { getMonthStart } from "./ranking-eligibility";

type LoadedGameStat = {
  gameId: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  plusMinus: number | null;
  minutes: { toNumber(): number } | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempt: number | null;
  twoMade: number | null;
  twoAttempt: number | null;
  threeMade: number | null;
  threeAttempt: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempt: number | null;
  game: {
    gameNumber: string | null;
    gameDate: Date;
    homeTeamId: string;
    homeScore: number;
    awayScore: number;
    homeTeam: { name: string };
    awayTeam: { name: string };
    season: {
      name: string;
      league: { name: string; tier: number };
    };
  };
  teamId: string;
  performanceScores: Array<{ finalPerformanceScore: unknown; performanceScore: unknown }>;
};

type LoadedRankingRow = {
  rank: number;
  rating: { toString(): string };
  movement: number;
  ageVerificationStatus: string | null;
  snapshot: {
    weekOf: Date;
    ageGroup: AgeGroup | null;
    gender: string;
    city: string | null;
    region: string | null;
  };
};

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function pct(made: number | null, attempt: number | null) {
  if (!attempt) return null;
  return roundOne(((made ?? 0) / attempt) * 100);
}

function trueShootingPct(points: number, fga: number | null, fta: number | null) {
  const denominator = (fga ?? 0) + 0.44 * (fta ?? 0);
  if (!denominator) return null;
  return roundOne((points / (2 * denominator)) * 100);
}

function effectiveFieldGoalPct(fgm: number | null, threePm: number | null, fga: number | null) {
  if (!fga) return null;
  return roundOne((((fgm ?? 0) + 0.5 * (threePm ?? 0)) / fga) * 100);
}

function assistTurnoverRatio(assists: number, turnovers: number | null) {
  if (!turnovers) return null;
  return roundOne(assists / turnovers);
}

export function boxEfficiencyFromStat(stat: Pick<LoadedGameStat, "points" | "rebounds" | "assists" | "steals" | "blocks" | "turnovers">) {
  return stat.points + stat.rebounds + stat.assists + (stat.steals ?? 0) + (stat.blocks ?? 0) - (stat.turnovers ?? 0);
}

export function mapFullGameStat(
  stat: LoadedGameStat,
  opponentName: string,
  teamScore: number,
  opponentScore: number,
  teamName: string
): PlayerProfileGame {
  const scoreRow = stat.performanceScores[0];
  const finalPerformanceScore = scoreRow?.finalPerformanceScore ?? scoreRow?.performanceScore ?? null;

  return {
    gameId: stat.gameId,
    gameDate: stat.game.gameDate.toISOString(),
    gameNumber: stat.game.gameNumber,
    leagueName: stat.game.season.league.name,
    seasonName: stat.game.season.name,
    teamName,
    opponentName,
    result: teamScore > opponentScore ? "W" : "L",
    teamScore,
    opponentScore,
    minutes: stat.minutes ? roundOne(stat.minutes.toNumber()) : null,
    points: stat.points,
    rebounds: stat.rebounds,
    offensiveRebounds: stat.offensiveRebounds,
    defensiveRebounds: stat.defensiveRebounds,
    assists: stat.assists,
    steals: stat.steals,
    blocks: stat.blocks,
    turnovers: stat.turnovers,
    fouls: stat.fouls,
    plusMinus: stat.plusMinus,
    fieldGoalsMade: stat.fieldGoalsMade,
    fieldGoalsAttempt: stat.fieldGoalsAttempt,
    twoMade: stat.twoMade,
    twoAttempt: stat.twoAttempt,
    threeMade: stat.threeMade,
    threeAttempt: stat.threeAttempt,
    freeThrowsMade: stat.freeThrowsMade,
    freeThrowsAttempt: stat.freeThrowsAttempt,
    fieldGoalPct: pct(stat.fieldGoalsMade, stat.fieldGoalsAttempt),
    twoPointPct: pct(stat.twoMade, stat.twoAttempt),
    threePointPct: pct(stat.threeMade, stat.threeAttempt),
    freeThrowPct: pct(stat.freeThrowsMade, stat.freeThrowsAttempt),
    effectiveFieldGoalPct: effectiveFieldGoalPct(stat.fieldGoalsMade, stat.threeMade, stat.fieldGoalsAttempt),
    trueShootingPct: trueShootingPct(stat.points, stat.fieldGoalsAttempt, stat.freeThrowsAttempt),
    assistTurnoverRatio: assistTurnoverRatio(stat.assists, stat.turnovers),
    boxEfficiency: boxEfficiencyFromStat(stat),
    finalPerformanceScore: finalPerformanceScore === null ? null : Number(finalPerformanceScore),
  };
}

export function buildProfileAverages(games: PlayerProfileGame[]): PlayerProfileAverages {
  const count = games.length;
  if (!count) {
    return {
      gamesPlayed: 0,
      minutes: null,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      plusMinus: null,
    };
  }

  const minutesValues = games.map((game) => game.minutes).filter((value): value is number => value !== null);
  const plusMinusValues = games.map((game) => game.plusMinus).filter((value): value is number => value !== null);

  return {
    gamesPlayed: count,
    minutes: minutesValues.length ? roundOne(minutesValues.reduce((sum, value) => sum + value, 0) / minutesValues.length) : null,
    points: roundOne(games.reduce((sum, game) => sum + game.points, 0) / count),
    rebounds: roundOne(games.reduce((sum, game) => sum + game.rebounds, 0) / count),
    assists: roundOne(games.reduce((sum, game) => sum + game.assists, 0) / count),
    steals: roundOne(games.reduce((sum, game) => sum + (game.steals ?? 0), 0) / count),
    blocks: roundOne(games.reduce((sum, game) => sum + (game.blocks ?? 0), 0) / count),
    turnovers: roundOne(games.reduce((sum, game) => sum + (game.turnovers ?? 0), 0) / count),
    fouls: roundOne(games.reduce((sum, game) => sum + (game.fouls ?? 0), 0) / count),
    plusMinus: plusMinusValues.length
      ? roundOne(plusMinusValues.reduce((sum, value) => sum + value, 0) / plusMinusValues.length)
      : null,
  };
}

export function buildProfileShooting(games: PlayerProfileGame[]): PlayerProfileShooting {
  const totals = games.reduce(
    (sum, game) => ({
      fgm: sum.fgm + (game.fieldGoalsMade ?? 0),
      fga: sum.fga + (game.fieldGoalsAttempt ?? 0),
      twoMade: sum.twoMade + (game.twoMade ?? 0),
      twoAttempt: sum.twoAttempt + (game.twoAttempt ?? 0),
      threeMade: sum.threeMade + (game.threeMade ?? 0),
      threeAttempt: sum.threeAttempt + (game.threeAttempt ?? 0),
      ftm: sum.ftm + (game.freeThrowsMade ?? 0),
      fta: sum.fta + (game.freeThrowsAttempt ?? 0),
      points: sum.points + game.points,
    }),
    { fgm: 0, fga: 0, twoMade: 0, twoAttempt: 0, threeMade: 0, threeAttempt: 0, ftm: 0, fta: 0, points: 0 }
  );

  return {
    fieldGoalPct: pct(totals.fgm, totals.fga),
    twoPointPct: pct(totals.twoMade, totals.twoAttempt),
    threePointPct: pct(totals.threeMade, totals.threeAttempt),
    freeThrowPct: pct(totals.ftm, totals.fta),
    effectiveFieldGoalPct: effectiveFieldGoalPct(totals.fgm, totals.threeMade, totals.fga),
    trueShootingPct: trueShootingPct(totals.points, totals.fga, totals.fta),
  };
}

export function buildGameHighs(games: PlayerProfileGame[]): PlayerProfileHigh[] {
  const metrics: Array<{ label: string; value: (game: PlayerProfileGame) => number }> = [
    { label: "Points", value: (game) => game.points },
    { label: "Rebounds", value: (game) => game.rebounds },
    { label: "Assists", value: (game) => game.assists },
    { label: "Steals", value: (game) => game.steals ?? 0 },
    { label: "Blocks", value: (game) => game.blocks ?? 0 },
  ];

  return metrics.map(({ label, value }) => {
    const best = games.reduce<PlayerProfileGame | null>((current, game) => {
      if (!current) return game;
      return value(game) > value(current) ? game : current;
    }, null);

    return {
      label,
      value: best ? value(best) : 0,
      gameNumber: best?.gameNumber ?? null,
      opponentName: best?.opponentName ?? "—",
      gameDate: best?.gameDate ?? "",
    };
  });
}

export function buildBestGame(games: PlayerProfileGame[]): PlayerProfileBestGame | null {
  if (!games.length) return null;
  const best = games.reduce((current, game) => (game.boxEfficiency > current.boxEfficiency ? game : current), games[0]);
  return { game: best, selectionMetric: "Box Impact" };
}

export function buildLeagueHistoryFromStats(
  stats: LoadedGameStat[],
  tierLabel: (tier: number) => PlayerProfileLeague["tierLabel"]
): PlayerProfileLeague[] {
  const grouped = new Map<
    string,
    {
      leagueName: string;
      seasonName: string;
      tier: number;
      points: number;
      assists: number;
      rebounds: number;
      boxEfficiency: number;
      games: number;
    }
  >();

  for (const stat of stats) {
    const league = stat.game.season.league;
    const key = `${league.name}:${stat.game.season.name}`;
    const existing = grouped.get(key) ?? {
      leagueName: league.name,
      seasonName: stat.game.season.name,
      tier: league.tier,
      points: 0,
      assists: 0,
      rebounds: 0,
      boxEfficiency: 0,
      games: 0,
    };

    existing.points += stat.points;
    existing.assists += stat.assists;
    existing.rebounds += stat.rebounds;
    existing.boxEfficiency += boxEfficiencyFromStat(stat);
    existing.games += 1;
    grouped.set(key, existing);
  }

  return [...grouped.values()].map((item) => ({
    leagueName: item.leagueName,
    seasonName: item.seasonName,
    tier: item.tier,
    tierLabel: tierLabel(item.tier),
    gamesPlayed: item.games,
    avgPoints: item.games ? roundOne(item.points / item.games) : 0,
    avgAssists: item.games ? roundOne(item.assists / item.games) : 0,
    avgRebounds: item.games ? roundOne(item.rebounds / item.games) : 0,
    avgBoxEfficiency: item.games ? roundOne(item.boxEfficiency / item.games) : 0,
    productionMarker: "Verified",
  }));
}

export function buildRankingTrend(rows: LoadedRankingRow[], ageGroup: AgeGroup, gender: string): PlayerProfileRankingTrend {
  const matching = rows
    .filter(
      (row) =>
        row.snapshot.ageGroup === ageGroup &&
        row.snapshot.gender === gender &&
        row.snapshot.city === null &&
        row.snapshot.region === null
    )
    .sort((left, right) => left.snapshot.weekOf.getTime() - right.snapshot.weekOf.getTime());

  const seen = new Set<number>();
  const unique: LoadedRankingRow[] = [];
  for (const row of matching) {
    const key = getMonthStart(row.snapshot.weekOf).getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique.map((row) => ({
    weekOf: row.snapshot.weekOf.toISOString(),
    rank: row.rank,
    movement: row.movement,
    rating: Number(row.rating),
    ageVerificationStatus:
      row.ageVerificationStatus === "VERIFIED" || row.ageVerificationStatus === "PENDING"
        ? row.ageVerificationStatus
        : null,
  }));
}

export function buildRecentForm(games: PlayerProfileGame[], averages: PlayerProfileAverages): PlayerProfileRecentForm {
  const recentGames = games.slice(0, 5);
  const recentAverages = recentGames.length
    ? buildProfileAverages(recentGames)
    : null;
  const recentBoxEfficiency = recentGames.length
    ? roundOne(recentGames.reduce((sum, game) => sum + game.boxEfficiency, 0) / recentGames.length)
    : null;
  const fullBoxEfficiency = games.length
    ? roundOne(games.reduce((sum, game) => sum + game.boxEfficiency, 0) / games.length)
    : null;

  return {
    label: recentGames.length < 3 ? "Limited Sample" : "Steady",
    explanation:
      recentGames.length < 3
        ? "Not enough recent verified games to label a form trend."
        : "Recent production is compared against the player's full verified sample.",
    gamesEvaluated: recentGames.length,
    recentAverages,
    recentBoxEfficiency,
    fullBoxEfficiency,
    pointsDelta: recentAverages ? roundOne(recentAverages.points - averages.points) : null,
    reboundsDelta: recentAverages ? roundOne(recentAverages.rebounds - averages.rebounds) : null,
    assistsDelta: recentAverages ? roundOne(recentAverages.assists - averages.assists) : null,
    boxEfficiencyDelta:
      recentBoxEfficiency !== null && fullBoxEfficiency !== null
        ? roundOne(recentBoxEfficiency - fullBoxEfficiency)
        : null,
  };
}

export function buildDefaultIntelligence(gamesPlayed: number): PlayerProfileIntelligence {
  const limitedSample = gamesPlayed < 3;
  const percentileKeys = [
    { key: "scoring" as const, label: "Scoring" },
    { key: "efficiency" as const, label: "Efficiency" },
    { key: "rebounding" as const, label: "Rebounding" },
    { key: "playmaking" as const, label: "Playmaking" },
    { key: "defense" as const, label: "Defense" },
    { key: "accuracy" as const, label: "Accuracy" },
    { key: "sample" as const, label: "Sample" },
  ];

  return {
    roleArchetype: {
      label: limitedSample ? "Limited Sample" : "Developing Contributor",
      explanation: limitedSample
        ? "More verified games are needed before a stable role read is available."
        : "Role classification will sharpen as more board comparison data is available.",
    },
    percentiles: percentileKeys.map((item) => ({
      key: item.key,
      label: item.label,
      percentile: null,
      value: 0,
      comparisonCount: 0,
    })),
    skillRatings: [],
    strengthBadges: [],
    limitedSample,
    comparisonCount: 0,
    benchmarks: {
      leagueName: null,
      comparisonCount: 0,
      qualifyingMinutes: 0,
      stats: {
        points: { ageGroupAverage: null, leagueAverage: null },
        rebounds: { ageGroupAverage: null, leagueAverage: null },
        assists: { ageGroupAverage: null, leagueAverage: null },
        trueShootingPct: { ageGroupAverage: null, leagueAverage: null },
      },
      leaguePeriodAverages: {
        week: {
          points: [],
          rebounds: [],
          assists: [],
          trueShootingPct: [],
        },
        month: {
          points: [],
          rebounds: [],
          assists: [],
          trueShootingPct: [],
        },
      },
    },
    trendAverages: {
      ageGroup: {},
      primaryLeague: {},
      primaryLeagueName: null,
    },
  };
}
