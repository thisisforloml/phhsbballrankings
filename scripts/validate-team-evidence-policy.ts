/**
 * B7: TEAM-EVIDENCE-v1-official-import end-to-end validation.
 * Usage: npx tsx scripts/validate-team-evidence-policy.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SubmissionType, VerificationStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { isTeamEvidenceEligibleGame } from "../src/lib/team-ratings/team-evidence-filter";
import { resolveImportedOfficialGameIds } from "../src/lib/team-ratings/team-evidence-imported-games";
import { TEAM_EVIDENCE_POLICY_V1 } from "../src/lib/team-ratings/constants";

type Check = { id: string; status: "PASS" | "FAIL" | "SKIP" | "WARN"; detail: string };

async function main() {
  const checks: Check[] = [];
  const importedGameIds = await resolveImportedOfficialGameIds();

  const activeGames = await prisma.game.findMany({
    where: {
      deletedAt: null,
      season: { deletedAt: null, league: { deletedAt: null } },
      homeTeam: { deletedAt: null, program: { deletedAt: null } },
      awayTeam: { deletedAt: null, program: { deletedAt: null } }
    },
    select: {
      id: true,
      verificationStatus: true,
      submissionType: true,
      deletedAt: true,
      homeTeam: { select: { programId: true } },
      awayTeam: { select: { programId: true } }
    }
  });

  const baseEligible = activeGames.filter((game) =>
    isTeamEvidenceEligibleGame({
      verificationStatus: game.verificationStatus,
      submissionType: game.submissionType,
      deletedAt: game.deletedAt,
      homeProgramId: game.homeTeam.programId,
      awayProgramId: game.awayTeam.programId
    })
  );

  const policyEligible = baseEligible.filter((game) => importedGameIds.has(game.id));
  const excludedByImport = baseEligible.filter((game) => !importedGameIds.has(game.id));
  const staffManualSubmitted = activeGames.filter(
    (game) =>
      game.submissionType === SubmissionType.STAFF_MANUAL_ENTRY
      && (game.verificationStatus === VerificationStatus.SUBMITTED || game.verificationStatus === VerificationStatus.VERIFIED)
  );

  checks.push(
    importedGameIds.size > 0
      ? { id: "V-TR-EV-01", status: "PASS", detail: `${importedGameIds.size} game IDs resolved from IMPORTED submissions` }
      : { id: "V-TR-EV-01", status: "FAIL", detail: "No imported official game IDs resolved" }
  );

  checks.push(
    excludedByImport.length === 0
      ? { id: "V-TR-EV-02", status: "PASS", detail: "All STAFF_MANUAL_ENTRY SUBMITTED/VERIFIED games are tied to IMPORTED submissions" }
      : {
          id: "V-TR-EV-02",
          status: "WARN",
          detail: `${excludedByImport.length} staff-import games lack IMPORTED submission linkage (compute path excludes them; persisted ratings unchanged until recompute)`
        }
  );

  checks.push(
    policyEligible.length === staffManualSubmitted.length
      ? { id: "V-TR-EV-03", status: "PASS", detail: `Policy-eligible count matches staff import set (${policyEligible.length})` }
      : {
          id: "V-TR-EV-03",
          status: "WARN",
          detail: `Policy-eligible=${policyEligible.length}, staffManualSubmitted=${staffManualSubmitted.length} — data linkage gap documented`
        }
  );

  const ratings = await prisma.programTeamRating.findMany({
    select: { evidencePolicyVersion: true },
    distinct: ["evidencePolicyVersion"]
  });
  checks.push(
    ratings.every((row) => row.evidencePolicyVersion === TEAM_EVIDENCE_POLICY_V1)
      ? { id: "V-TR-EV-04", status: "PASS", detail: `Persisted ratings use ${TEAM_EVIDENCE_POLICY_V1}` }
      : { id: "V-TR-EV-04", status: "FAIL", detail: `Unexpected evidence policy versions: ${ratings.map((row) => row.evidencePolicyVersion).join(", ")}` }
  );

  const report = {
    generatedAt: new Date().toISOString(),
    policy: TEAM_EVIDENCE_POLICY_V1,
    counts: {
      activeGames: activeGames.length,
      importedGameIds: importedGameIds.size,
      baseEligible: baseEligible.length,
      policyEligible: policyEligible.length,
      excludedByImport: excludedByImport.length
    },
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "PASS").length,
      warn: checks.filter((check) => check.status === "WARN").length,
      fail: checks.filter((check) => check.status === "FAIL").length,
      skip: checks.filter((check) => check.status === "SKIP").length
    }
  };

  const outDir = join(process.cwd(), "scripts", "reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "team-evidence-policy-validation.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${outPath}`);
  console.log(`PASS=${report.summary.pass} WARN=${report.summary.warn} FAIL=${report.summary.fail}`);

  if (report.summary.fail > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
