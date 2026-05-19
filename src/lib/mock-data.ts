export type Position = "PG" | "SG" | "SF" | "PF" | "C";
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
  classYear?: string | null;
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

export const players: Player[] = [];
export const leagues: League[] = [];
export const scoreGames: ScoreGame[] = [];
export const teams: Team[] = [];
export const regions: string[] = [];
export const ageGroups: AgeGroup[] = ["U13", "U16", "U19"];
export const genders: Gender[] = ["Boys", "Girls"];
export const positions: Position[] = ["PG", "SG", "SF", "PF", "C"];

export function eligibilityMinimum(gender: Gender) {
  return gender === "Girls" ? 5 : 10;
}

function withRanks(list: Player[]) {
  const ranked = [...list].sort((a, b) => b.rating - a.rating);
  return ranked.map((player, index) => ({
    ...player,
    nationalRank: index + 1,
    positionRank: player.position
      ? ranked.filter((item) => item.position === player.position).findIndex((item) => item.id === player.id) + 1
      : undefined
  }));
}

export function getPlayersByAgeGroup(ageGroup: AgeGroup, gender?: Gender) {
  return withRanks(
    players
      .filter((player) => player.ageGroup === ageGroup)
      .filter((player) => !gender || player.gender === gender)
      .filter((player) => player.gamesPlayed >= eligibilityMinimum(player.gender))
  );
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
  return `${player.firstName} ${player.lastName}`.trim();
}

