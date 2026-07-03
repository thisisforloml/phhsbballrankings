import { VerificationStatus } from "@prisma/client";

import {
  buildDuplicateDetectionCorpus,
  type DuplicateDetectionCorpus,
  mapRawDuplicatePlayerRow,
} from "@/lib/admin/player-duplicate-detection/build-corpus";
import { findDuplicateCandidatesForPlayer } from "@/lib/admin/player-duplicate-detection/find-duplicate-candidates";
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
      parentProgram: {
        select: {
          id: true,
          fullName: true,
          programRole: true,
        },
      },
    },
  },
  aliases: {
    select: { aliasName: true },
  },
  externalAliases: {
    select: {
      provider: true,
      normalizedExternalLabel: true,
    },
  },
  gameStats: {
    where: {
      deletedAt: null,
      game: {
        deletedAt: null,
        verificationStatus: { in: officialVerificationStatuses },
      },
    },
    select: {
      teamId: true,
      gameId: true,
      game: {
        select: {
          id: true,
          season: {
            select: {
              name: true,
              league: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
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

  const players = rows.map((row) => mapRawDuplicatePlayerRow(row));
  const corpus = buildDuplicateDetectionCorpus(players);
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
