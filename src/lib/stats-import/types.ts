export type StatsImportProviderId = "statshub-v1";

export type ExternalGameStatus = "scheduled" | "live" | "final" | "cancelled" | "unknown";

export type ExternalGameIndex = {
  providerGameKey: string;
  matchId: string;
  gameNumber: string;
  gameDate: string | null;
  homeTeamLabel: string;
  awayTeamLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  status: ExternalGameStatus;
  statsAvailable: boolean;
  sourceUrl: string;
  warnings: string[];
};

export type ScheduleDiscoveryDiagnostics = {
  scheduleUrl: string;
  responseBytes: number;
  htmlBytes: number;
  rawExtfixCount: number;
  rawExtfixUniqueCount: number;
  matchWrapCount: number;
  parsedMatchCount: number;
  countsByStatus: Record<string, number>;
  discarded: Array<{ matchId: string; reason: string }>;
  /** Dev-only metadata extraction coverage (temporary) */
  discoveredMatches: number;
  matchesWithTeams: number;
  matchesWithScores: number;
  matchesWithDates: number;
};

export type UrlImportDiscovery = {
  provider: StatsImportProviderId;
  sourceUrl: string;
  canonicalUrl: string;
  pageType: "competition" | "game" | "unknown";
  competitionId: string | null;
  competitionTitle: string | null;
  inferredAgeGroup: string;
  inferredGender: "BOYS" | "GIRLS";
  inferredSeasonYear: number;
  games: ExternalGameIndex[];
  messages: string[];
  diagnostics?: ScheduleDiscoveryDiagnostics;
};

export type TeamConfidenceBand = "Exact" | "Strong Match" | "Review Needed" | "Unmatched";

export type PlayerConfidenceBand = "Exact" | "Strong Match" | "Review Needed" | "Unmatched";

export type TeamCreationPreview = {
  externalLabel: string;
  scheduleLabel: string | null;
  suggestedProgramName: string;
  suggestedTeamName: string;
  suggestedAgeGroup: string;
  suggestedGender: "BOYS" | "GIRLS";
};

export type TeamMatchPreviewRow = {
  aliasKey: string;
  externalLabel: string;
  scheduleLabel?: string | null;
  matchingInput: string;
  matchCount: number;
  inferredProgramName: string;
  creationPreview: TeamCreationPreview;
  gameCount: number;
  matchIds: string[];
  confidenceBand: TeamConfidenceBand;
  score: number;
  tier: string;
  method: string;
  matchReason?: string;
  ambiguous: boolean;
  suggestedTeam: { teamId: string; teamName: string; programName: string | null } | null;
  candidates: Array<{
    teamId: string;
    teamName: string;
    programName: string | null;
    score: number;
    tier: string;
    method: string;
  }>;
};

export type TeamMatchingPreviewDiagnostics = {
  uniqueTeams: number;
  autoResolved: number;
  needsReview: number;
  createOnImport: number;
  autoResolutionRate: number;
  existingTeams: number;
  teamsToCreate: number;
  manualOverrides: number;
  aliasesResolved: number;
  newAliasesCreated: number;
};

export type TeamMatchingPreviewDebugRow = {
  externalLabel: string;
  scheduleLabel?: string | null;
  matchingInput: string;
  confidenceBand: TeamConfidenceBand;
  suggestedTeam: string | null;
};

export type TeamMatchingCleanupLevel = "Low" | "Medium" | "High";

export type TeamMatchingPreview = {
  gameCount: number;
  uniqueTeams: number;
  readiness: {
    autoResolved: number;
    needsReview: number;
    unmatched: number;
    createOnImport: number;
    estimatedCleanup: TeamMatchingCleanupLevel;
    autoResolutionRate: number;
    /** @deprecated Use autoResolved */
    autoMatched?: number;
  };
  diagnostics: TeamMatchingPreviewDiagnostics;
  debugRows?: TeamMatchingPreviewDebugRow[];
  teams: TeamMatchPreviewRow[];
};

export type UrlImportTeamMapping = {
  externalLabel: string;
  scheduleLabel?: string | null;
  aliasKey: string;
  action: "mapped_existing" | "create_on_import";
  teamId?: string;
  teamName?: string;
  suggestedProgramName?: string;
  suggestedTeamName?: string;
  suggestedAgeGroup?: string;
  suggestedGender?: "BOYS" | "GIRLS";
};

/** One inferred Program bucket for create_on_import teams (future: one-click creation). */
export type ImportProgramCreationCandidate = {
  programKey: string;
  suggestedProgramName: string;
  suggestedProgramType: "School" | "Club / Team";
  suggestedAbbreviation: string;
  normalizedAlias: string;
  teams: ImportTeamCreationCandidate[];
};

/** One Team to create under a program (future: alias persistence, background imports). */
export type ImportTeamCreationCandidate = {
  teamKey: string;
  suggestedTeamName: string;
  suggestedAgeGroup: string;
  suggestedGender: "BOYS" | "GIRLS";
  gameCount: number;
  sourceMappings: Array<{
    aliasKey: string;
    externalLabel: string;
    scheduleLabel?: string | null;
    matchIds: string[];
    gameCount: number;
  }>;
};

export type UrlImportCreationPlan = {
  version: 1;
  leagueName: string;
  ageGroup: string;
  gender: "BOYS" | "GIRLS";
  generatedAt: string;
  programs: ImportProgramCreationCandidate[];
  teams: ImportTeamCreationCandidate[];
  summary: {
    programCount: number;
    teamCount: number;
    gamesAffected: number;
  };
};

export type OrganizationCreationPreviewProgram = {
  programKey: string;
  suggestedProgramName: string;
  suggestedProgramType: "School" | "Club / Team";
  teamCount: number;
};

export type OrganizationCreationPreviewTeam = {
  teamKey: string;
  suggestedTeamName: string;
  suggestedProgramName: string;
  suggestedAgeGroup: string;
  suggestedGender: "BOYS" | "GIRLS";
  resolvedTeamName: string;
};

export type OrganizationCreationSkippedRecord = {
  kind: "program" | "team";
  name: string;
  programName?: string;
  existingId: string;
  reason: string;
};

export type OrganizationCreationPreview = {
  programsToCreate: OrganizationCreationPreviewProgram[];
  teamsToCreate: OrganizationCreationPreviewTeam[];
  programsSkipped: OrganizationCreationSkippedRecord[];
  teamsSkipped: OrganizationCreationSkippedRecord[];
  summary: {
    programsToCreate: number;
    teamsToCreate: number;
    programsSkipped: number;
    teamsSkipped: number;
  };
  confirmationPhrase: string;
};

export type OrganizationCreationResult = {
  programsCreated: number;
  programsReused: number;
  teamsCreated: number;
  teamsReused: number;
  aliasesSaved: number;
  auditNotes: string;
};

export type PlayerMatchPreviewRow = {
  playerKey: string;
  importedName: string;
  cleanedName: string;
  teamLabel: string;
  mappedTeamId: string | null;
  mappedTeamName: string | null;
  gameCount: number;
  matchIds: string[];
  confidenceBand: PlayerConfidenceBand;
  score: number;
  tier: string;
  method: string;
  ambiguous: boolean;
  scopedToTeam: boolean;
  scopedToProgram?: boolean;
  promotedByTeamEvidence?: boolean;
  blockedAmbiguity?: boolean;
  emptyProvisionalRoster?: boolean;
  ambiguityKind?: "same_team" | "same_program" | "different_program" | null;
  suppressedAutoMatch?: boolean;
  candidateOnlySuggestion?: boolean;
  reviewCandidatesShown?: number;
  reviewCandidatesHidden?: number;
  suppressedWeakCandidates?: number;
  provisionalScopedToTeam?: boolean;
  provisionalScopeTeamId?: string | null;
  provisionalScopeTeamName?: string | null;
  matchReason?: string;
  suggestedPlayer: { playerId: string; displayName: string } | null;
  candidates: Array<{
    playerId: string;
    displayName: string;
    score: number;
    tier: string;
    method: string;
  }>;
  suppressedWeakCandidateExamples?: Array<{
    displayName: string;
    method: string;
    suppressReason: string;
    score: number;
  }>;
};

export type PlayerMatchingPreviewDiagnostics = {
  uniquePlayers: number;
  autoMatched: number;
  needsReview: number;
  newPlayers: number;
  autoResolutionRate: number;
  aliasesResolved: number;
  newAliasesCreated: number;
  provisionalScopedPlayers: number;
  provisionalScopedTeams: number;
  tierCounts: Record<string, number>;
  methodCounts: Record<string, number>;
  scopedMatchRate: number;
  programScopedMatchRate: number;
  promotedByTeamEvidence: number;
  blockedAmbiguity: number;
  emptyProvisionalRoster: number;
  suppressedAutoMatches: number;
  candidateOnlySuggestions: number;
  suppressedAutoMatchesByMethod: Record<string, number>;
  suppressedWeakCandidates: number;
  reviewCandidatesShown: number;
  reviewCandidatesHidden: number;
  ambiguityBreakdown: {
    sameTeam: number;
    sameProgram: number;
    differentProgram: number;
  };
};

export type PlayerMatchingPreview = {
  gameCount: number;
  uniquePlayers: number;
  diagnostics: PlayerMatchingPreviewDiagnostics;
  players: PlayerMatchPreviewRow[];
};

export type UrlImportPlayerMapping = {
  playerKey: string;
  importedName: string;
  cleanedName: string;
  teamLabel: string;
  mappedTeamId?: string | null;
  mappedTeamName?: string | null;
  action: "mapped_existing" | "create_on_import";
  playerId?: string;
  playerName?: string;
};

export type SubmissionPackageDraft = {
  league: {
    name: string;
    ageGroup: string;
    gender?: "BOYS" | "GIRLS";
    organizerName?: string;
    city?: string;
    region?: string;
  };
  season: {
    name: string;
    seasonYear: number;
  };
  games: SubmissionGameDraft[];
  _provenance?: {
    provider: StatsImportProviderId;
    sourceUrls: string[];
    importedAt: string;
    externalCompetitionId?: string;
  };
};

export type ScoreReconciliationMetadata = {
  applied: true;
  reason: "schedule_authority_over_empty_feed" | "schedule_authority_over_inaccessible_feed";
  matchId: string;
  scheduleScore: { home: number; away: number };
  feedScore?: { home: number; away: number };
  feedCompleteness?: "empty" | "partial" | "complete";
  feedHttpStatus?: number;
  reconciledAt: string;
};

export type SubmissionGameDraft = {
  gameNumber: string;
  gameDate: string;
  game: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  city: string;
  region: string;
  sourceName: string;
  players: Record<string, string | number>[];
  teamResultOnly?: boolean;
  defaultWin?: boolean;
  note?: string;
  _reconciliation?: ScoreReconciliationMetadata;
};
