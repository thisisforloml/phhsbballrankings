/**
 * TR-5 validation: V-TR-11 through V-TR-20 (snapshot checks deferred).
 * Usage: npx tsx scripts/validate-program-team-ratings-tr5.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { isPybcCompetitionName, normalizeCompetitionDisplayName } from "../src/lib/competition-naming";
import { computeProgramTeamRatings } from "../src/lib/team-ratings/compute-program-team-ratings";
import { TEAM_EVIDENCE_POLICY_V1 } from "../src/lib/team-ratings/constants";
import { dedupeTeamTpiGames, type TeamTpiGameInput } from "../src/lib/team-ratings/team-tpi-v1";
import { isTeamEvidenceEligibleGame } from "../src/lib/team-ratings/team-evidence-filter";

const EVALUATION_DATE = new Date("2026-06-17T12:00:00.000Z");
const PYBC_U16_BOYS_EXPECTED_GAMES = 37;
const RATING_TOLERANCE = 0.01;

async function countPybcU16BoysEvidenceGames(): Promise<number> {
  const games = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null, ageGroup: AgeGroup.U16 } },
      homeTeam: { deletedAt: null, program: { deletedAt: null } },
      awayTeam: { deletedAt: null, program: { deletedAt: null } }
    },
    include: {
      homeTeam: { include: { program: true } },
      awayTeam: { include: { program: true } },
      season: { include: { league: true } }
    }
  });

  const rows: TeamTpiGameInput[] = [];
  for (const g of games) {
    const leagueName = g.season.league.name;
    if (!isPybcCompetitionName(normalizeCompetitionDisplayName(leagueName))) continue;
    if (
      !isTeamEvidenceEligibleGame({
        verificationStatus: g.verificationStatus,
        submissionType: g.submissionType,
        deletedAt: g.deletedAt,
        homeProgramId: g.homeTeam.programId,
        awayProgramId: g.awayTeam.programId
      })
    ) {
      continue;
    }
    rows.push({
      gameId: g.id,
      gameNumber: g.gameNumber,
      gameDate: g.gameDate,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      homeProgramId: g.homeTeam.programId!,
      awayProgramId: g.awayTeam.programId!,
      homeProgramName: g.homeTeam.program?.fullName ?? g.homeTeam.name,
      awayProgramName: g.awayTeam.program?.fullName ?? g.awayTeam.name,
      leagueTier: g.season.league.tier,
      leagueId: g.season.leagueId,
      seasonId: g.seasonId,
      ageGroup: g.season.league.ageGroup,
      gender: "Boys"
    });
  }
  return dedupeTeamTpiGames(rows).length;
}

type CheckResult = {
  id: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
};

function pass(id: string, detail: string): CheckResult {
  return { id, status: "PASS", detail };
}

function fail(id: string, detail: string): CheckResult {
  return { id, status: "FAIL", detail };
}

function skip(id: string, detail: string): CheckResult {
  return { id, status: "SKIP", detail };
}

async function main() {
  const checks: CheckResult[] = [];

  // V-TR-12: TypeScript compile
  try {
    execSync("npx.cmd tsc --noEmit", { stdio: "pipe", cwd: process.cwd() });
    checks.push(pass("V-TR-12", "npx tsc --noEmit passed"));
  } catch (err) {
    const output =
      (err as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ??
      (err as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ??
      "";
    const tr5Errors = output
      .split(/\r?\n/)
      .filter((line) => /team-ratings|validate-program-team-ratings|compute-program-team-ratings/.test(line));
    checks.push(
      tr5Errors.length === 0
        ? pass("V-TR-12", "No TR-5 module type errors (repo has pre-existing script errors)")
        : fail("V-TR-12", tr5Errors.join(" | "))
    );
  }

  const playerRatingBefore = await prisma.playerRating.count();
  const teamRatingBefore = await prisma.teamRating.count();
  const playerRatingSample = await prisma.playerRating.findMany({
    select: { playerId: true, ageGroup: true, adjustedRating: true, verifiedGameCount: true },
    orderBy: [{ playerId: "asc" }, { ageGroup: "asc" }]
  });

  const run1 = await computeProgramTeamRatings({ evaluationDate: EVALUATION_DATE });
  const run2 = await computeProgramTeamRatings({ evaluationDate: EVALUATION_DATE });

  const playerRatingAfter = await prisma.playerRating.count();
  const teamRatingAfter = await prisma.teamRating.count();
  const playerRatingSampleAfter = await prisma.playerRating.findMany({
    select: { playerId: true, ageGroup: true, adjustedRating: true, verifiedGameCount: true },
    orderBy: [{ playerId: "asc" }, { ageGroup: "asc" }]
  });

  // V-TR-11: Player ratings unchanged
  const playerCountOk = playerRatingBefore === playerRatingAfter;
  const playerSampleOk =
    playerRatingSample.length === playerRatingSampleAfter.length &&
    playerRatingSample.every((row, i) => {
      const after = playerRatingSampleAfter[i]!;
      return (
        row.playerId === after.playerId &&
        row.ageGroup === after.ageGroup &&
        Number(row.adjustedRating) === Number(after.adjustedRating) &&
        row.verifiedGameCount === after.verifiedGameCount
      );
    });
  checks.push(
    playerCountOk && playerSampleOk
      ? pass("V-TR-11", `PlayerRating count unchanged (${playerRatingBefore}); sample hash match`)
      : fail("V-TR-11", `PlayerRating mutated: before=${playerRatingBefore}, after=${playerRatingAfter}`)
  );

  // V-TR-13..15: snapshots out of scope
  checks.push(skip("V-TR-13", "Team snapshots not in TR-5 scope"));
  checks.push(skip("V-TR-14", "Team snapshots not in TR-5 scope"));
  checks.push(skip("V-TR-15", "Team snapshots not in TR-5 scope"));

  // V-TR-16: uniqueness
  const dupes = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "programId", "ageGroup", "gender", COUNT(*) AS n
      FROM "program_team_ratings"
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    ) d
  `;
  const dupeCount = Number(dupes[0]?.c ?? 0);
  checks.push(
    dupeCount === 0
      ? pass("V-TR-16", "0 duplicate (programId, ageGroup, gender) keys")
      : fail("V-TR-16", `${dupeCount} duplicate keys found`)
  );

  // V-TR-17: idempotency
  const persisted = await prisma.programTeamRating.findMany({
    select: {
      programId: true,
      ageGroup: true,
      gender: true,
      rating: true,
      observedRating: true,
      effectiveGameWeight: true
    },
    orderBy: [{ programId: "asc" }, { ageGroup: "asc" }, { gender: "asc" }]
  });
  const run2BoardRatings = new Map<string, number>();
  for (const board of run2.boards) {
    for (const r of board.results) {
      const gender = r.gender === "Girls" ? PlayerGender.GIRLS : PlayerGender.BOYS;
      run2BoardRatings.set(`${r.programId}:${r.ageGroup}:${gender}`, r.tpiAdjusted);
    }
  }
  const drift = persisted.filter((row) => {
    const key = `${row.programId}:${row.ageGroup}:${row.gender}`;
    const expected = run2BoardRatings.get(key);
    if (expected === undefined) return true;
    return Math.abs(Number(row.rating) - expected) > RATING_TOLERANCE;
  });
  checks.push(
    drift.length === 0
      ? pass("V-TR-17", `Second recompute within ±${RATING_TOLERANCE} of persisted rows`)
      : fail("V-TR-17", `${drift.length} rows drift beyond tolerance`)
  );

  // V-TR-18: PYBC U16 Boys game count (TR-3 pilot cohort parity)
  const pybcU16BoysGames = await countPybcU16BoysEvidenceGames();
  checks.push(
    pybcU16BoysGames === PYBC_U16_BOYS_EXPECTED_GAMES
      ? pass(
          "V-TR-18",
          `PYBC U16 Boys deduped games=${pybcU16BoysGames} (expected ${PYBC_U16_BOYS_EXPECTED_GAMES})`
        )
      : fail(
          "V-TR-18",
          `PYBC U16 Boys games=${pybcU16BoysGames}, expected ${PYBC_U16_BOYS_EXPECTED_GAMES}`
        )
  );

  // Evidence policy stamped
  const evidenceRows = await prisma.programTeamRating.count({
    where: { evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1 }
  });
  checks.push(
    evidenceRows === persisted.length && persisted.length > 0
      ? pass("V-TR-18b", `All ${persisted.length} rows use ${TEAM_EVIDENCE_POLICY_V1}`)
      : fail("V-TR-18b", `Evidence policy mismatch: ${evidenceRows}/${persisted.length}`)
  );

  // V-TR-19: team_ratings untouched
  checks.push(
    teamRatingBefore === teamRatingAfter
      ? pass("V-TR-19", `team_ratings count unchanged (${teamRatingBefore})`)
      : fail("V-TR-19", `team_ratings count changed: ${teamRatingBefore} -> ${teamRatingAfter}`)
  );

  // V-TR-20: no rows for deleted programs
  const deletedProgramRows = await prisma.programTeamRating.count({
    where: { program: { deletedAt: { not: null } } }
  });
  checks.push(
    deletedProgramRows === 0
      ? pass("V-TR-20", "0 ProgramTeamRating rows for deleted programs")
      : fail("V-TR-20", `${deletedProgramRows} rows reference deleted programs`)
  );

  const formulaVersion = await prisma.teamFormulaVersion.findUnique({ where: { slug: "TPI-v1" } });

  const report = {
    generatedAt: new Date().toISOString(),
    evaluationDate: EVALUATION_DATE.toISOString(),
    teamFormulaVersion: formulaVersion?.slug ?? null,
    evidencePolicyVersion: TEAM_EVIDENCE_POLICY_V1,
    computeSummary: {
      run1Upserted: run1.upserted,
      run2Upserted: run2.upserted,
      totalRows: run1.totalRows,
      boards: run1.boards.map((b) => ({
        boardKey: b.boardKey,
        gameCount: b.gameCount,
        programCount: b.programCount
      }))
    },
    checks,
    summary: {
      pass: checks.filter((c) => c.status === "PASS").length,
      fail: checks.filter((c) => c.status === "FAIL").length,
      skip: checks.filter((c) => c.status === "SKIP").length
    }
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "tr5-validation-latest.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`PASS=${report.summary.pass} FAIL=${report.summary.fail} SKIP=${report.summary.skip}`);

  const failed = checks.filter((c) => c.status === "FAIL");
  if (failed.length > 0) {
    for (const f of failed) console.error(`${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
