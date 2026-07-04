import type {
  AgeGroup,
  CompetitionSeasonType,
  CompetitionSport,
  CompetitionStatus,
  PlayerGender,
  SeasonStatus,
} from "@prisma/client";

export type ManagedCompetition = {
  id: string;
  name: string;
  shortName: string | null;
  organization: string;
  seasonType: CompetitionSeasonType | null;
  country: string | null;
  region: string | null;
  sport: CompetitionSport | null;
  defaultAgeGroups: AgeGroup[];
  defaultGenders: PlayerGender[];
  status: CompetitionStatus;
  logoUrl: string | null;
  website: string | null;
  notes: string | null;
  tier: number;
  ageGroup: AgeGroup;
  seasonCount: number;
  gameCount: number;
};

export type ManagedSeason = {
  id: string;
  name: string;
  seasonNumber: number | null;
  seasonYear: number;
  startsOn: string;
  endsOn: string | null;
  status: SeasonStatus;
  isCurrent: boolean;
  gameCount: number;
  divisionCount: number;
};

export type ManagedDivision = {
  id: string;
  seasonId: string;
  name: string;
  ageGroup: AgeGroup | null;
  gender: PlayerGender | null;
  status: SeasonStatus;
  sortOrder: number;
  gameCount: number;
};
