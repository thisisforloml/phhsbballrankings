import "server-only";

import { VerificationStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { prisma } from "./prisma";
import type { PublicTrustMeta } from "./public-rankings-coverage";

async function loadPublicTrustMeta(): Promise<PublicTrustMeta> {
  const latestGame = await prisma.game.findFirst({
    where: {
      deletedAt: null,
      verificationStatus: { in: [VerificationStatus.SUBMITTED, VerificationStatus.VERIFIED] },
      season: { deletedAt: null, league: { deletedAt: null } }
    },
    orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
    select: { gameDate: true }
  });
  const latestSnapshot = await prisma.rankingSnapshot.findFirst({
    orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
    select: { weekOf: true, createdAt: true }
  });

  const candidates = [
    latestGame?.gameDate,
    latestSnapshot?.weekOf,
    latestSnapshot?.createdAt
  ].filter((value): value is Date => value instanceof Date);

  const latest = candidates.reduce<Date | null>((current, candidate) => {
    if (!current || candidate > current) return candidate;
    return current;
  }, null);

  return { lastUpdated: latest?.toISOString() ?? null };
}

const getCachedPublicTrustMeta = unstable_cache(loadPublicTrustMeta, ["public-trust-meta"], {
  revalidate: 300
});

export const getPublicTrustMeta = cache(getCachedPublicTrustMeta);
