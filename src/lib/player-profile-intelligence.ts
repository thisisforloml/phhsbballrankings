import "server-only";

import { AgeGroup } from "@prisma/client";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import { boxEfficiencyFromStat } from "@/lib/player-profile-build";
import type {
  PlayerProfileAverages,
  PlayerProfileGame,
  PlayerProfileIntelligence,
  PlayerProfileLeague,
  PlayerProfileShooting,
} from "@/lib/player-profile-types";
import { prisma } from "./prisma";

type LoadedGameStat = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  minutes: { toNumber(): number } | null;
  fieldGoalsAttempt: number | null;
  freeThrowsAttempt: number | null;
  game: {
    seasonId: string;
    season: { id: string; name: string; league: { name: string; tier: number } };
  };
};

type PeerProduction = {
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tov: number;
  mpg: number | null;
  boxEfficiency: number;
  trueShootingPct: number | null;
};

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function mean(values: number[]) {
  if (!values.length) return null;
  return roundOne(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentileRank(value: number, peers: number[]) {
  if (!peers.length) return null;
  const sorted = [...peers].sort((left, right) => left - right);
  let below = 0;
  let equal = 0;
  for (const peer of sorted) {
    if (peer < value) below += 1;
    else if (peer === value) equal += 1;
  }
  const raw = Math.round(((below + equal / 2) / sorted.length) * 100);
  // Public board display uses 1–99; nobody is shown as the 100th percentile.
  return Math.min(99, Math.max(1, raw));
}

function pickRoleArchetype(percentiles: PlayerProfileIntelligence["percentiles"]): PlayerProfileIntelligence["roleArchetype"] {
  const byKey = Object.fromEntries(percentiles.map((item) => [item.key, item.percentile ?? 0]));
  const sample = byKey.sample ?? 0;
  if (sample < 40) {
    return {
      label: "Limited Sample",
      explanation: "More verified games are needed before a stable role read is available.",
    };
  }
  const scoring = byKey.scoring ?? 0;
  const playmaking = byKey.playmaking ?? 0;
  const rebounding = byKey.rebounding ?? 0;
  const defense = byKey.defense ?? 0;
  const efficiency = byKey.efficiency ?? 0;

  if (scoring >= 75 && efficiency >= 60) return { label: "Primary Scorer", explanation: "High scoring output relative to age-group peers." };
  if (efficiency >= 75 && scoring >= 60) return { label: "Efficient Finisher", explanation: "Strong efficiency with meaningful scoring volume." };
  if (playmaking >= 75) return { label: "Playmaker", explanation: "Assist production stands out against the age-group pool." };
  if (rebounding >= 75) return { label: "Glass Cleaner", explanation: "Rebounding impact is a clear separator on the board." };
  if (defense >= 75) return { label: "Defensive Disruptor", explanation: "Steals and blocks profile above peer norms." };
  return { label: "All-Around Contributor", explanation: "Balanced production without one dominant separator." };
}

function buildStrengthBadges(percentiles: PlayerProfileIntelligence["percentiles"]) {
  return percentiles
    .filter((item) => item.key !== "sample" && item.percentile !== null && item.percentile >= 75)
    .sort((left, right) => (right.percentile ?? 0) - (left.percentile ?? 0))
    .slice(0, 3)
    .map((item) => ({
      label:
        item.key === "scoring"
          ? "Scorer"
          : item.key === "efficiency"
            ? "Efficient producer"
            : item.key === "rebounding"
              ? "Rebounder"
              : item.key === "playmaking"
                ? "Playmaker"
                : item.key === "defense"
                  ? "Defensive events"
                  : "Shooter",
      reason: `${item.label} ranks in the ${item.percentile}th percentile on the ${item.comparisonCount}-player board sample.`,
    }));
}

async function loadPeerProduction(ageGroup: AgeGroup, gender: "BOYS" | "GIRLS"): Promise<PeerProduction[]> {
  const policyVersionId = getActivePolicyVersionId();
  const ratings = await prisma.playerRating.findMany({
    where: {
      policyVersionId,
      ageGroup,
      player: {
        deletedAt: null,
        gender,
      },
    },
    select: {
      player: {
        select: {
          gameStats: {
            where: {
              deletedAt: null,
              performanceScores: {
                some: {
                  deletedAt: null,
                  formulaVersion: { versionNumber: 1 },
                },
              },
            },
            select: {
              points: true,
              rebounds: true,
              assists: true,
              steals: true,
              blocks: true,
              turnovers: true,
              minutes: true,
              fieldGoalsAttempt: true,
              freeThrowsAttempt: true,
            },
          },
        },
      },
    },
  });

  return ratings
    .map((rating) => {
      const stats = rating.player.gameStats;
      if (stats.length < 3) return null;
      const games = stats.length;
      const minutes = stats
        .map((stat) => (stat.minutes ? stat.minutes.toNumber() : null))
        .filter((value): value is number => value !== null);
      const tsValues = stats
        .map((stat) => {
          const fga = stat.fieldGoalsAttempt ?? 0;
          const fta = stat.freeThrowsAttempt ?? 0;
          if (!fga && !fta) return null;
          const denominator = 2 * (fga + 0.44 * fta);
          return denominator > 0 ? (stat.points / denominator) * 100 : null;
        })
        .filter((value): value is number => value !== null);

      return {
        games,
        ppg: stats.reduce((sum, stat) => sum + stat.points, 0) / games,
        rpg: stats.reduce((sum, stat) => sum + stat.rebounds, 0) / games,
        apg: stats.reduce((sum, stat) => sum + stat.assists, 0) / games,
        spg: stats.reduce((sum, stat) => sum + (stat.steals ?? 0), 0) / games,
        bpg: stats.reduce((sum, stat) => sum + (stat.blocks ?? 0), 0) / games,
        tov: stats.reduce((sum, stat) => sum + (stat.turnovers ?? 0), 0) / games,
        mpg: minutes.length ? minutes.reduce((sum, value) => sum + value, 0) / minutes.length : null,
        boxEfficiency: stats.reduce((sum, stat) => sum + boxEfficiencyFromStat(stat), 0) / games,
        trueShootingPct: tsValues.length ? tsValues.reduce((sum, value) => sum + value, 0) / tsValues.length : null,
      };
    })
    .filter((item): item is PeerProduction => item !== null);
}

function resolvePrimarySeasonId(gameStats: LoadedGameStat[], leagues: PlayerProfileLeague[]) {
  const primary = [...leagues].sort((left, right) => right.gamesPlayed - left.gamesPlayed || right.tier - left.tier)[0];
  if (!primary) return { seasonId: null, leagueName: null };

  const match = gameStats.find(
    (stat) => stat.game.season.league.name === primary.leagueName && stat.game.season.name === primary.seasonName
  );
  return {
    seasonId: match?.game.seasonId ?? null,
    leagueName: `${primary.leagueName} · ${primary.seasonName}`,
  };
}

async function loadLeaguePerGameAverages(seasonId: string | null) {
  const empty = {
    points: null,
    rebounds: null,
    assists: null,
    trueShootingPct: null,
    minutes: null,
    steals: null,
    blocks: null,
    turnovers: null,
    plusMinus: null,
    fieldGoalPct: null,
    threePointPct: null,
    freeThrowPct: null,
    effectiveFieldGoalPct: null,
    assistTurnoverRatio: null,
    finalPerformanceScore: null,
  };

  if (!seasonId) return empty;

  const [leagueSeasonAverage, seasonStatCount] = await Promise.all([
    prisma.leagueSeasonAverage.findUnique({ where: { seasonId } }),
    prisma.gameStat.count({
      where: {
        deletedAt: null,
        game: { seasonId, deletedAt: null },
      },
    }),
  ]);

  if (!leagueSeasonAverage || seasonStatCount <= 0) return empty;

  const perGame = (total: unknown) => {
    const value = Number(total);
    if (!Number.isFinite(value)) return null;
    return roundOne(value / seasonStatCount);
  };

  const trueShooting = leagueSeasonAverage.trueShootingPct ? Number(leagueSeasonAverage.trueShootingPct) : null;

  return {
    ...empty,
    points: perGame(leagueSeasonAverage.points),
    rebounds: perGame(leagueSeasonAverage.rebounds),
    assists: perGame(leagueSeasonAverage.assists),
    steals: perGame(leagueSeasonAverage.steals),
    blocks: perGame(leagueSeasonAverage.blocks),
    turnovers: perGame(leagueSeasonAverage.turnovers),
    trueShootingPct: trueShooting !== null ? roundOne(trueShooting * 100) : null,
  };
}

export async function buildProfileIntelligence(params: {
  ageGroup: AgeGroup;
  gender: "BOYS" | "GIRLS";
  games: PlayerProfileGame[];
  leagues: PlayerProfileLeague[];
  averages: PlayerProfileAverages;
  shooting: PlayerProfileShooting;
  gameStats: LoadedGameStat[];
}): Promise<PlayerProfileIntelligence> {
  const { ageGroup, gender, games, leagues, averages, shooting, gameStats } = params;
  const gamesPlayed = games.length;
  const limitedSample = gamesPlayed < 3;
  const peers = gamesPlayed ? await loadPeerProduction(ageGroup, gender) : [];
  const comparisonCount = peers.length;

  const playerDefense = averages.steals + averages.blocks;
  const peerDefense = peers.map((peer) => peer.spg + peer.bpg);
  const peerScoring = peers.map((peer) => peer.ppg);
  const peerRebounding = peers.map((peer) => peer.rpg);
  const peerPlaymaking = peers.map((peer) => peer.apg);
  const peerEfficiency = peers.map((peer) => peer.boxEfficiency);
  const peerAccuracy = peers.filter((peer) => peer.trueShootingPct !== null).map((peer) => peer.trueShootingPct!);
  const peerSample = peers.map((peer) => peer.games);
  const peerMinutes = peers.map((peer) => peer.mpg).filter((value): value is number => value !== null);
  const peerTurnovers = peers.map((peer) => peer.tov);

  const percentiles: PlayerProfileIntelligence["percentiles"] = [
    {
      key: "scoring",
      label: "Scoring",
      percentile: comparisonCount ? percentileRank(averages.points, peerScoring) : null,
      value: averages.points,
      comparisonCount,
    },
    {
      key: "efficiency",
      label: "Efficiency",
      percentile: comparisonCount
        ? percentileRank(games.reduce((sum, game) => sum + game.boxEfficiency, 0) / games.length, peerEfficiency)
        : null,
      value: games.length ? roundOne(games.reduce((sum, game) => sum + game.boxEfficiency, 0) / games.length) : 0,
      comparisonCount,
    },
    {
      key: "rebounding",
      label: "Rebounding",
      percentile: comparisonCount ? percentileRank(averages.rebounds, peerRebounding) : null,
      value: averages.rebounds,
      comparisonCount,
    },
    {
      key: "playmaking",
      label: "Playmaking",
      percentile: comparisonCount ? percentileRank(averages.assists, peerPlaymaking) : null,
      value: averages.assists,
      comparisonCount,
    },
    {
      key: "defense",
      label: "Defense",
      percentile: comparisonCount ? percentileRank(playerDefense, peerDefense) : null,
      value: roundOne(playerDefense),
      comparisonCount,
    },
    {
      key: "accuracy",
      label: "Accuracy",
      percentile:
        comparisonCount && shooting.trueShootingPct !== null
          ? percentileRank(shooting.trueShootingPct, peerAccuracy)
          : null,
      value: shooting.trueShootingPct ?? 0,
      comparisonCount,
    },
    {
      key: "sample",
      label: "Sample",
      percentile: comparisonCount ? percentileRank(gamesPlayed, peerSample) : null,
      value: gamesPlayed,
      comparisonCount,
    },
  ];

  const ageGroupAverages = {
    points: mean(peerScoring),
    rebounds: mean(peerRebounding),
    assists: mean(peerPlaymaking),
    trueShootingPct: mean(peerAccuracy),
    minutes: mean(peerMinutes),
    steals: mean(peers.map((peer) => peer.spg)),
    blocks: mean(peers.map((peer) => peer.bpg)),
    turnovers: mean(peerTurnovers),
    plusMinus: null,
    fieldGoalPct: null,
    threePointPct: null,
    freeThrowPct: null,
    effectiveFieldGoalPct: null,
    assistTurnoverRatio: null,
    finalPerformanceScore: null,
  };

  const { seasonId, leagueName } = resolvePrimarySeasonId(gameStats, leagues);
  const leagueAverages = await loadLeaguePerGameAverages(seasonId);

  const roleArchetype = limitedSample
    ? {
        label: "Limited Sample" as const,
        explanation: "More verified games are needed before a stable role read is available.",
      }
    : pickRoleArchetype(percentiles);

  return {
    roleArchetype,
    percentiles,
    skillRatings: [],
    strengthBadges: buildStrengthBadges(percentiles),
    limitedSample,
    comparisonCount,
    benchmarks: {
      leagueName,
      comparisonCount,
      qualifyingMinutes: 10,
      stats: {
        points: { ageGroupAverage: ageGroupAverages.points, leagueAverage: leagueAverages.points },
        rebounds: { ageGroupAverage: ageGroupAverages.rebounds, leagueAverage: leagueAverages.rebounds },
        assists: { ageGroupAverage: ageGroupAverages.assists, leagueAverage: leagueAverages.assists },
        trueShootingPct: { ageGroupAverage: ageGroupAverages.trueShootingPct, leagueAverage: leagueAverages.trueShootingPct },
      },
      leaguePeriodAverages: {
        week: { points: [], rebounds: [], assists: [], trueShootingPct: [] },
        month: { points: [], rebounds: [], assists: [], trueShootingPct: [] },
      },
    },
    trendAverages: {
      ageGroup: ageGroupAverages,
      primaryLeague: leagueAverages,
      primaryLeagueName: leagueName,
    },
  };
}
