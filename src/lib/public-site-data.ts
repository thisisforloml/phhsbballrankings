import "server-only";

import { AgeGroup, PlayerGender } from "@prisma/client";
import { formatHeight, slugify } from "./format";
import { getLatestNationalRankings, type NationalRankingRow, type RankingGender } from "./rankings";
import { prisma } from "./prisma";

export type PublicAgeGroup = "U13" | "U16" | "U19";
export type PublicGender = "Boys" | "Girls";

export type HomeLeaderboardRow = NationalRankingRow & {
  age: number | null;
  birthYear: number | null;
};

export type HomeData = {
  counts: {
    rankedPlayers: number;
    verifiedLeagues: number;
    gamesLogged: number;
  };
  leader: HomeLeaderboardRow | null;
  leaderboards: {
    boys: HomeLeaderboardRow[];
    girls: HomeLeaderboardRow[];
  };
};

export type PublicLeagueRow = {
  id: string;
  name: string;
  ageGroup: PublicAgeGroup;
  gender: PublicGender | "Mixed";
  organizerName: string;
  city: string;
  region: string;
  tier: number;
  qualityScore: number;
  teamCount: number;
  gameCount: number;
  gamesPerTeam: number;
  isVerified: boolean;
};

export type PublicTeamRankingRow = {
  id: string;
  name: string;
  schoolClub: string;
  city: string;
  region: string;
  gender: PublicGender;
  ageGroup: PublicAgeGroup;
  rating: number;
  wins: number;
  losses: number;
  ppg: number;
  topPlayer: {
    id: string;
    slug: string;
    displayName: string;
    rating: number;
  } | null;
  league: string;
};

function inferGenderFromLeagueName(name: string): PublicGender | "Mixed" {
  const lower = name.toLowerCase();
  if (lower.includes("girls")) return "Girls";
  if (lower.includes("boys")) return "Boys";
  return "Mixed";
}

function toPublicGender(gender: PlayerGender): PublicGender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

async function addAge(rows: NationalRankingRow[]): Promise<HomeLeaderboardRow[]> {
  if (!rows.length) return [];
  const players = await prisma.player.findMany({
    where: { id: { in: rows.map((row) => row.playerId) } },
    select: { id: true, birthDate: true }
  });
  const birthDates = new Map(players.map((player) => [player.id, player.birthDate]));

  return rows.map((row) => {
    const birthDate = birthDates.get(row.playerId) ?? null;
    return {
      ...row,
      age: calculateAge(birthDate),
      birthYear: birthDate ? birthDate.getUTCFullYear() : null
    };
  });
}

export async function getHomeData(): Promise<HomeData> {
  const rankings = await getLatestNationalRankings();
  const [boysRows, girlsRows, playerRatingCount, leagueCount, gameCount] = await Promise.all([
    addAge(rankings.snapshots.boys.rows.slice(0, 10)),
    addAge(rankings.snapshots.girls.rows.slice(0, 10)),
    prisma.playerRating.count({ where: { ageGroup: AgeGroup.U19 } }),
    prisma.league.count({ where: { deletedAt: null } }),
    prisma.game.count({ where: { deletedAt: null } })
  ]);
  const allTopRows = [...boysRows, ...girlsRows].sort((left, right) => right.rating - left.rating);

  return {
    counts: {
      rankedPlayers: playerRatingCount,
      verifiedLeagues: leagueCount,
      gamesLogged: gameCount
    },
    leader: allTopRows[0] ?? null,
    leaderboards: {
      boys: boysRows,
      girls: girlsRows
    }
  };
}

export async function getPublicLeagues(): Promise<PublicLeagueRow[]> {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            select: { id: true, homeTeamId: true, awayTeamId: true }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return leagues.map((league) => {
    const games = league.seasons.flatMap((season) => season.games);
    const teamIds = new Set<string>();
    games.forEach((game) => {
      teamIds.add(game.homeTeamId);
      teamIds.add(game.awayTeamId);
    });
    const teamCount = teamIds.size;

    return {
      id: league.id,
      name: league.name,
      ageGroup: league.ageGroup,
      gender: inferGenderFromLeagueName(league.name),
      organizerName: league.organizerName,
      city: league.city ?? "Not listed",
      region: league.region ?? "Not listed",
      tier: league.tier,
      qualityScore: Number(league.qualityScore),
      teamCount,
      gameCount: games.length,
      gamesPerTeam: teamCount ? Number((games.length / teamCount).toFixed(1)) : 0,
      isVerified: true
    };
  });
}

export async function getPublicTeamRankings(): Promise<PublicTeamRankingRow[]> {
  const games = await prisma.game.findMany({
    where: { deletedAt: null },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: {
        include: {
          player: {
            include: {
              currentRatings: {
                where: { ageGroup: AgeGroup.U19 },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  const teams = new Map<string, {
    id: string;
    name: string;
    city: string;
    region: string;
    gender: PublicGender;
    ageGroup: PublicAgeGroup;
    league: string;
    wins: number;
    losses: number;
    points: number;
    games: number;
    topPlayer: PublicTeamRankingRow["topPlayer"];
  }>();

  function ensure(team: typeof games[number]["homeTeam"], game: typeof games[number]) {
    const existing = teams.get(team.id);
    if (existing) return existing;
    const next = {
      id: team.id,
      name: team.name,
      city: team.city ?? "Not listed",
      region: team.region ?? "Not listed",
      gender: inferGenderFromLeagueName(game.season.league.name) === "Girls" ? "Girls" as PublicGender : "Boys" as PublicGender,
      ageGroup: game.season.league.ageGroup as PublicAgeGroup,
      league: game.season.league.name,
      wins: 0,
      losses: 0,
      points: 0,
      games: 0,
      topPlayer: null
    };
    teams.set(team.id, next);
    return next;
  }

  for (const game of games) {
    const home = ensure(game.homeTeam, game);
    const away = ensure(game.awayTeam, game);
    home.games += 1;
    away.games += 1;
    home.points += game.homeScore;
    away.points += game.awayScore;
    if (game.homeScore > game.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }

    for (const stat of game.stats) {
      const bucket = teams.get(stat.teamId);
      const rating = stat.player.currentRatings[0] ? Number(stat.player.currentRatings[0].adjustedRating) : 0;
      if (bucket && rating > (bucket.topPlayer?.rating ?? 0)) {
        bucket.topPlayer = {
          id: stat.player.id,
          slug: slugify(stat.player.displayName),
          displayName: stat.player.displayName,
          rating
        };
      }
    }
  }

  return [...teams.values()].map((team) => {
    const winPct = team.games ? team.wins / team.games : 0;
    const rating = Number((winPct * 100).toFixed(2));
    return {
      id: team.id,
      name: team.name,
      schoolClub: team.name,
      city: team.city ?? "Not listed",
      region: team.region ?? "Not listed",
      gender: team.gender,
      ageGroup: team.ageGroup,
      rating,
      wins: team.wins,
      losses: team.losses,
      ppg: team.games ? Number((team.points / team.games).toFixed(1)) : 0,
      topPlayer: team.topPlayer,
      league: team.league
    };
  }).sort((left, right) => right.rating - left.rating || right.wins - left.wins || left.name.localeCompare(right.name));
}
