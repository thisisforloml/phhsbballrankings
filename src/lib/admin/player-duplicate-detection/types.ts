export type DuplicateConfidenceBand = "Almost Certain" | "Very Likely" | "Possible" | "Low Confidence";

export type DuplicateSignal = {
  kind: "match" | "conflict";
  label: string;
  detail: string;
  weight: number;
};

export type DuplicatePlayerSummary = {
  playerId: string;
  displayName: string;
  gender: string;
  birthDate: string | null;
  heightCm: number | null;
  currentProgramName: string | null;
  parentGroupName: string | null;
  verifiedGameCount: number;
};

export type PlayerDuplicateCandidate = {
  player: DuplicatePlayerSummary;
  confidence: number;
  band: DuplicateConfidenceBand;
  matchingSignals: string[];
  conflictingSignals: string[];
  explanation: string;
};

export type PlayerDuplicateCandidateReport = {
  targetPlayerId: string;
  candidateCount: number;
  candidates: PlayerDuplicateCandidate[];
};

export type DuplicatePlayerRecord = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: Date | null;
  heightCm: number | null;
  photoUrl: string | null;
  currentProgramId: string | null;
  currentProgramName: string | null;
  parentGroupProgramId: string | null;
  parentGroupName: string | null;
  aliases: string[];
  externalIds: Array<{ provider: string; label: string }>;
  teamIds: Set<string>;
  leagueIds: Set<string>;
  seasonKeys: Set<string>;
  gameIds: Set<string>;
  dominantHand: string | null;
  portraitHash: string | null;
};
