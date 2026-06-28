export type AgeGroup = "U13" | "U16" | "U19";
export type RankingScope = "overall" | "region" | "city";
export type PlayerGender = "BOYS" | "GIRLS";

export interface LeagueParticipation {
  name: string;
  tier: number;
  tierLabel: "Entry" | "Developmental" | "Competitive" | "Elite";
}

export interface PlayerSummary {
  id: string;
  slug: string;
  displayName: string;
  gender: PlayerGender;
  photoUrl?: string | null;
  position?: string | null;
  heightCm?: number | null;
  regionRanking?: number | null;
  positionRanking?: number | null;
  ageGroup: AgeGroup;
  city: string;
  region: string;
  team: string;
  games: number;
  rating: number;
  stars: 1 | 2 | 3 | 4 | 5;
  trend: number;
  ppg: number;
  rpg: number;
  apg: number;
  leagues: LeagueParticipation[];
  lastFive: Array<{
    league: string;
    statLine: string;
    date: string;
  }>;
  publicBoardEligible: boolean;
}
