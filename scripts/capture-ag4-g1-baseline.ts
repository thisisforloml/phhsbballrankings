/**
 * AG-4 W0 — read-only post-G1 baseline capture.
 * Usage: npx tsx scripts/capture-ag4-g1-baseline.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup } from "@prisma/client";
import { LAUNCH_POLICY_V1_ID } from "../src/lib/eligibility";
import { getEffectiveClassYear } from "../src/lib/ranking-eligibility";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import { getLatestNationalRankings, type NationalRankingRow } from "../src/lib/rankings";
import { prisma } from "../src/lib/prisma";

const AUDIT_DIR = join(process.cwd(), "docs", "planning", "audits");
const CAPTURED_AT = new Date().toISOString();

type BoardPlayerSummary = {
  playerId: string;
  displayName: string;
  boardRank: number;
  poolRank: number;
  rating: number;
  verifiedGameCount: number;
  effectiveClassYear: number | null;
  classYearOverride: number | null;
  hasBirthDate: boolean;
  verdict: string;
  precedenceRule: string;
};

type GenderBaseline = {
  gender: "Boys" | "Girls";
  boardSize: number;
  poolSize: number;
  formulaVersionId: string | null;
  snapshotWeekOf: string | null;
  verdictBreakdown: Record<string, number>;
  top10: BoardPlayerSummary[];
};

function histogram(rows: BoardPlayerSummary[]) {
  const buckets: Record<string, number> = {};
  for (const row of rows) {
    const key = row.effectiveClassYear === null ? "null" : String(row.effectiveClassYear);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(buckets).sort(([left], [right]) => {
      if (left === "null") return 1;
      if (right === "null") return -1;
      return Number(left) - Number(right);
    })
  );
}

function chipCandidates(histogramMap: Record<string, number>, minCount = 3) {
  return Object.entries(histogramMap)
    .filter(([year, count]) => year !== "null" && count >= minCount)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((left, right) => left.year - right.year);
}

function summarizeBoardRows(
  snapshotRows: NationalRankingRow[],
  boardRows: NationalRankingRow[],
  playerMeta: Map<string, { birthDate: Date | null; classYearOverride: number | null; displayName: string }>
): {
  summaries: BoardPlayerSummary[];
  verdictBreakdown: Record<string, number>;
} {
  const verdictBreakdown: Record<string, number> = {};
  for (const row of snapshotRows) {
    const verdict = row.eligibilityVerdict?.verdict ?? "MISSING";
    verdictBreakdown[verdict] = (verdictBreakdown[verdict] ?? 0) + 1;
  }

  const boardRankByPlayerId = Object.fromEntries(boardRows.map((row, index) => [row.playerId, index + 1]));
  const summaries = boardRows.map((row) => {
    const meta = playerMeta.get(row.playerId);
    const effectiveClassYear = getEffectiveClassYear(meta?.birthDate ?? null, meta?.classYearOverride ?? null);

    return {
      playerId: row.playerId,
      displayName: row.displayName,
      boardRank: boardRankByPlayerId[row.playerId] ?? 0,
      poolRank: row.rank,
      rating: row.rating,
      verifiedGameCount: row.verifiedGameCount,
      effectiveClassYear,
      classYearOverride: meta?.classYearOverride ?? null,
      hasBirthDate: Boolean(meta?.birthDate),
      verdict: row.eligibilityVerdict?.verdict ?? "MISSING",
      precedenceRule: row.eligibilityVerdict?.precedenceRule ?? "MISSING"
    };
  });

  return { summaries, verdictBreakdown };
}

async function main() {
  mkdirSync(AUDIT_DIR, { recursive: true });

  const rankings = await getLatestNationalRankings();
  const boysSnapshot = rankings.snapshotsByAge.U19.boys;
  const girlsSnapshot = rankings.snapshotsByAge.U19.girls;
  const boysBoard = getPublicBoardRows(boysSnapshot);
  const girlsBoard = getPublicBoardRows(girlsSnapshot);

  const playerIds = Array.from(
    new Set([...boysSnapshot.rows, ...girlsSnapshot.rows].map((row) => row.playerId))
  );

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, displayName: true, birthDate: true, classYearOverride: true, gender: true }
  });

  const u19RatingPool = await prisma.playerRating.findMany({
    where: { ageGroup: AgeGroup.U19, player: { deletedAt: null } },
    select: {
      playerId: true,
      verifiedGameCount: true,
      player: {
        select: { gender: true, birthDate: true, classYearOverride: true, displayName: true }
      }
    }
  });

  const playerMeta = new Map(
    players.map((player) => [
      player.id,
      { birthDate: player.birthDate, classYearOverride: player.classYearOverride, displayName: player.displayName }
    ])
  );

  const boys = summarizeBoardRows(boysSnapshot.rows, boysBoard, playerMeta);
  const girls = summarizeBoardRows(girlsSnapshot.rows, girlsBoard, playerMeta);

  const boysBaseline: GenderBaseline = {
    gender: "Boys",
    boardSize: boysBoard.length,
    poolSize: boysSnapshot.rows.length,
    formulaVersionId: boysSnapshot.formulaVersionId,
    snapshotWeekOf: boysSnapshot.weekOf,
    verdictBreakdown: boys.verdictBreakdown,
    top10: boys.summaries.slice(0, 10)
  };

  const girlsBaseline: GenderBaseline = {
    gender: "Girls",
    boardSize: girlsBoard.length,
    poolSize: girlsSnapshot.rows.length,
    formulaVersionId: girlsSnapshot.formulaVersionId,
    snapshotWeekOf: girlsSnapshot.weekOf,
    verdictBreakdown: girls.verdictBreakdown,
    top10: girls.summaries.slice(0, 10)
  };

  const nullClassRanked = [...boys.summaries, ...girls.summaries].filter((row) => row.effectiveClassYear === null);
  const classBuckets = {
    boys: histogram(boys.summaries),
    girls: histogram(girls.summaries),
    combined: histogram([...boys.summaries, ...girls.summaries])
  };

  const rankedWithKnownClass = [...boys.summaries, ...girls.summaries].filter((row) => row.effectiveClassYear !== null);
  const totalRanked = boys.summaries.length + girls.summaries.length;
  const rankedClassYearCoverage = totalRanked ? rankedWithKnownClass.length / totalRanked : 0;

  const u19PoolWithDob = u19RatingPool.filter((row) => row.player.birthDate !== null).length;
  const u19PoolDobCoverage = u19RatingPool.length ? u19PoolWithDob / u19RatingPool.length : 0;
  const overrideCount = u19RatingPool.filter((row) => row.player.classYearOverride !== null).length;

  const nonRankedOnBoard = [...boysSnapshot.rows, ...girlsSnapshot.rows].filter(
    (row) => row.eligibilityVerdict && row.eligibilityVerdict.verdict !== "RANKED"
  );

  const provisionalOffBoard = [...boysSnapshot.rows, ...girlsSnapshot.rows].filter(
    (row) => row.eligibilityVerdict?.verdict === "PROVISIONAL"
  ).length;

  const chipProposal = {
    minCountThreshold: 3,
    boys: chipCandidates(classBuckets.boys),
    girls: chipCandidates(classBuckets.girls),
    combined: chipCandidates(classBuckets.combined)
  };

  const manifest = {
    capturedAt: CAPTURED_AT,
    g1PolicyVersion: LAUNCH_POLICY_V1_ID,
    formulaVersionId: rankings.formulaVersionId,
    u19RatingPoolSize: u19RatingPool.length,
    u19PoolDobCoverage: Number(u19PoolDobCoverage.toFixed(4)),
    classYearOverrideCount: overrideCount,
    rankedBoardSize: { boys: boysBaseline.boardSize, girls: girlsBaseline.boardSize, total: totalRanked },
    rankedClassYearCoverage: Number(rankedClassYearCoverage.toFixed(4)),
    nullClassRankedCount: nullClassRanked.length,
    provisionalOffBoardCount: provisionalOffBoard,
    nonRankedVerdictInPool: nonRankedOnBoard.length,
    chipProposal
  };

  writeFileSync(join(AUDIT_DIR, "ag4-baseline-u19-boys-ranked-count.json"), JSON.stringify(boysBaseline, null, 2));
  writeFileSync(join(AUDIT_DIR, "ag4-baseline-u19-girls-ranked-count.json"), JSON.stringify(girlsBaseline, null, 2));
  writeFileSync(join(AUDIT_DIR, "ag4-baseline-top10-boys.json"), JSON.stringify(boysBaseline.top10, null, 2));
  writeFileSync(join(AUDIT_DIR, "ag4-baseline-top10-girls.json"), JSON.stringify(girlsBaseline.top10, null, 2));
  writeFileSync(
    join(AUDIT_DIR, "ag4-baseline-unknown-dob-ranked-set.json"),
    JSON.stringify(nullClassRanked, null, 2)
  );
  writeFileSync(join(AUDIT_DIR, "ag4-baseline-class-buckets.json"), JSON.stringify(classBuckets, null, 2));
  writeFileSync(join(AUDIT_DIR, "ag4-baseline-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("AG-4 W0 baseline capture complete.");
  console.log(JSON.stringify(manifest, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
