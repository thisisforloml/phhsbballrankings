/**
 * Parent-before-child migration order derived from prisma/schema.prisma foreign keys.
 * Do not reorder without re-validating FK dependencies.
 */
export type TablePlanEntry = {
  /** Prisma delegate key (camelCase model name). */
  model: string;
  /** Human-readable label for progress output. */
  label: string;
  /** PostgreSQL table name from @@map. */
  pgTable: string;
  /** Primary key field used for stable cursor pagination (default: id). */
  cursorField?: string;
};

export const MIGRATION_TABLE_PLAN: TablePlanEntry[] = [
  { model: "user", label: "Users", pgTable: "users" },
  { model: "program", label: "Programs", pgTable: "programs" },
  { model: "league", label: "Leagues", pgTable: "leagues" },
  { model: "formulaVersion", label: "FormulaVersions", pgTable: "formula_versions" },
  { model: "teamFormulaVersion", label: "TeamFormulaVersions", pgTable: "team_formula_versions" },
  { model: "organizerApplication", label: "OrganizerApplications", pgTable: "organizer_applications" },
  { model: "playerProfileSubmission", label: "PlayerProfileSubmissions", pgTable: "player_profile_submissions" },
  { model: "season", label: "Seasons", pgTable: "seasons" },
  { model: "team", label: "Teams", pgTable: "teams" },
  { model: "player", label: "Players", pgTable: "players" },
  { model: "userLeagueAccess", label: "UserLeagueAccess", pgTable: "user_league_access" },
  { model: "leagueSeasonAverage", label: "LeagueSeasonAverages", pgTable: "league_season_averages" },
  { model: "teamExternalAlias", label: "TeamExternalAliases", pgTable: "team_external_aliases" },
  { model: "playerAlias", label: "PlayerAliases", pgTable: "player_aliases" },
  { model: "playerExternalAlias", label: "PlayerExternalAliases", pgTable: "player_external_aliases" },
  { model: "playerProgramHistory", label: "PlayerProgramHistory", pgTable: "player_program_history" },
  { model: "playerTeamSeason", label: "PlayerTeamSeasons", pgTable: "player_team_seasons" },
  { model: "game", label: "Games", pgTable: "games" },
  { model: "teamRating", label: "TeamRatings", pgTable: "team_ratings" },
  { model: "gameStat", label: "GameStats", pgTable: "game_stats" },
  { model: "gamePerformanceScore", label: "GamePerformanceScores", pgTable: "game_performance_scores" },
  { model: "playerRating", label: "PlayerRatings", pgTable: "player_ratings" },
  { model: "rankingSnapshot", label: "RankingSnapshots", pgTable: "ranking_snapshots" },
  { model: "rankingSnapshotRow", label: "RankingSnapshotRows", pgTable: "ranking_snapshot_rows" },
  { model: "programTeamRating", label: "ProgramTeamRatings", pgTable: "program_team_ratings" },
  { model: "teamRankingSnapshot", label: "TeamRankingSnapshots", pgTable: "team_ranking_snapshots" },
  { model: "teamRankingSnapshotRow", label: "TeamRankingSnapshotRows", pgTable: "team_ranking_snapshot_rows" },
  { model: "submission", label: "Submissions", pgTable: "submissions" },
  { model: "auditLog", label: "AuditLogs", pgTable: "audit_log" },
  { model: "profileClaim", label: "ProfileClaims", pgTable: "profile_claims" },
  { model: "playerClaimProfile", label: "PlayerClaimProfiles", pgTable: "player_claim_profiles", cursorField: "playerId" },
  { model: "gameEditAudit", label: "GameEditAudits", pgTable: "game_edit_audits" },
];
