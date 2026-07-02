export type TeamStandingsGender = "Boys" | "Girls";
export type TeamStandingsAgeGroup = "U13" | "U16" | "U19";

export type TeamStandingRow = {
  id: string;
  teamId: string;
  programId: string | null;
  internalTeamName: string;
  displayName: string;
  city: string;
  region: string;
  ageGroup: TeamStandingsAgeGroup;
  gender: TeamStandingsGender;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  seasonYear: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  winPercentage: number;
  rank: number;
};

export type TeamStandingsFilters = {
  ageGroups: TeamStandingsAgeGroup[];
  genders: TeamStandingsGender[];
  leagues: Array<{ id: string; name: string }>;
  seasons: Array<{ id: string; name: string; leagueId: string; leagueName: string; seasonYear: number | null }>;
  default: {
    ageGroup: TeamStandingsAgeGroup;
    gender: TeamStandingsGender;
    leagueId: string;
    seasonId: string;
  } | null;
};

export type TeamStandingsData = {
  rows: TeamStandingRow[];
  filters: TeamStandingsFilters;
  lastUpdated: string | null;
};

export function mergeCompetitionBoardRows(rows: TeamStandingRow[]): TeamStandingRow[] {
  const merged = new Map<string, TeamStandingRow & { scopeCount: number; seasonNames: Set<string> }>();

  for (const row of rows) {
    const key = row.programId ?? row.teamId;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...row,
        scopeCount: 1,
        seasonNames: new Set([row.seasonName]),
      });
      continue;
    }

    const combinedGames = existing.gamesPlayed + row.gamesPlayed;
    const combinedWins = existing.wins + row.wins;
    const combinedLosses = existing.losses + row.losses;
    const combinedPf = existing.pointsFor + row.pointsFor;
    const combinedPa = existing.pointsAgainst + row.pointsAgainst;
    const primary = row.gamesPlayed > existing.gamesPlayed ? row : existing;
    const nextSeasonNames = new Set(existing.seasonNames);
    nextSeasonNames.add(row.seasonName);

    merged.set(key, {
      ...primary,
      teamId: primary.teamId,
      programId: primary.programId ?? row.programId,
      gamesPlayed: combinedGames,
      wins: combinedWins,
      losses: combinedLosses,
      pointsFor: combinedPf,
      pointsAgainst: combinedPa,
      pointDifferential: combinedPf - combinedPa,
      winPercentage: combinedGames ? Number((combinedWins / combinedGames).toFixed(3)) : 0,
      scopeCount: existing.scopeCount + 1,
      seasonNames: nextSeasonNames,
      seasonName: nextSeasonNames.size > 1 ? `${nextSeasonNames.size} seasons` : primary.seasonName,
    });
  }

  return [...merged.values()].map(({ scopeCount: _scopeCount, seasonNames: _seasonNames, ...row }) => row);
}
