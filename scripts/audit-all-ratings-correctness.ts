/**
 * Full correctness audit: stored production ratings vs fresh tier-normalized v1 recompute.
 * Usage: npx tsx scripts/audit-all-ratings-correctness.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getActivePlayerFormulaConfig } from "../src/lib/ratings/active-formula";
import {
  FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
  FORMULA_V1_POLICY_ID,
  FORMULA_V1_VERSION_NUMBER
} from "../src/lib/ratings/formula-constants";
import { FORMULA_VNEXT_POLICY_ID } from "../src/lib/ratings/formula-vnext";
import {
  buildTierNormalizedRatingTargets,
  loadTierNormalizedGpsGames,
  recomputeTierNormalizedV1Ratings
} from "../src/lib/ratings/tier-normalized-v1";
import { findV1LimboCases } from "../src/lib/ratings/home-board-v1";

const reportsDir = join(process.cwd(), "scripts", "reports");
const REVIEW_IDS = {
  lucas: "7d4bf62d-ee82-4ec7-87d1-6b2ea92ce5db",
  jude: "f577b054-2284-4433-8bb7-2dbdc541ec4e",
  xyriel: "cce0c1c6-0170-45ed-bb28-6b7382821e82"
};

type DriftRow = {
  playerId: string;
  ageGroup: AgeGroup;
  stored: number;
  expected: number;
  delta: number;
  verifiedGameCount: number;
};

async function main() {
  const active = getActivePlayerFormulaConfig();
  const formulaVersion = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  if (!formulaVersion) throw new Error("Formula v1 not found.");

  const dryRun = await recomputeTierNormalizedV1Ratings({ execute: false });
  const expectedTargets = dryRun.targets;
  const expectedMap = new Map(
    expectedTargets.map((t) => [`${t.playerId}|${t.ageGroup}`, t])
  );

  const stored = await prisma.playerRating.findMany({
    where: {
      formulaVersionId: formulaVersion.id,
      policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID
    },
    select: {
      playerId: true,
      ageGroup: true,
      adjustedRating: true,
      verifiedGameCount: true,
      player: { select: { displayName: true } }
    }
  });

  const storedMap = new Map(stored.map((r) => [`${r.playerId}|${r.ageGroup}`, r]));

  const drift: DriftRow[] = [];
  const missingStored: Array<{ playerId: string; ageGroup: AgeGroup; expected: number; displayName?: string }> = [];
  const orphanStored: Array<{ playerId: string; ageGroup: AgeGroup; stored: number; displayName: string }> = [];

  for (const target of expectedTargets) {
    const key = `${target.playerId}|${target.ageGroup}`;
    const row = storedMap.get(key);
    if (!row) {
      missingStored.push({
        playerId: target.playerId,
        ageGroup: target.ageGroup,
        expected: target.adjustedRating
      });
      continue;
    }
    const storedRating = Number(row.adjustedRating);
    if (Math.abs(storedRating - target.adjustedRating) >= 0.01) {
      drift.push({
        playerId: target.playerId,
        ageGroup: target.ageGroup,
        stored: storedRating,
        expected: target.adjustedRating,
        delta: Number((target.adjustedRating - storedRating).toFixed(2)),
        verifiedGameCount: target.verifiedGameCount
      });
    }
  }

  for (const row of stored) {
    const key = `${row.playerId}|${row.ageGroup}`;
    if (!expectedMap.has(key)) {
      orphanStored.push({
        playerId: row.playerId,
        ageGroup: row.ageGroup,
        stored: Number(row.adjustedRating),
        displayName: row.player.displayName
      });
    }
  }

  const limbo = await findV1LimboCases(new Date(), FORMULA_TIER_NORMALIZED_V1_POLICY_ID);
  const limboMissing = limbo.filter((c) => !storedMap.has(`${c.playerId}|${c.homeBracket}`));

  const [tierCount, prodCount, vnextCount] = await Promise.all([
    prisma.playerRating.count({
      where: { formulaVersionId: formulaVersion.id, policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID }
    }),
    prisma.playerRating.count({
      where: { formulaVersionId: formulaVersion.id, policyVersionId: FORMULA_V1_POLICY_ID }
    }),
    prisma.playerRating.count({
      where: { formulaVersionId: formulaVersion.id, policyVersionId: FORMULA_VNEXT_POLICY_ID }
    })
  ]);

  const reviewPlayers = await prisma.player.findMany({
    where: { id: { in: Object.values(REVIEW_IDS) } },
    select: { id: true, displayName: true }
  });
  const review = reviewPlayers.map((p) => {
    const u19Stored = stored.find((r) => r.playerId === p.id && r.ageGroup === AgeGroup.U19);
    const u16Stored = stored.find((r) => r.playerId === p.id && r.ageGroup === AgeGroup.U16);
    const u19Expected = expectedMap.get(`${p.id}|${AgeGroup.U19}`);
    const u16Expected = expectedMap.get(`${p.id}|${AgeGroup.U16}`);
    return {
      displayName: p.displayName,
      u19: u19Stored
        ? {
            stored: Number(u19Stored.adjustedRating),
            expected: u19Expected?.adjustedRating ?? null,
            delta: u19Expected ? Number((u19Expected.adjustedRating - Number(u19Stored.adjustedRating)).toFixed(2)) : null
          }
        : null,
      u16: u16Stored
        ? {
            stored: Number(u16Stored.adjustedRating),
            expected: u16Expected?.adjustedRating ?? null,
            delta: u16Expected ? Number((u16Expected.adjustedRating - Number(u16Stored.adjustedRating)).toFixed(2)) : null
          }
        : null
    };
  });

  const tierGames = await loadTierNormalizedGpsGames();
  const leagues = await prisma.$queryRaw<Array<{ tier: number; count: number }>>`
    SELECT l.tier, COUNT(DISTINCT l.id)::int AS count
    FROM leagues l
    WHERE l."deletedAt" IS NULL
    GROUP BY l.tier
    ORDER BY l.tier
  `;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "read-only-audit",
    authoritativeFormula: {
      policyVersionId: FORMULA_TIER_NORMALIZED_V1_POLICY_ID,
      activeConfig: active,
      formulaModeEnv: process.env.PLAYER_RATING_FORMULA_MODE ?? null,
      notApprovedForProduction: FORMULA_VNEXT_POLICY_ID
    },
    inventory: {
      expectedTargetCount: expectedTargets.length,
      storedTierNormalizedCount: tierCount,
      storedLegacyProductionCount: prodCount,
      storedVnextShadowCount: vnextCount,
      gpsGameRows: tierGames.length,
      leagueTierDistribution: leagues
    },
    correctness: {
      matching: expectedTargets.length - drift.length - missingStored.length,
      driftCount: drift.length,
      missingStoredCount: missingStored.length,
      orphanStoredCount: orphanStored.length,
      limboNeedingHomeBoard: limboMissing.length,
      limboTotal: limbo.length
    },
    topDrift: drift
      .map((row) => ({
        ...row,
        displayName: stored.find((s) => s.playerId === row.playerId)?.player.displayName ?? row.playerId
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 30),
    reviewPlayers: review,
    recommendation:
      active.policyVersionId !== FORMULA_TIER_NORMALIZED_V1_POLICY_ID
        ? "BLOCKED: active policy is not tier-normalized v1"
        : drift.length === 0 && missingStored.length === 0 && limboMissing.length === 0
          ? "PASS: stored ratings match fresh tier-normalized recompute"
          : "RECOMPUTE_REQUIRED: run tier-normalized recompute + home-board projection + snapshot regeneration"
  };

  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, "all-ratings-correctness-audit.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(JSON.stringify(report.correctness, null, 2));
  console.log(`Recommendation: ${report.recommendation}`);
  if (report.reviewPlayers.length) console.log("Review players:", JSON.stringify(report.reviewPlayers, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
