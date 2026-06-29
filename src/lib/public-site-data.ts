import "server-only";

import { AgeGroup, PlayerGender, VerificationStatus, RankingScope } from "@prisma/client";
import { slugify } from "./format";
import { getLatestNationalRankings, type NationalRankingRow } from "./rankings";
import { prisma } from "./prisma";
import { getUaapSchoolDisplayName } from "./uaap-school-display";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";
import { getOfficialTeamCompetitionCounts } from "./team-rankings";
import { loadValidatedUaapGames } from "./validated-uaap-data";
import type { PublicTrustMeta } from "./public-rankings-coverage";

export type { PublicTrustMeta };

export type PublicAgeGroup = "U13" | "U16" | "U19";
export type PublicGender = "Boys" | "Girls";

export type HomeLeaderboardRow = NationalRankingRow & {
  age: number | null;
  birthYear: number | null;
};

export type HomeRecentGame = {
  id: string;
  gameDate: string;
  leagueName: string;
  seasonName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
};

export type HomeRankMover = {
  playerId: string;
  slug: string;
  displayName: string;
  previousRank: number | null;
  currentRank: number;
  delta: number;
  rating: number;
};

export type HomeData = {
  counts: {
    rankedPlayers: number;
    verifiedLeagues: number;
    gamesLogged: number;
  };
  leader: HomeLeaderboardRow | null;
  boardLeaders: HomeLeaderboardRow[];
  leaderboards: {
    boys: HomeLeaderboardRow[];
    girls: HomeLeaderboardRow[];
  };
  leaderboardsByAge: Record<PublicAgeGroup, { boys: HomeLeaderboardRow[]; girls: HomeLeaderboardRow[] }>;
  teamPreview: Array<{
    teamId: string;
    displayName: string;
    leagueName: string;
    ageGroup: PublicAgeGroup;
    gender: PublicGender;
    wins: number;
    losses: number;
    pointDifferential: number;
  }>;
  recentGames: HomeRecentGame[];
  boardMovers: HomeRankMover[];
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

export type PublicGameRow = {
  id: string;
  gameNumber: string;
  gameDate: string;
  verificationStatus: VerificationStatus;
  leagueId: string;
  leagueName: string;
  seasonName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
};

export type PublicGamesIndex = {
  leagues: Array<{ id: string; name: string }>;
  games: PublicGameRow[];
};

function inferGenderFromLeagueName(name: string): PublicGender | "Mixed" {
  const lower = name.toLowerCase();
  if (lower.includes("girls")) return "Girls";
  if (lower.includes("boys")) return "Boys";
  return "Mixed";
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

async function getValidatedDbGames() {
  const sourceGames = loadValidatedUaapGames();
  const validatedGameNumbers = sourceGames.map((game) => game.gameNumber);
  const leagueNames = Array.from(new Set(sourceGames.map((game) => game.leagueName)));

  return prisma.game.findMany({
    where: {
      deletedAt: null,
      gameNumber: { in: validatedGameNumbers },
      season: {
        deletedAt: null,
        league: {
          deletedAt: null,
          name: { in: leagueNames }
        }
      }
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
      stats: {
        where: { deletedAt: null },
        include: {
          team: true,
          player: {
            include: {
              currentRatings: {
                where: {
                  ageGroup: AgeGroup.U19,
                  policyVersionId: getActivePolicyVersionId()
                },
                take: 1
              }
            }
          }
        }
      }
    }
  });
}

async function getHomeRecentGames(limit = 9): Promise<HomeRecentGame[]> {
  const games = await getValidatedDbGames();
  return games
    .sort((left, right) => right.gameDate.getTime() - left.gameDate.getTime() || right.id.localeCompare(left.id))
    .slice(0, limit)
    .map((game) => ({
      id: game.id,
      gameDate: game.gameDate.toISOString().slice(0, 10),
      leagueName: game.season.league.name,
      seasonName: game.season.name,
      homeTeamName: getUaapSchoolDisplayName(game.homeTeam.name),
      awayTeamName: getUaapSchoolDisplayName(game.awayTeam.name),
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    }));
}

async function getBoardMovers(limit = 6): Promise<HomeRankMover[]> {
  const snapshots = await prisma.rankingSnapshot.findMany({
    where: { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS, scope: RankingScope.NATIONAL },
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    take: 2,
    select: { id: true, weekOf: true }
  });

  if (snapshots.length < 2) return [];

  const rows = await prisma.rankingSnapshotRow.findMany({
    where: { snapshotId: { in: snapshots.map((snapshot) => snapshot.id) } },
    include: { player: { select: { id: true, displayName: true } } },
    orderBy: { rank: "asc" }
  });

  const rowsBySnapshot = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = rowsBySnapshot.get(row.snapshotId) ?? [];
    bucket.push(row);
    rowsBySnapshot.set(row.snapshotId, bucket);
  }

  const [currentSnapshot, previousSnapshot] = snapshots;
  const currentRows = rowsBySnapshot.get(currentSnapshot.id) ?? [];
  const previousRows = rowsBySnapshot.get(previousSnapshot.id) ?? [];
  const previousRankByPlayer = new Map(previousRows.map((row) => [row.playerId, row.rank]));
  const movers: HomeRankMover[] = [];

  for (const row of currentRows) {
    const previousRank = previousRankByPlayer.get(row.playerId) ?? null;
    if (previousRank == null) continue;
    const delta = previousRank - row.rank;
    if (delta === 0) continue;
    movers.push({
      playerId: row.playerId,
      slug: slugify(row.player.displayName),
      displayName: row.player.displayName,
      previousRank,
      currentRank: row.rank,
      delta,
      rating: Number(row.rating)
    });
  }

  return movers
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || right.rating - left.rating)
    .slice(0, limit);
}

export async function getHomeData(): Promise<HomeData> {
  const rankings = await getLatestNationalRankings();
  const [boysRows, girlsRows, officialCounts, boardMovers, recentGames] = await Promise.all([
    addAge(rankings.snapshots.boys.rows.slice(0, 10)),
    addAge(rankings.snapshots.girls.rows.slice(0, 10)),
    getOfficialTeamCompetitionCounts(),
    getBoardMovers(),
    getHomeRecentGames(),
  ]);
  const allTopRows = [...boysRows, ...girlsRows].sort((left, right) => right.rating - left.rating);
  const emptyBoard = { boys: [] as HomeLeaderboardRow[], girls: [] as HomeLeaderboardRow[] };
  const leaderboardsByAge: HomeData["leaderboardsByAge"] = {
    U13: emptyBoard,
    U16: emptyBoard,
    U19: { boys: boysRows, girls: girlsRows },
  };

  return {
    counts: {
      rankedPlayers: rankings.snapshots.boys.totalRows + rankings.snapshots.girls.totalRows,
      verifiedLeagues: officialCounts.verifiedLeagues,
      gamesLogged: officialCounts.gamesLogged
    },
    leader: allTopRows[0] ?? null,
    boardLeaders: allTopRows.slice(0, 6),
    leaderboards: {
      boys: boysRows,
      girls: girlsRows
    },
    leaderboardsByAge,
    teamPreview: [],
    recentGames,
    boardMovers
  };
}

export async function getPublicLeagues(): Promise<PublicLeagueRow[]> {
  const leagues = await prisma.league.findMany({
    where: { deletedAt: null, seasons: { some: { deletedAt: null, games: { some: { deletedAt: null } } } } },
    include: {
      seasons: {
        where: { deletedAt: null },
        include: {
          games: {
            where: { deletedAt: null },
            include: { homeTeam: true, awayTeam: true }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  return leagues.map((league) => {
    const games = league.seasons.flatMap((season) => season.games);
    const teams = new Set<string>();
    games.forEach((game) => {
      teams.add(game.homeTeamId);
      teams.add(game.awayTeamId);
    });
    const teamCount = teams.size;

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
  const games = await getValidatedDbGames();
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

  function ensure(rawName: string, sourceTeam: { id: string; city: string; region: string }, game: typeof games[number]) {
    const name = getUaapSchoolDisplayName(rawName);
    const gender = inferGenderFromLeagueName(game.season.league.name) === "Girls" ? "Girls" as PublicGender : "Boys" as PublicGender;
    const key = `${gender}:${name}`;
    const existing = teams.get(key);
    if (existing) return existing;
    const next = {
      id: key,
      name,
      city: sourceTeam.city ?? "Not listed",
      region: sourceTeam.region ?? "Not listed",
      gender,
      ageGroup: game.season.league.ageGroup as PublicAgeGroup,
      league: game.season.league.name,
      wins: 0,
      losses: 0,
      points: 0,
      games: 0,
      topPlayer: null
    };
    teams.set(key, next);
    return next;
  }

  for (const game of games) {
    const home = ensure(game.homeTeam.name, game.homeTeam, game);
    const away = ensure(game.awayTeam.name, game.awayTeam, game);
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
      const teamName = getUaapSchoolDisplayName(stat.team.name);
      const gender = inferGenderFromLeagueName(game.season.league.name) === "Girls" ? "Girls" : "Boys";
      const bucket = teams.get(`${gender}:${teamName}`);
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

export async function getPublicGamesIndex(): Promise<PublicGamesIndex> {
  const games = await getValidatedDbGames();
  const leagues = new Map<string, string>();

  const rows: PublicGameRow[] = games.map((game) => {
    leagues.set(game.season.league.id, game.season.league.name);
    return {
      id: game.id,
      gameNumber: game.gameNumber ?? game.id,
      gameDate: game.gameDate.toISOString().slice(0, 10),
      verificationStatus: game.verificationStatus,
      leagueId: game.season.league.id,
      leagueName: game.season.league.name,
      seasonName: game.season.name,
      homeTeamName: getUaapSchoolDisplayName(game.homeTeam.name),
      awayTeamName: getUaapSchoolDisplayName(game.awayTeam.name),
      homeScore: game.homeScore,
      awayScore: game.awayScore
    };
  }).sort((left, right) => right.gameDate.localeCompare(left.gameDate) || (left.gameNumber ?? "").localeCompare(right.gameNumber ?? ""));

  return {
    leagues: [...leagues.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name)),
    games: rows
  };
}

export async function getPublicTrustMeta(): Promise<PublicTrustMeta> {
  const [latestGame, latestSnapshot] = await Promise.all([
    prisma.game.findFirst({
      where: {
        deletedAt: null,
        verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
        season: { deletedAt: null, league: { deletedAt: null } }
      },
      orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
      select: { gameDate: true }
    }),
    prisma.rankingSnapshot.findFirst({
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      select: { weekOf: true, createdAt: true }
    })
  ]);

  const candidates = [
    latestGame?.gameDate,
    latestSnapshot?.weekOf,
    latestSnapshot?.createdAt
  ].filter((value): value is Date => value instanceof Date);

  const latest = candidates.reduce<Date | null>((current, candidate) => {
    if (!current || candidate > current) return candidate;
    return current;
  }, null);

  return { lastUpdated: latest?.toISOString() ?? null };
}

