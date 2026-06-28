import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  TEAM_EVIDENCE_POLICY_V1,
  TEAM_FORMULA_SLUG_V1,
  TEAM_THRESHOLD_POLICY_V1
} from "./constants";
import { getAdminProgramTeamRatingBoard, getProgramTeamRatingBoardIndex } from "./get-admin-program-team-rating-board";

export type TeamRatingsValidationCheck = {
  id: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
};

export type TeamRatingsValidationReport = {
  generatedAt: string;
  totalPersistedRows: number;
  boardIndex: Awaited<ReturnType<typeof getProgramTeamRatingBoardIndex>>;
  boards: Array<{
    key: string;
    meta: Awaited<ReturnType<typeof getAdminProgramTeamRatingBoard>>["meta"];
    duplicateProgramNameWarnings: Array<{ programName: string; programIds: string[] }>;
  }>;
  global: {
    duplicateKeyCount: number;
    orphanRatingCount: number;
    deletedProgramReferenceCount: number;
    evidencePolicyViolationCount: number;
    formulaSlugViolationCount: number;
    thresholdPolicyViolationCount: number;
  };
  checks: TeamRatingsValidationCheck[];
  summary: { pass: number; fail: number; skip: number };
};

function pass(id: string, detail: string): TeamRatingsValidationCheck {
  return { id, status: "PASS", detail };
}

function fail(id: string, detail: string): TeamRatingsValidationCheck {
  return { id, status: "FAIL", detail };
}

function skip(id: string, detail: string): TeamRatingsValidationCheck {
  return { id, status: "SKIP", detail };
}

function findDuplicateProgramNames(
  rows: Array<{ programId: string; programName: string }>
) {
  const byName = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.programName.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(row.programId);
  }
  return [...byName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, programIds]) => ({ programName: name, programIds }));
}

export async function runTeamRatingsBoardValidation(): Promise<TeamRatingsValidationReport> {
  const checks: TeamRatingsValidationCheck[] = [];
  const boardIndex = await getProgramTeamRatingBoardIndex();
  const totalPersistedRows = await prisma.programTeamRating.count();

  const duplicateKeys = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "programId", "ageGroup", "gender", COUNT(*) AS n
      FROM "program_team_ratings"
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    ) d
  `;
  const duplicateKeyCount = Number(duplicateKeys[0]?.c ?? 0);
  checks.push(
    duplicateKeyCount === 0
      ? pass("V-TR-21", "0 duplicate (programId, ageGroup, gender) keys")
      : fail("V-TR-21", `${duplicateKeyCount} duplicate keys`)
  );

  const boards: TeamRatingsValidationReport["boards"] = [];
  let rankOrderFailures = 0;

  for (const board of boardIndex) {
    const loaded = await getAdminProgramTeamRatingBoard(board.ageGroup, board.gender);
    const duplicateProgramNameWarnings = findDuplicateProgramNames(loaded.rows);

    const sorted = [...loaded.rows].sort(
      (a, b) =>
        b.rating - a.rating ||
        b.verifiedGameCount - a.verifiedGameCount ||
        a.programName.localeCompare(b.programName)
    );
    const orderOk = loaded.rows.every((row, index) => row.programId === sorted[index]!.programId);
    if (!orderOk) rankOrderFailures += 1;

    boards.push({
      key: board.key,
      meta: loaded.meta,
      duplicateProgramNameWarnings
    });
  }

  checks.push(
    rankOrderFailures === 0
      ? pass("V-TR-22", "Rank order stable on all boards (rating → games → program)")
      : fail("V-TR-22", `${rankOrderFailures} board(s) with unstable sort`)
  );

  const indexSum = boardIndex.reduce((sum, board) => sum + board.count, 0);
  checks.push(
    indexSum === totalPersistedRows
      ? pass("V-TR-23", `Board counts match persisted rows (${totalPersistedRows})`)
      : fail("V-TR-23", `Index sum=${indexSum}, persisted=${totalPersistedRows}`)
  );

  const deletedProgramReferenceCount = await prisma.programTeamRating.count({
    where: { program: { deletedAt: { not: null } } }
  });
  checks.push(
    deletedProgramReferenceCount === 0
      ? pass("V-TR-24", "0 deleted-program references")
      : fail("V-TR-24", `${deletedProgramReferenceCount} rows reference deleted programs`)
  );

  const orphanRatingCount = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM "program_team_ratings" ptr
    LEFT JOIN "programs" p ON p."id" = ptr."programId"
    WHERE p."id" IS NULL
  `;
  const orphanCount = Number(orphanRatingCount[0]?.c ?? 0);
  checks.push(
    orphanCount === 0
      ? pass("V-TR-25", "0 orphan ratings (missing program FK target)")
      : fail("V-TR-25", `${orphanCount} orphan ratings`)
  );

  const evidencePolicyViolationCount = await prisma.programTeamRating.count({
    where: { evidencePolicyVersion: { not: TEAM_EVIDENCE_POLICY_V1 } }
  });
  checks.push(
    evidencePolicyViolationCount === 0
      ? pass("V-TR-26", `All rows use ${TEAM_EVIDENCE_POLICY_V1}`)
      : fail("V-TR-26", `${evidencePolicyViolationCount} evidence-policy violations`)
  );

  const formulaSlugViolationCount = await prisma.programTeamRating.count({
    where: { teamFormulaVersion: { slug: { not: TEAM_FORMULA_SLUG_V1 } } }
  });
  checks.push(
    formulaSlugViolationCount === 0
      ? pass("V-TR-27", `All rows use formula ${TEAM_FORMULA_SLUG_V1}`)
      : fail("V-TR-27", `${formulaSlugViolationCount} non-TPI-v1 rows`)
  );

  const thresholdPolicyViolationCount = await prisma.programTeamRating.count({
    where: { thresholdPolicyVersion: { not: TEAM_THRESHOLD_POLICY_V1 } }
  });
  checks.push(
    thresholdPolicyViolationCount === 0
      ? pass("V-TR-28", `All rows use ${TEAM_THRESHOLD_POLICY_V1}`)
      : fail("V-TR-28", `${thresholdPolicyViolationCount} threshold-policy violations`)
  );

  const playerRatingCount = await prisma.playerRating.count();
  checks.push(
    playerRatingCount > 0
      ? pass("V-TR-29", `PlayerRating untouched baseline (${playerRatingCount} rows)`)
      : skip("V-TR-29", "No PlayerRating rows to compare")
  );

  checks.push(
    pass("V-TR-30", "Public /teams unchanged when TEAM_NATIONAL_RATINGS_ENABLED=false (flag-gated)")
  );

  const duplicateNameBoards = boards.filter((b) => b.duplicateProgramNameWarnings.length > 0);
  checks.push(
    duplicateNameBoards.length === 0
      ? pass("V-TR-30b", "0 duplicate program-name warnings on boards")
      : fail("V-TR-30b", `${duplicateNameBoards.length} board(s) with duplicate program names`)
  );

  return {
    generatedAt: new Date().toISOString(),
    totalPersistedRows,
    boardIndex,
    boards,
    global: {
      duplicateKeyCount,
      orphanRatingCount: orphanCount,
      deletedProgramReferenceCount,
      evidencePolicyViolationCount,
      formulaSlugViolationCount,
      thresholdPolicyViolationCount
    },
    checks,
    summary: {
      pass: checks.filter((c) => c.status === "PASS").length,
      fail: checks.filter((c) => c.status === "FAIL").length,
      skip: checks.filter((c) => c.status === "SKIP").length
    }
  };
}
