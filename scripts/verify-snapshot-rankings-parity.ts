/**
 * Compare public ranking board output: live path vs snapshot-first read path.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/verify-snapshot-rankings-parity.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getPublicBoardRows } from "../src/lib/public-board-ranks";
import {
  buildLatestNationalRankingsLive,
  type NationalRankingRow,
  rankingAgeGroups,
} from "../src/lib/rankings";
import {
  buildLatestNationalRankingsFromSnapshots,
} from "../src/lib/rankings-snapshot-read";

type ComparedField =
  | "playerId"
  | "rank"
  | "rating"
  | "starRating"
  | "verifiedGameCount"
  | "displayName"
  | "currentTeam"
  | "primaryCompetition"
  | "slug"
  | "city"
  | "region"
  | "position";

const CORE_RANKING_FIELDS: ComparedField[] = [
  "playerId",
  "rank",
  "rating",
  "starRating",
  "verifiedGameCount",
  "displayName",
];

const AFFILIATION_FIELDS: ComparedField[] = ["currentTeam", "primaryCompetition"];
const COMPARED_FIELDS: ComparedField[] = [
  ...CORE_RANKING_FIELDS,
  ...AFFILIATION_FIELDS,
  "slug",
  "city",
  "region",
  "position",
];

function publicRowSignature(row: NationalRankingRow) {
  const signature: Record<string, unknown> = {};
  for (const field of COMPARED_FIELDS) {
    if (field === "primaryCompetition") {
      signature[field] = row.primaryCompetition?.shortName ?? null;
    } else {
      signature[field] = row[field];
    }
  }
  return signature;
}

function comparePublicBoards(
  boardKey: string,
  liveRows: NationalRankingRow[],
  snapshotRows: NationalRankingRow[]
) {
  const liveByPlayer = new Map(liveRows.map((row) => [row.playerId, row]));
  const snapshotByPlayer = new Map(snapshotRows.map((row) => [row.playerId, row]));

  const liveIds = [...liveByPlayer.keys()].sort();
  const snapshotIds = [...snapshotByPlayer.keys()].sort();
  const playerSetMatches = JSON.stringify(liveIds) === JSON.stringify(snapshotIds);

  const fieldMismatches: Array<{
    playerId: string;
    field: ComparedField;
    live: unknown;
    snapshot: unknown;
  }> = [];

  const coreFieldMismatches: typeof fieldMismatches = [];

  for (const playerId of liveIds) {
    const live = liveByPlayer.get(playerId)!;
    const snapshot = snapshotByPlayer.get(playerId);
    if (!snapshot) continue;
    for (const field of COMPARED_FIELDS) {
      const liveValue = field === "primaryCompetition" ? live.primaryCompetition?.shortName ?? null : live[field];
      const snapshotValue =
        field === "primaryCompetition" ? snapshot.primaryCompetition?.shortName ?? null : snapshot[field];
      if (JSON.stringify(liveValue) !== JSON.stringify(snapshotValue)) {
        const mismatch = { playerId, field, live: liveValue, snapshot: snapshotValue };
        fieldMismatches.push(mismatch);
        if (CORE_RANKING_FIELDS.includes(field)) {
          coreFieldMismatches.push(mismatch);
        }
      }
    }
  }

  const mismatchCountsByField = fieldMismatches.reduce<Record<string, number>>((counts, mismatch) => {
    counts[mismatch.field] = (counts[mismatch.field] ?? 0) + 1;
    return counts;
  }, {});

  const onlyLive = liveIds.filter((id) => !snapshotByPlayer.has(id));
  const onlySnapshot = snapshotIds.filter((id) => !liveByPlayer.has(id));

  return {
    boardKey,
    liveCount: liveRows.length,
    snapshotCount: snapshotRows.length,
    playerSetMatches,
    onlyLive,
    onlySnapshot,
    fieldMismatches,
    coreFieldMismatches,
    mismatchCountsByField,
    coreRankingsIdentical: playerSetMatches && coreFieldMismatches.length === 0,
    identical: playerSetMatches && fieldMismatches.length === 0,
  };
}

async function main() {
  const live = await buildLatestNationalRankingsLive(rankingAgeGroups);

  let snapshot: Awaited<ReturnType<typeof buildLatestNationalRankingsFromSnapshots>> | null = null;
  let snapshotError: string | null = null;
  try {
    snapshot = await buildLatestNationalRankingsFromSnapshots(rankingAgeGroups);
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : String(error);
  }

  const boards: Array<ReturnType<typeof comparePublicBoards>> = [];
  for (const ageGroup of rankingAgeGroups) {
    for (const gender of [PlayerGender.BOYS, PlayerGender.GIRLS] as const) {
      const boardKey = `${ageGroup}/${gender}`;
      const liveSnapshot = live.snapshotsByAge[ageGroup][gender === PlayerGender.BOYS ? "boys" : "girls"];
      const livePublic = getPublicBoardRows(liveSnapshot);

      if (!snapshot) {
        boards.push({
          boardKey,
          liveCount: livePublic.length,
          snapshotCount: 0,
          playerSetMatches: false,
          onlyLive: livePublic.map((row) => row.playerId),
          onlySnapshot: [],
          fieldMismatches: [],
          coreFieldMismatches: [],
          mismatchCountsByField: {},
          coreRankingsIdentical: false,
          identical: false,
        });
        continue;
      }

      const snapshotBoard = snapshot.snapshotsByAge[ageGroup][gender === PlayerGender.BOYS ? "boys" : "girls"];
      const snapshotPublic = getPublicBoardRows(snapshotBoard);
      boards.push(comparePublicBoards(boardKey, livePublic, snapshotPublic));
    }
  }

  const allIdentical = Boolean(snapshot) && boards.every((board) => board.identical);
  const allCoreRankingsIdentical = Boolean(snapshot) && boards.every((board) => board.coreRankingsIdentical);
  const report = {
    generatedAt: new Date().toISOString(),
    snapshotReadAvailable: Boolean(snapshot),
    snapshotError,
    allPublicBoardsIdentical: allIdentical,
    allCoreRankingsIdentical,
    boards: boards.map((board) => ({
      boardKey: board.boardKey,
      liveCount: board.liveCount,
      snapshotCount: board.snapshotCount,
      playerSetMatches: board.playerSetMatches,
      onlyLive: board.onlyLive,
      onlySnapshot: board.onlySnapshot,
      mismatchCountsByField: board.mismatchCountsByField,
      coreRankingsIdentical: board.coreRankingsIdentical,
      identical: board.identical,
      fieldMismatches: board.fieldMismatches.slice(0, 5),
      fieldMismatchTotal: board.fieldMismatches.length,
      coreFieldMismatchTotal: board.coreFieldMismatches.length,
    })),
    notes: [
      "Compares getPublicBoardRows() output per board (what the public UI renders).",
      "Snapshot regeneration uses evaluationDate=now (weekOf remains month start) so refreshed boards match live eligibility.",
      "Snapshot read hydrates currentTeam and primaryCompetition from batched gameStat loads (same helpers as live path).",
      "Enable production snapshot read with RANKINGS_READ_FROM_SNAPSHOTS=1 only after allPublicBoardsIdentical is true.",
    ],
  };

  const outDir = path.join(process.cwd(), ".cursor", "snapshot-rankings-parity");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "summary.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report, null, 2));

  await prisma.$disconnect();

  if (!snapshot) {
    process.exit(snapshotError?.includes("Incomplete") ? 2 : 1);
  }

  if (!allIdentical) {
    if (allCoreRankingsIdentical) {
      console.error("\nCore ranking fields match on all boards. Remaining diffs are affiliation/display fields expected in Phase 1.");
      process.exit(4);
    }
    console.error("\nPublic board parity not confirmed — review field mismatches above.");
    process.exit(3);
  }

  console.log("\nAll public ranking boards identical between live and snapshot read paths.");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
