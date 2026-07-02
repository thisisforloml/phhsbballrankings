import { prisma } from "@/lib/prisma";

export type AdminDataHealthSignals = {
  missingBirthDate: number;
  missingPhoto: number;
  missingPosition: number;
  duplicateCandidates: number;
  programsNeedingReview: number;
};

const DATA_HEALTH_CACHE_MS = 5 * 60 * 1000;

let dataHealthSignalsCache: { value: AdminDataHealthSignals; loadedAt: number } | null = null;

export function clearAdminDataHealthSignalsCache() {
  dataHealthSignalsCache = null;
}

async function loadAdminDataHealthSignalsUncached(): Promise<AdminDataHealthSignals> {
  const [missingBirthDate, missingPhoto, missingPosition, duplicateCandidates, programsNeedingReview] =
    await Promise.all([
      prisma.player.count({ where: { deletedAt: null, birthDate: null } }),
      prisma.player.count({ where: { deletedAt: null, photoUrl: null } }),
      prisma.player.count({ where: { deletedAt: null, position: null } }),
      prisma.player.count({
        where: {
          deletedAt: null,
          OR: [{ firstName: { contains: " ", mode: "insensitive" } }],
        },
      }),
      prisma.program.count({ where: { deletedAt: null, teams: { some: { deletedAt: null } } } }),
    ]);

  return {
    missingBirthDate,
    missingPhoto,
    missingPosition,
    duplicateCandidates,
    programsNeedingReview,
  };
}

export async function loadAdminDataHealthSignals(options?: { bypassCache?: boolean }) {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    dataHealthSignalsCache &&
    now - dataHealthSignalsCache.loadedAt < DATA_HEALTH_CACHE_MS
  ) {
    return dataHealthSignalsCache.value;
  }

  const value = await loadAdminDataHealthSignalsUncached();
  dataHealthSignalsCache = { value, loadedAt: now };
  return value;
}
