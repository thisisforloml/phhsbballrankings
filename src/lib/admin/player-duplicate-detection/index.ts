export type { DuplicateDetectionCorpus, DuplicateDetectionIndex } from "@/lib/admin/player-duplicate-detection/build-corpus";
export {
  buildDuplicateDetectionCorpus,
  buildDuplicateDetectionIndex,
  collectIndexedCandidateIds,
  mapRawDuplicatePlayerRow,
} from "@/lib/admin/player-duplicate-detection/build-corpus";
export { confidenceBandForScore } from "@/lib/admin/player-duplicate-detection/confidence-band";
export { findDuplicateCandidatesForPlayer } from "@/lib/admin/player-duplicate-detection/find-duplicate-candidates";
export {
  displayNameSimilarity,
  jaroWinklerSimilarity,
  levenshteinSimilarity,
  normalizeDuplicateName,
} from "@/lib/admin/player-duplicate-detection/name-similarity";
export {
  passesDuplicatePrefilter,
  scoreDuplicatePair,
  toDuplicateCandidate,
} from "@/lib/admin/player-duplicate-detection/score-duplicate-pair";
export type {
  DuplicateConfidenceBand,
  DuplicatePlayerRecord,
  DuplicatePlayerSummary,
  DuplicateSignal,
  PlayerDuplicateCandidate,
  PlayerDuplicateCandidateReport,
} from "@/lib/admin/player-duplicate-detection/types";
