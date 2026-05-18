import { AgeGroup, PlayerGender, RankingScope } from "@prisma/client";
import { slugify } from "./format";
import { getUaapSchoolDisplayName } from "./uaap-school-display";
import { prisma } from "./prisma";

const formulaVersionNumber = 1;
const profileAgeGroup = AgeGroup.U19;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LoadedPlayer = NonNullable<Awaited<ReturnType<typeof loadPlayerById>>>;

export type PlayerProfileGame = {
  gameId: string;
  gameDate: string;
  leagueName: string;
  seasonName: string;
  teamName: string;
  opponentName: string;
  result: "W" | "L";
  teamScore: number;
  opponentScore: number;
  points: number;
  rebounds: number;
  assists: number;
  finalPerformanceScore: number | null;
};

export type PlayerProfileLeague = {
  leagueName: string;
  seasonName: string;
  tier: number;
  tierLabel: "Entry" | "Developmental" | "Competitive" | "Elite";
  gamesPlayed: number;
  avgPoints: number;
  avgAssists: number;
  avgRebounds: number;
};

export type PlayerProfile = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  city: string;
  region: string;
  gender: "BOYS" | "GIRLS";
  position: string | null;
  heightCm: number | null;
  birthDate: string | null;
  birthYear: number | null;
  age: number | null;
  photoUrl: string | null;
  currentTeam: string;
  ageGroup: "U19";
  rating: number;
  observedRating: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  verifiedGameCount: number;
  nationalRank: number | null;
  snapshotWeekOf: string | null;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  latestFiveGames: PlayerProfileGame[];
  leagues: PlayerProfileLeague[];
};

function tierLabel(tier: number): PlayerProfileLeague["tierLabel"] {
  if (tier >= 4) return "Elite";
  if (tier === 3) return "Competitive";
  if (tier === 2) return "Developmental";
  return "Entry";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function playerNameParts(displayName: string, firstName: string, lastName: string) {
  if (firstName && lastName) return { firstName, lastName };

  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: firstName || parts[0] || displayName,
    lastName: lastName || parts.slice(1).join(" ") || parts[0] || displayName
  };
}

async function loadPlayerById(id: string) {
  return prisma.player.findFirst({
    where: {
      id,
      deletedAt: null
    },
    include: {
      currentRatings: {
        where: {
          ageGroup: profileAgeGroup
        }
      },
      rankingRows: {
        where: {
          snapshot: {
            scope: RankingScope.NATIONAL,
            ageGroup: profileAgeGroup,
            formulaVersion: {
              versionNumber: formulaVersionNumber
            },
            city: null,
            region: null
          }
        },
        include: {
          snapshot: true
        }
      },
      gameStats: {
        where: {
          deletedAt: null,
          performanceScore: {
            formulaVersion: {
              versionNumber: formulaVersionNumber
            },
            deletedAt: null
          }
        },
        include: {
          team: true,
          performanceScore: true,
          game: {
            include: {
              homeTeam: true,
              awayTeam: true,
              season: {
                include: {
                  league: true
                }
              }
            }
          }
        },
        orderBy: {
          game: {
            gameDate: "desc"
          }
        }
      }
    }
  });
}

async function resolvePlayerIdBySlug(slug: string) {
  if (uuidPattern.test(slug)) {
    const exactPlayer = await prisma.player.findFirst({
      where: {
        id: slug,
        deletedAt: null
      },
      select: {
        id: true
      }
    });

    if (exactPlayer) return exactPlayer.id;
  }

  const candidates = await prisma.player.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      displayName: true
    }
  });
  const matches = candidates.filter((player) => slugify(player.displayName) === slug);

  return matches.length === 1 ? matches[0].id : null;
}

function latestSnapshotRow(player: LoadedPlayer) {
  const matchingRows = player.rankingRows.filter((row) => row.snapshot.gender === player.gender);
  matchingRows.sort((left, right) => right.snapshot.weekOf.getTime() - left.snapshot.weekOf.getTime());
  return matchingRows[0] ?? null;
}

function mapGameStat(stat: LoadedPlayer["gameStats"][number]): PlayerProfileGame {
  const isHome = stat.teamId === stat.game.homeTeamId;
  const teamScore = isHome ? stat.game.homeScore : stat.game.awayScore;
  const opponentScore = isHome ? stat.game.awayScore : stat.game.homeScore;
  const opponentName = isHome ? stat.game.awayTeam.name : stat.game.homeTeam.name;
  const finalPerformanceScore = stat.performanceScore?.finalPerformanceScore ?? stat.performanceScore?.performanceScore ?? null;

  return {
    gameId: stat.gameId,
    gameDate: stat.game.gameDate.toISOString(),
    leagueName: stat.game.season.league.name,
    seasonName: stat.game.season.name,
    teamName: getUaapSchoolDisplayName(stat.team.name),
    opponentName,
    result: teamScore > opponentScore ? "W" : "L",
    teamScore,
    opponentScore,
    points: stat.points,
    rebounds: stat.rebounds,
    assists: stat.assists,
    finalPerformanceScore: finalPerformanceScore === null ? null : Number(finalPerformanceScore)
  };
}

function buildLeagueHistory(games: PlayerProfileGame[], stats: LoadedPlayer["gameStats"]): PlayerProfileLeague[] {
  const grouped = new Map<string, { leagueName: string; seasonName: string; tier: number; points: number; assists: number; rebounds: number; games: number }>();

  for (const stat of stats) {
    const league = stat.game.season.league;
    const key = `${league.id}:${stat.game.seasonId}`;
    const existing = grouped.get(key) ?? {
      leagueName: league.name,
      seasonName: stat.game.season.name,
      tier: league.tier,
      points: 0,
      assists: 0,
      rebounds: 0,
      games: 0
    };

    existing.points += stat.points;
    existing.assists += stat.assists;
    existing.rebounds += stat.rebounds;
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
    avgRebounds: item.games ? roundOne(item.rebounds / item.games) : 0
  }));
}

export async function getPlayerProfileBySlug(slug: string): Promise<PlayerProfile | null> {
  const playerId = await resolvePlayerIdBySlug(slug);
  if (!playerId) return null;

  const player = await loadPlayerById(playerId);
  if (!player) return null;

  const rating = player.currentRatings[0] ?? null;
  const snapshotRow = latestSnapshotRow(player);
  const games = player.gameStats.map(mapGameStat);
  const gamesPlayed = games.length;
  const totals = player.gameStats.reduce(
    (sum, stat) => ({
      points: sum.points + stat.points,
      rebounds: sum.rebounds + stat.rebounds,
      assists: sum.assists + stat.assists
    }),
    { points: 0, rebounds: 0, assists: 0 }
  );
  const mostRecentStat = player.gameStats[0] ?? null;
  const names = playerNameParts(player.displayName, player.firstName, player.lastName);

  return {
    id: player.id,
    slug: slugify(player.displayName),
    firstName: names.firstName,
    lastName: names.lastName,
    displayName: player.displayName,
    city: player.city,
    region: player.region,
    gender: player.gender,
    position: player.position,
    heightCm: player.heightCm,
    birthDate: player.birthDate ? player.birthDate.toISOString() : null,
    birthYear: player.birthDate ? player.birthDate.getUTCFullYear() : null,
    age: calculateAge(player.birthDate),
    photoUrl: player.photoUrl,
    currentTeam: getUaapSchoolDisplayName(mostRecentStat?.team.name),
    ageGroup: profileAgeGroup,
    rating: Number(rating?.adjustedRating ?? 0),
    observedRating: Number(rating?.observedRating ?? rating?.adjustedRating ?? 0),
    starRating: (rating?.starRating ?? 1) as PlayerProfile["starRating"],
    verifiedGameCount: rating?.verifiedGameCount ?? gamesPlayed,
    nationalRank: snapshotRow?.rank ?? null,
    snapshotWeekOf: snapshotRow?.snapshot.weekOf.toISOString() ?? null,
    gamesPlayed,
    ppg: gamesPlayed ? roundOne(totals.points / gamesPlayed) : 0,
    rpg: gamesPlayed ? roundOne(totals.rebounds / gamesPlayed) : 0,
    apg: gamesPlayed ? roundOne(totals.assists / gamesPlayed) : 0,
    latestFiveGames: games.slice(0, 5),
    leagues: buildLeagueHistory(games, player.gameStats)
  };
}
