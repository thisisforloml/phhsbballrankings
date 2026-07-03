import type { DuplicateDetectionCorpus } from "@/lib/admin/player-duplicate-detection/build-corpus";
import { collectIndexedCandidateIds } from "@/lib/admin/player-duplicate-detection/build-corpus";
import {
  passesDuplicatePrefilter,
  scoreDuplicatePair,
  toDuplicateCandidate,
} from "@/lib/admin/player-duplicate-detection/score-duplicate-pair";
import type {
  PlayerDuplicateCandidate,
  PlayerDuplicateCandidateReport,
} from "@/lib/admin/player-duplicate-detection/types";

export function findDuplicateCandidatesForPlayer(
  targetPlayerId: string,
  corpus: DuplicateDetectionCorpus,
  options?: { minConfidence?: number },
): PlayerDuplicateCandidateReport {
  const minConfidence = options?.minConfidence ?? 0;
  const target = corpus.playersById.get(targetPlayerId);
  if (!target) {
    return { targetPlayerId, candidateCount: 0, candidates: [] };
  }

  const indexedIds = collectIndexedCandidateIds(target, corpus.index);
  const candidates: PlayerDuplicateCandidate[] = [];

  for (const candidateId of indexedIds) {
    const candidate = corpus.playersById.get(candidateId);
    if (!candidate) continue;
    if (!passesDuplicatePrefilter(target, candidate)) continue;

    const scored = scoreDuplicatePair(target, candidate);
    if (!scored || scored.confidence < minConfidence) continue;

    candidates.push(toDuplicateCandidate(candidate, scored));
  }

  candidates.sort(
    (left, right) =>
      right.confidence - left.confidence ||
      left.player.displayName.localeCompare(right.player.displayName),
  );

  return {
    targetPlayerId,
    candidateCount: candidates.length,
    candidates,
  };
}
