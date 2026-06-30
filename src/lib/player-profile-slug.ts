import "server-only";

import { slugify } from "./format";
import { prisma } from "./prisma";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function derivePlayerProfileSlug(displayName: string) {
  return slugify(displayName);
}

export async function resolveUniqueProfileSlugForStorage(displayName: string, playerId: string) {
  const profileSlug = derivePlayerProfileSlug(displayName);
  if (!profileSlug) return null;

  const collision = await prisma.player.findFirst({
    where: {
      profileSlug,
      deletedAt: null,
      NOT: { id: playerId },
    },
    select: { id: true },
  });

  return collision ? null : profileSlug;
}

async function resolvePlayerIdBySlugLegacyScan(slug: string) {
  const candidates = await prisma.player.findMany({
    where: {
      deletedAt: null,
      profileSlug: null,
    },
    select: {
      id: true,
      displayName: true,
    },
  });
  const matches = candidates.filter((player) => derivePlayerProfileSlug(player.displayName) === slug);
  return matches.length === 1 ? matches[0].id : null;
}

export async function resolvePlayerIdBySlug(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  if (uuidPattern.test(normalizedSlug)) {
    const exactPlayer = await prisma.player.findFirst({
      where: {
        id: normalizedSlug,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (exactPlayer) return exactPlayer.id;
  }

  const indexed = await prisma.player.findFirst({
    where: {
      profileSlug: normalizedSlug,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (indexed) return indexed.id;

  return resolvePlayerIdBySlugLegacyScan(normalizedSlug);
}

/** @internal Benchmark-only full-table scan used before Phase 2. */
export async function resolvePlayerIdBySlugUncachedScan(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  if (uuidPattern.test(normalizedSlug)) {
    const exactPlayer = await prisma.player.findFirst({
      where: {
        id: normalizedSlug,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (exactPlayer) return exactPlayer.id;
  }

  const candidates = await prisma.player.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      displayName: true,
    },
  });
  const matches = candidates.filter((player) => derivePlayerProfileSlug(player.displayName) === normalizedSlug);

  return matches.length === 1 ? matches[0].id : null;
}
