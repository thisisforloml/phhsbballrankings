import { VerificationStatus } from "@prisma/client";

import {
  buildDuplicateDetectionCorpus,
  collectIndexedCandidateIds,
  type DuplicateDetectionCorpus,
  mapRawDuplicatePlayerRow,
} from "@/lib/admin/player-duplicate-detection/build-corpus";
import { findDuplicateCandidatesForPlayer } from "@/lib/admin/player-duplicate-detection/find-duplicate-candidates";
import {
  passesDuplicatePrefilter,
  scoreDuplicatePair,
  toDuplicateCandidate,
} from "@/lib/admin/player-duplicate-detection/score-duplicate-pair";
import type { PlayerDuplicateCandidateReport } from "@/lib/admin/player-duplicate-detection/types";
import { prisma } from "@/lib/prisma";

const officialVerificationStatuses: VerificationStatus[] = [
  VerificationStatus.VERIFIED,
  VerificationStatus.SUBMITTED,
];
const CORPUS_CACHE_MS = 5 * 60 * 1000;
let duplicateDetectionCorpusCache: { value: DuplicateDetectionCorpus; loadedAt: number } | null = null;

export function clearDuplicateDetectionCorpusCache() {
  duplicateDetectionCorpusCache = null;
}

const duplicatePlayerSelect = {
  id: true,
  displayName: true,
  firstName: true,
  lastName: true,
  gender: true,
  birthDate: true,
  heightCm: true,
  photoUrl: true,
  currentProgramId: true,
  currentProgram: {
    select: {
      id: true,
      fullName: true,
      programRole: true,
      deletedAt: true,
      parentProgram: { select: { id: true, fullName: true, programRole: true } },
    },
  },
  aliases: { select: { aliasName: true } },
  externalAliases: { select: { provider: true, normalizedExternalLabel: true } },
  gameStats: {
    where: {
      deletedAt: null,
      game: { deletedAt: null, verificationStatus: { in: officialVerificationStatuses } },
    },
    select: {
      teamId: true,
      gameId: true,
      game: {
        select: {
          id: true,
          season: { select: { name: true, league: { select: { id: true, name: true } } } },
        },
      },
    },
  },
} as const;

export async function loadDuplicateDetectionCorpus(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    duplicateDetectionCorpusCache &&
    now - duplicateDetectionCorpusCache.loadedAt < CORPUS_CACHE_MS
  ) {
    return duplicateDetectionCorpusCache.value;
  }

  const rows = await prisma.player.findMany({
    where: { deletedAt: null },
    select: duplicatePlayerSelect,
    orderBy: { displayName: "asc" },
  });
  const corpus = buildDuplicateDetectionCorpus(rows.map((row) => mapRawDuplicatePlayerRow(row)));
  duplicateDetectionCorpusCache = { value: corpus, loadedAt: now };
  return corpus;
}

export async function loadPlayerDuplicateCandidates(
  playerId: string,
  options?: { bypassCache?: boolean },
): Promise<PlayerDuplicateCandidateReport> {
  const corpus = await loadDuplicateDetectionCorpus(options);
  return findDuplicateCandidatesForPlayer(playerId, corpus);
}

export type PlayerDuplicateReviewPair = {
  pairId: string;
  left: {
    playerId: string;
    displayName: string;
    gender: string;
    birthDate: string | null;
    heightCm: number | null;
    currentProgramName: string | null;
    parentGroupName: string | null;
    verifiedGameCount: number;
  };
  right: PlayerDuplicateCandidateReport["candidates"][number]["player"];
  confidence: number;
  band: PlayerDuplicateCandidateReport["candidates"][number]["band"];
  matchingSignals: string[];
  conflictingSignals: string[];
  explanation: string;
};

/** Build each name-anchored pair once; contextual evidence only adjusts certainty. */
export async function loadAllPlayerDuplicateCandidates(options?: {
  bypassCache?: boolean;
  minConfidence?: number;
}): Promise<PlayerDuplicateReviewPair[]> {
  const corpus = await loadDuplicateDetectionCorpus({ bypassCache: options?.bypassCache });
  const pairs: PlayerDuplicateReviewPair[] = [];
  const minConfidence = options?.minConfidence ?? 60;

  for (const target of corpus.players) {
    for (const candidateId of collectIndexedCandidateIds(target, corpus.index)) {
      if (target.id.localeCompare(candidateId) >= 0) continue;
      const candidateRecord = corpus.playersById.get(candidateId);
      if (!candidateRecord || !passesDuplicatePrefilter(target, candidateRecord)) continue;
      const scored = scoreDuplicatePair(target, candidateRecord);
      if (!scored || scored.confidence < minConfidence) continue;
      const candidate = toDuplicateCandidate(candidateRecord, scored);

      pairs.push({
        pairId: `${target.id}:${candidateId}`,
        left: {
          playerId: target.id,
          displayName: target.displayName,
          gender: target.gender,
          birthDate: target.birthDate?.toISOString().slice(0, 10) ?? null,
          heightCm: target.heightCm,
          currentProgramName: target.currentProgramName,
          parentGroupName: target.parentGroupName,
          verifiedGameCount: target.gameIds.size,
        },
        right: candidate.player,
        confidence: candidate.confidence,
        band: candidate.band,
        matchingSignals: candidate.matchingSignals,
        conflictingSignals: candidate.conflictingSignals,
        explanation: candidate.explanation,
      });
    }
  }

  return pairs.sort(
    (left, right) =>
      right.confidence - left.confidence || left.left.displayName.localeCompare(right.left.displayName),
  );
}
