import { RankingScope, VerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getActivePolicyVersionId } from "@/lib/ratings/active-formula";

const officialVerificationStatuses: VerificationStatus[] = [
  VerificationStatus.VERIFIED,
  VerificationStatus.SUBMITTED,
];

export type PlayerIntegrityContext = NonNullable<Awaited<ReturnType<typeof loadPlayerIntegrityContext>>>;

export async function loadPlayerIntegrityContext(playerId: string) {
  const activePolicyVersionId = getActivePolicyVersionId();

  const [player, lastAudit] = await Promise.all([
    prisma.player.findFirst({
      where: { id: playerId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        gender: true,
        photoUrl: true,
        heightCm: true,
        position: true,
        schoolOverride: true,
        ageGroupOverride: true,
        classYearOverride: true,
        hometown: true,
        region: true,
        city: true,
        profileSlug: true,
        currentProgramId: true,
        commitmentStatus: true,
        committedUniversity: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        currentProgram: {
          select: {
            id: true,
            fullName: true,
            abbreviation: true,
            programRole: true,
            deletedAt: true,
            parentProgram: {
              select: {
                fullName: true,
                programRole: true,
              },
            },
          },
        },
        currentRatings: {
          where: { policyVersionId: activePolicyVersionId },
          select: {
            id: true,
            ageGroup: true,
            adjustedRating: true,
            starRating: true,
            verifiedGameCount: true,
            computedAt: true,
            policyVersionId: true,
            formulaVersion: {
              select: {
                versionNumber: true,
                description: true,
              },
            },
          },
          orderBy: { ageGroup: "desc" },
        },
        rankingRows: {
          where: { snapshot: { scope: RankingScope.NATIONAL } },
          select: {
            rank: true,
            rating: true,
            starRating: true,
            verifiedGameCount: true,
            snapshot: {
              select: {
                weekOf: true,
                createdAt: true,
                ageGroup: true,
                gender: true,
                formulaVersion: {
                  select: {
                    versionNumber: true,
                    description: true,
                  },
                },
              },
            },
          },
          orderBy: { snapshot: { weekOf: "desc" } },
          take: 10,
        },
        gameStats: {
          where: { deletedAt: null, game: { deletedAt: null } },
          select: {
            team: {
              select: {
                id: true,
                name: true,
                programId: true,
                program: {
                  select: {
                    id: true,
                    fullName: true,
                    programRole: true,
                    deletedAt: true,
                  },
                },
              },
            },
            game: {
              select: {
                id: true,
                gameDate: true,
                verificationStatus: true,
                submissionType: true,
                season: {
                  select: {
                    name: true,
                    deletedAt: true,
                    league: {
                      select: {
                        id: true,
                        name: true,
                        tier: true,
                        deletedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { game: { gameDate: "desc" } },
        },
        _count: {
          select: {
            programHistory: { where: { changeType: "TRANSFER" } },
            rankingRows: { where: { snapshot: { scope: RankingScope.NATIONAL } } },
          },
        },
      },
    }),
    prisma.auditLog.findFirst({
      where: { entityType: "PLAYER", entityId: playerId },
      orderBy: { createdAt: "desc" },
      select: {
        action: true,
        createdAt: true,
        user: { select: { name: true, username: true } },
      },
    }),
  ]);

  if (!player) return null;

  return { player, lastAudit, activePolicyVersionId };
}

export function isOfficialVerifiedGame(verificationStatus: VerificationStatus) {
  return officialVerificationStatuses.includes(verificationStatus);
}
