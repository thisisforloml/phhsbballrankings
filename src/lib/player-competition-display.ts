export type PrimaryCompetition = {
  leagueName: string;
  shortName: string;
  seasonName: string;
  verifiedGameCount: number;
  /** Internal sort key only — not shown in P0 UI */
  tier: number;
};

export type CompetitionParticipationEntry = {
  leagueName: string;
  seasonName: string;
  verifiedGames: number;
};

export type CompetitionParticipationSummary = {
  primary: PrimaryCompetition | null;
  totalVerifiedGames: number;
  competitionCount: number;
  competitions: CompetitionParticipationEntry[];
};

export function formatPrimaryCompetitionLine(primary: PrimaryCompetition): string {
  const gamesLabel = primary.verifiedGameCount === 1 ? "game" : "games";
  return `${primary.shortName} · ${primary.verifiedGameCount} ${gamesLabel}`;
}
