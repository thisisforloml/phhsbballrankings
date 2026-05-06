import { PrismaClient, PlayerGender } from "@prisma/client";

const prisma = new PrismaClient();

type Gender = "Boys" | "Girls";
type AgeGroup = "U13" | "U16" | "U19";
type Position = "PG" | "SG" | "SF" | "PF" | "C";

function genderLabel(gender: PlayerGender): Gender {
  return gender === PlayerGender.GIRLS ? "Girls" : "Boys";
}

function normalizeAgeGroup(): AgeGroup {
  return "U19";
}

function splitName(displayName: string) {
  const parts = displayName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? displayName,
    lastName: parts.slice(1).join(" ")
  };
}

function safePosition(position: string | null): Position | null {
  return position === "PG" || position === "SG" || position === "SF" || position === "PF" || position === "C" ? position : null;
}

function starsForRating(rating: number): 1 | 2 | 3 | 4 | 5 {
  if (rating >= 90) return 5;
  if (rating >= 82) return 4;
  if (rating >= 74) return 3;
  if (rating >= 66) return 2;
  return 1;
}

function ratingFor(ppg: number, games: number, teamWinRate: number) {
  return Number(Math.min(99, Math.max(50, 55 + ppg * 1.65 + games * 0.75 + teamWinRate * 8)).toFixed(2));
}

function quote(value: unknown) {
  return JSON.stringify(value);
}

async function main() {
  const dbPlayers = await prisma.player.findMany({
    where: { deletedAt: null },
    include: {
      rosterSeasons: {
        where: { deletedAt: null },
        include: { team: true, season: { include: { league: true } } },
        orderBy: { createdAt: "desc" }
      },
      gameStats: {
        where: { deletedAt: null, game: { verificationStatus: "VERIFIED", deletedAt: null } },
        include: {
          team: true,
          game: {
            include: {
              homeTeam: true,
              awayTeam: true,
              season: { include: { league: true } }
            }
          }
        },
        orderBy: { game: { gameDate: "desc" } }
      }
    }
  });

  const playerBase = dbPlayers.map((player) => {
    const stats = player.gameStats;
    const gamesPlayed = stats.length;
    const totalPoints = stats.reduce((sum, stat) => sum + stat.points, 0);
    const totalAssists = stats.reduce((sum, stat) => sum + stat.assists, 0);
    const totalRebounds = stats.reduce((sum, stat) => sum + stat.rebounds, 0);
    const ppg = gamesPlayed ? Number((totalPoints / gamesPlayed).toFixed(1)) : 0;
    const apg = gamesPlayed ? Number((totalAssists / gamesPlayed).toFixed(1)) : undefined;
    const rpg = gamesPlayed ? Number((totalRebounds / gamesPlayed).toFixed(1)) : undefined;
    const wins = stats.filter((stat) => {
      const game = stat.game;
      const isHome = stat.teamId === game.homeTeamId;
      return isHome ? game.homeScore > game.awayScore : game.awayScore > game.homeScore;
    }).length;
    const winRate = gamesPlayed ? wins / gamesPlayed : 0;
    const rating = ratingFor(ppg, gamesPlayed, winRate);
    const latestRoster = player.rosterSeasons[0];
    const topLeague = latestRoster?.season.league ?? stats[0]?.game.season.league;
    const gender = genderLabel(player.gender);
    const ageGroup = normalizeAgeGroup();
    const minimum = gender === "Girls" ? 8 : 10;
    const names = splitName(player.displayName);

    return {
      id: player.id,
      firstName: names.firstName,
      lastName: names.lastName,
      gender,
      position: safePosition(player.position),
      city: player.city,
      region: player.region,
      ageGroup,
      rating,
      stars: starsForRating(rating),
      gamesPlayed,
      isRankEligible: gamesPlayed >= minimum,
      isVerified: true,
      isClaimed: false,
      nationalRank: 0,
      regionalRank: 0,
      cityRank: 0,
      avgPoints: ppg,
      avgAssists: apg,
      avgRebounds: rpg,
      school: latestRoster?.team.name,
      topLeague: topLeague?.name ?? "Verified league pending",
      topLeagueTier: ((topLeague?.tier ?? 1) as 1 | 2 | 3 | 4),
      weeklyTrend: "flat" as const,
      trendDelta: 0,
      lastFiveGames: stats.slice(0, 5).map((stat) => {
        const game = stat.game;
        const isHome = stat.teamId === game.homeTeamId;
        const opponent = isHome ? game.awayTeam.name : game.homeTeam.name;
        const result = isHome ? (game.homeScore > game.awayScore ? "W" : "L") : game.awayScore > game.homeScore ? "W" : "L";
        return {
          league: game.season.league.name,
          opponent,
          result,
          points: stat.points,
          assists: stat.assists,
          rebounds: stat.rebounds,
          performanceScore: Number((stat.points * 1.1 + (stat.rebounds || 0) * 0.7 + (stat.assists || 0) * 0.7).toFixed(1))
        };
      }),
      leaguesPlayed: Array.from(new Map(
        stats.map((stat) => {
          const league = stat.game.season.league;
          const leagueStats = stats.filter((row) => row.game.season.leagueId === league.id);
          const games = leagueStats.length;
          return [league.id, {
            leagueName: league.name,
            season: stat.game.season.name,
            tier: league.tier as 1 | 2 | 3 | 4,
            gamesPlayed: games,
            avgPoints: games ? Number((leagueStats.reduce((sum, row) => sum + row.points, 0) / games).toFixed(1)) : 0,
            avgAssists: games ? Number((leagueStats.reduce((sum, row) => sum + row.assists, 0) / games).toFixed(1)) : undefined,
            avgRebounds: games ? Number((leagueStats.reduce((sum, row) => sum + row.rebounds, 0) / games).toFixed(1)) : undefined
          }];
        })
      ).values())
    };
  });

  const rankedPlayers = playerBase
    .sort((a, b) => b.rating - a.rating)
    .map((player, index, list) => ({
      ...player,
      nationalRank: index + 1,
      regionalRank: list.filter((item) => item.region === player.region).findIndex((item) => item.id === player.id) + 1,
      cityRank: list.filter((item) => item.city === player.city).findIndex((item) => item.id === player.id) + 1
    }));

  const dbLeagues = await prisma.league.findMany({
    where: { deletedAt: null },
    include: { seasons: { include: { games: true, rosterSeasons: true } } },
    orderBy: { name: "asc" }
  });

  const leagues = dbLeagues.map((league) => {
    const games = league.seasons.flatMap((season) => season.games);
    return {
      id: league.id,
      name: league.name,
      organizerName: league.organizerName,
      city: league.city ?? "NCR",
      region: league.region ?? "NCR",
      ageGroup: "U19" as AgeGroup,
      gender: league.name.toLowerCase().includes("girls") ? "Girls" as Gender : "Boys" as Gender,
      tier: league.tier as 1 | 2 | 3 | 4,
      isVerified: league.verificationStatus === "VERIFIED",
      teamCount: new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId])).size,
      gamesPerTeam: games.length,
      complianceRate: 100,
      qualityScore: league.qualityScore,
      playerCount: league.seasons.reduce((sum, season) => sum + season.rosterSeasons.length, 0)
    };
  });

  const dbGames = await prisma.game.findMany({
    where: { deletedAt: null, verificationStatus: "VERIFIED" },
    include: { homeTeam: true, awayTeam: true, season: { include: { league: true } } },
    orderBy: { gameDate: "desc" }
  });

  const scoreGames = dbGames.map((game) => ({
    id: game.id,
    league: game.season.league.name,
    date: game.gameDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    region: game.region,
    city: game.city,
    ageGroup: "U19" as AgeGroup,
    gender: game.season.league.name.toLowerCase().includes("girls") ? "Girls" as Gender : "Boys" as Gender,
    homeTeam: game.homeTeam.name,
    awayTeam: game.awayTeam.name,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    isVerified: true
  }));

  const dbTeams = await prisma.team.findMany({
    where: { deletedAt: null },
    include: {
      homeGames: { where: { verificationStatus: "VERIFIED" }, include: { season: { include: { league: true } } } },
      awayGames: { where: { verificationStatus: "VERIFIED" }, include: { season: { include: { league: true } } } },
      gameStats: { where: { deletedAt: null, game: { verificationStatus: "VERIFIED" } }, include: { player: true, game: { include: { season: { include: { league: true } } } } } }
    },
    orderBy: { name: "asc" }
  });

  const teams = dbTeams.map((team) => {
    const games = [...team.homeGames, ...team.awayGames];
    const wins = games.filter((game) => game.homeTeamId === team.id ? game.homeScore > game.awayScore : game.awayScore > game.homeScore).length;
    const losses = games.length - wins;
    const points = games.reduce((sum, game) => sum + (game.homeTeamId === team.id ? game.homeScore : game.awayScore), 0);
    const topStat = [...team.gameStats].sort((a, b) => b.points - a.points)[0];
    const topPlayer = topStat ? rankedPlayers.find((player) => player.id === topStat.playerId) : undefined;
    const league = team.gameStats[0]?.game.season.league ?? games[0]?.season.league;
    const ppg = games.length ? Number((points / games.length).toFixed(1)) : 0;
    return {
      id: team.id,
      name: team.name,
      schoolClub: team.name,
      city: team.city,
      region: team.region,
      ageGroup: "U19" as AgeGroup,
      gender: league?.name.toLowerCase().includes("girls") ? "Girls" as Gender : "Boys" as Gender,
      rating: Number(Math.min(99, 55 + wins * 2 + ppg * 0.25).toFixed(2)),
      wins,
      losses,
      ppg,
      topPlayer,
      league: league?.name ?? "Verified league pending"
    };
  });

  const regions = Array.from(new Set([
    ...rankedPlayers.map((player) => player.region),
    ...leagues.map((league) => league.region),
    ...scoreGames.map((game) => game.region),
    ...teams.map((team) => team.region)
  ])).filter(Boolean).sort();

  const file = `export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type AgeGroup = "U13" | "U16" | "U19";
export type Gender = "Boys" | "Girls";
export type Tier = 1 | 2 | 3 | 4;

export interface BoxScoreAverages {
  fgPct?: number;
  threePct?: number;
  ftPct?: number;
  astTo?: number;
  steals?: number;
  blocks?: number;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
}

export interface GameResult {
  league: string;
  opponent: string;
  result: "W" | "L";
  points: number;
  assists?: number;
  rebounds?: number;
  performanceScore: number;
}

export interface LeagueHistory {
  leagueName: string;
  season: string;
  tier: Tier;
  gamesPlayed: number;
  avgPoints: number;
  avgAssists?: number;
  avgRebounds?: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  position: Position | null;
  city: string;
  region: string;
  birthYear?: number;
  ageGroup: AgeGroup;
  rating: number;
  stars: 1 | 2 | 3 | 4 | 5;
  gamesPlayed: number;
  isRankEligible: boolean;
  isVerified: boolean;
  isClaimed: boolean;
  nationalRank: number;
  regionalRank: number;
  cityRank: number;
  positionRank?: number;
  avgPoints: number;
  avgAssists?: number;
  avgRebounds?: number;
  school?: string;
  contactInfo?: string;
  photoUrl?: string;
  topLeague: string;
  topLeagueTier: Tier;
  weeklyTrend: "up" | "down" | "flat";
  trendDelta: number;
  boxScoreAverages?: BoxScoreAverages;
  lastFiveGames: GameResult[];
  leaguesPlayed: LeagueHistory[];
}

export interface League {
  id: string;
  name: string;
  organizerName: string;
  city: string;
  region: string;
  ageGroup: AgeGroup;
  gender: Gender;
  tier: Tier;
  isVerified: boolean;
  teamCount: number;
  gamesPerTeam: number;
  complianceRate: number;
  qualityScore: number;
  playerCount: number;
}

export interface ScoreGame {
  id: string;
  league: string;
  date: string;
  region: string;
  city: string;
  ageGroup: AgeGroup;
  gender: Gender;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  isVerified: boolean;
}

export interface Team {
  id: string;
  name: string;
  schoolClub: string;
  city: string;
  region: string;
  ageGroup: AgeGroup;
  gender: Gender;
  rating: number;
  wins: number;
  losses: number;
  ppg: number;
  topPlayer?: Player;
  league: string;
}

export const players: Player[] = ${quote(rankedPlayers)};
export const leagues: League[] = ${quote(leagues)};
export const scoreGames: ScoreGame[] = ${quote(scoreGames)};
export const teams: Team[] = ${quote(teams)};

export const regions: string[] = ${quote(regions)};
export const ageGroups: AgeGroup[] = ["U13", "U16", "U19"];
export const genders: Gender[] = ["Boys", "Girls"];
export const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];

export function eligibilityMinimum(gender: Gender) {
  return gender === "Girls" ? 8 : 10;
}

function withRanks(list: Player[]) {
  const ranked = [...list].sort((a, b) => b.rating - a.rating);
  return ranked.map((player, index) => ({
    ...player,
    nationalRank: index + 1,
    positionRank: player.position ? ranked.filter((item) => item.position === player.position).findIndex((item) => item.id === player.id) + 1 : undefined
  }));
}

export function getPlayersByAgeGroup(ageGroup: AgeGroup, gender?: Gender) {
  return withRanks(players.filter((player) => player.ageGroup === ageGroup).filter((player) => !gender || player.gender === gender).filter((player) => player.gamesPlayed >= eligibilityMinimum(player.gender)));
}

export function getPlayersByFilters(filters: {
  ageGroup?: AgeGroup;
  gender?: Gender;
  region?: string;
  city?: string;
  minimumGames?: number;
  position?: "All" | Position;
}) {
  return withRanks(players)
    .filter((player) => !filters.ageGroup || player.ageGroup === filters.ageGroup)
    .filter((player) => !filters.gender || player.gender === filters.gender)
    .filter((player) => !filters.region || filters.region === "All" || player.region === filters.region)
    .filter((player) => !filters.city || filters.city === "All" || player.city === filters.city)
    .filter((player) => player.gamesPlayed >= (filters.minimumGames ?? eligibilityMinimum(player.gender)))
    .filter((player) => !filters.position || filters.position === "All" || player.position === filters.position);
}

export function getPlayerById(id: string) {
  return players.find((player) => player.id === id);
}

export function getLeagueById(id: string) {
  return leagues.find((league) => league.id === id);
}

export function formatPlayerName(player: Player) {
  return \`\${player.firstName} \${player.lastName}\`.trim();
}
`;

  await import("node:fs/promises").then((fs) => fs.writeFile("src/lib/mock-data.ts", file, "utf8"));
  console.log(JSON.stringify({ players: rankedPlayers.length, leagues: leagues.length, scoreGames: scoreGames.length, teams: teams.length, regions: regions.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
