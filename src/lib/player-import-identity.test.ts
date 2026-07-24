import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlayerGender, type PrismaClient } from "@prisma/client";

import { resolvePlayerForImport } from "@/lib/player-import-identity";

function clientWithExternalAlias(player: {
  id: string;
  displayName: string;
  gender: PlayerGender;
  deletedAt: Date | null;
}) {
  return {
    playerExternalAlias: {
      findUnique: async () => ({ player }),
    },
    player: {
      findMany: async () => {
        throw new Error("displayName lookup should not run after an external alias match");
      },
    },
    playerAlias: {
      findUnique: async () => null,
    },
  } as unknown as PrismaClient;
}

describe("resolvePlayerForImport external mappings", () => {
  it("uses a saved team-scoped mapping before an exact display-name lookup", async () => {
    const result = await resolvePlayerForImport(
      clientWithExternalAlias({
        id: "canonical-player",
        displayName: "Xyriel Macahipay",
        gender: PlayerGender.BOYS,
        deletedAt: null,
      }),
      {
        cleanedName: "Xyriel Luis Macahipay",
        gender: PlayerGender.BOYS,
        externalIdentity: { provider: "statshub-v1", teamLabel: "Junior MPBL Team" },
      },
    );

    assert.deepEqual(result, {
      action: "reuse",
      playerId: "canonical-player",
      displayName: "Xyriel Macahipay",
      via: "externalAlias",
    });
  });

  it("blocks a saved mapping when its player gender conflicts with the submission", async () => {
    const result = await resolvePlayerForImport(
      clientWithExternalAlias({
        id: "wrong-player",
        displayName: "Same Name",
        gender: PlayerGender.GIRLS,
        deletedAt: null,
      }),
      {
        cleanedName: "Same Name",
        gender: PlayerGender.BOYS,
        externalIdentity: { provider: "statshub-v1", teamLabel: "Boys Team" },
      },
    );

    assert.equal(result.action, "blocked");
    assert.match(result.action === "blocked" ? result.reason : "", /gender mismatch/i);
  });
});