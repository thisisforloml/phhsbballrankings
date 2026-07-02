import { prisma } from "@/lib/prisma";
import { activeSubmissionWhere } from "@/lib/submission-lifecycle";

export type AdminOpsPageData = {
  missingBirthDate: number;
  missingPhoto: number;
  missingPosition: number;
  playerCount: number;
  submissionOpen: number;
  auditLogs: Array<{
    id: string;
    entityType: string;
    action: string;
    reason: string | null;
    createdAt: Date;
    user: { name: string | null; username: string } | null;
  }>;
};

const OPS_PAGE_CACHE_MS = 5 * 60 * 1000;

let opsPageCache: { value: AdminOpsPageData; loadedAt: number } | null = null;

export function clearAdminOpsPageCache() {
  opsPageCache = null;
}

async function loadAdminOpsPageDataUncached(): Promise<AdminOpsPageData> {
  const [missingBirthDate, missingPhoto, missingPosition, playerCount, submissionOpen, auditLogs] =
    await Promise.all([
      prisma.player.count({ where: { deletedAt: null, birthDate: null } }),
      prisma.player.count({ where: { deletedAt: null, photoUrl: null } }),
      prisma.player.count({ where: { deletedAt: null, position: null } }),
      prisma.player.count({ where: { deletedAt: null } }),
      prisma.submission.count({
        where: {
          ...activeSubmissionWhere,
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, username: true } } },
      }),
    ]);

  return {
    missingBirthDate,
    missingPhoto,
    missingPosition,
    playerCount,
    submissionOpen,
    auditLogs,
  };
}

export async function loadAdminOpsPageData(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (!options?.bypassCache && opsPageCache && now - opsPageCache.loadedAt < OPS_PAGE_CACHE_MS) {
    return opsPageCache.value;
  }

  const value = await loadAdminOpsPageDataUncached();
  opsPageCache = { value, loadedAt: now };
  return value;
}
