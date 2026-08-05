import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "../src/lib/prisma";
import { regenerateNationalRankingSnapshots } from "../src/lib/rankings/national-snapshot-regeneration";
import { FORMULA_V1_VERSION_NUMBER } from "../src/lib/ratings/formula-constants";
import { buildFormulaV33Ecosystem } from "../src/lib/ratings/formula-v3/ecosystem";
import { FORMULA_V3_POLICY_ID, FORMULA_V3_VERSION_NUMBER } from "../src/lib/ratings/formula-v3/types";
import { recomputeFormulaV33Ratings } from "../src/lib/ratings/recompute-formula-v33";

const execute = process.argv.includes("--execute");
const validateOnly = process.argv.includes("--validate");
const reportsDir = join(process.cwd(), "scripts", "reports");
const reportPath = join(reportsDir, "formula-v33-production-promotion.json");

function expected(name: string) {
  const prefix = `--expected-${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  return raw ? Number(raw) : null;
}

function digest(values: string[]) {
  return createHash("sha256").update([...values].sort().join("\n")).digest("hex");
}

async function protectedCounts() {
  const v1 = await prisma.formulaVersion.findUnique({
    where: { versionNumber: FORMULA_V1_VERSION_NUMBER },
    select: { id: true }
  });
  const [games, gameStats, players, programs, teams, v1Scores, v1Ratings] = await Promise.all([
    prisma.game.count(),
    prisma.gameStat.count(),
    prisma.player.count(),
    prisma.program.count(),
    prisma.team.count(),
    v1 ? prisma.gamePerformanceScore.count({ where: { formulaVersionId: v1.id } }) : 0,
    v1 ? prisma.playerRating.count({ where: { formulaVersionId: v1.id } }) : 0
  ]);
  return { games, gameStats, players, programs, teams, v1Scores, v1Ratings };
}

async function main() {
  if (execute && validateOnly) throw new Error("Choose either --execute or --validate.");
  const evaluationDate = new Date();
  const ecosystem = await buildFormulaV33Ecosystem(evaluationDate);
  const ratingKeys = ecosystem.playerCandidate.ratings.map((row) => `${row.playerId}|${row.ageGroup}`);
  const uniqueRatingKeys = new Set(ratingKeys);
  const lowConfidence = ecosystem.competitionProfiles.filter((profile) => profile.confidence < 0.45);
  const gates = {
    officialEvidenceOnly: ecosystem.loaded.rows.length === ecosystem.playerCandidate.games.length,
    noDuplicatePlayerBoards: uniqueRatingKeys.size === ratingKeys.length,
    allCompetitionProfilesConfident: lowConfidence.length === 0,
    noArtificialCeiling: ecosystem.playerCandidate.ratings.every((row) => row.adjustedRating !== 89.99),
    warningsClear: ecosystem.loaded.warnings.length === 0
  };
  const ready = Object.values(gates).every(Boolean);
  const counts = {
    performanceScores: ecosystem.playerCandidate.games.length,
    playerRatings: ecosystem.playerCandidate.ratings.length,
    competitionPools: ecosystem.competitionProfiles.length
  };
  const manifest = {
    generatedAt: evaluationDate.toISOString(),
    mode: execute ? "execute" : validateOnly ? "validate" : "dry-run",
    ready,
    gates,
    counts,
    hashes: {
      gameStatIds: digest(ecosystem.playerCandidate.games.map((row) => row.gameStatId)),
      ratingKeys: digest(ratingKeys)
    },
    lowConfidence: lowConfidence.map((row) => row.label),
    policies: { formulaVersion: FORMULA_V3_VERSION_NUMBER, policyVersionId: FORMULA_V3_POLICY_ID }
  };

  if (!ready) throw new Error(`Formula v3.3 promotion gates failed: ${JSON.stringify(manifest.gates)}`);

  if (!execute) {
    const version = await prisma.formulaVersion.findUnique({
      where: { versionNumber: FORMULA_V3_VERSION_NUMBER },
      select: { id: true, isPublic: true }
    });
    const stored = version ? await Promise.all([
      prisma.gamePerformanceScore.count({ where: { formulaVersionId: version.id, deletedAt: null } }),
      prisma.playerRating.count({ where: { formulaVersionId: version.id, policyVersionId: FORMULA_V3_POLICY_ID } }),
      prisma.rankingSnapshot.count({ where: { formulaVersionId: version.id, policyVersionId: FORMULA_V3_POLICY_ID } })
    ]) : [0, 0, 0];
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ ...manifest, stored: { version, scores: stored[0], ratings: stored[1], snapshots: stored[2] } }, null, 2));
    console.log(JSON.stringify({ ...manifest, stored: { version, scores: stored[0], ratings: stored[1], snapshots: stored[2] }, reportPath }, null, 2));
    return;
  }

  const expectedScores = expected("scores");
  const expectedRatings = expected("ratings");
  if (expectedScores === null || expectedRatings === null) {
    throw new Error("Execute requires --expected-scores and --expected-ratings from the latest dry-run.");
  }
  if (expectedScores !== counts.performanceScores || expectedRatings !== counts.playerRatings) {
    throw new Error(`Scope changed. Expected ${expectedScores}/${expectedRatings}; current ${counts.performanceScores}/${counts.playerRatings}.`);
  }

  const before = await protectedCounts();
  const recompute = await recomputeFormulaV33Ratings({ execute: true, evaluationDate });
  const snapshots = await regenerateNationalRankingSnapshots({
    formulaVersionNumber: FORMULA_V3_VERSION_NUMBER,
    policyVersionId: FORMULA_V3_POLICY_ID,
    evaluationDate
  });
  if (!recompute.formulaVersionId) throw new Error("Formula v3.3 version was not created.");
  await prisma.$transaction([
    prisma.formulaVersion.updateMany({ where: { id: { not: recompute.formulaVersionId } }, data: { isPublic: false } }),
    prisma.formulaVersion.update({ where: { id: recompute.formulaVersionId }, data: { isPublic: true } })
  ]);
  const after = await protectedCounts();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`Protected counts changed: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }

  const result = { ...manifest, recompute, snapshots, protectedCounts: after };
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
