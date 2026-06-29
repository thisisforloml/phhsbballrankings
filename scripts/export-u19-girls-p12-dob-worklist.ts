/**
 * T0 — export U19 Girls P12 (UNKNOWN_DOB) worklist for DOB remediation.
 * Usage: npx tsx scripts/export-u19-girls-p12-dob-worklist.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { buildEligibilityInput, evaluateEligibility, resolveLaunchThreshold } from "../src/lib/eligibility";
import { prisma } from "../src/lib/prisma";

const OUT_DIR = join(process.cwd(), "docs", "planning", "audits");

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const formulaVersion = await prisma.formulaVersion.findUnique({ where: { versionNumber: 1 }, select: { id: true } });
  const ratings = await prisma.playerRating.findMany({
    where: { ageGroup: AgeGroup.U19, player: { gender: PlayerGender.GIRLS, deletedAt: null } },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          classYearOverride: true,
          city: true,
          region: true,
          position: true,
          currentProgram: { select: { fullName: true, abbreviation: true } },
          rosterSeasons: {
            where: { deletedAt: null },
            take: 1,
            orderBy: { createdAt: "desc" },
            include: { team: { select: { name: true, program: { select: { fullName: true } } } } }
          }
        }
      }
    },
    orderBy: [{ verifiedGameCount: "desc" }, { player: { displayName: "asc" } }]
  });

  const threshold = resolveLaunchThreshold(PlayerGender.GIRLS);
  const worklist = [];
  const p7 = [];

  for (const rating of ratings) {
    const verdict = evaluateEligibility(
      buildEligibilityInput({
        playerId: rating.playerId,
        gender: PlayerGender.GIRLS,
        birthDate: rating.player.birthDate,
        classYearOverride: rating.player.classYearOverride,
        ratingAgeGroup: "U19",
        verifiedGameCount: rating.verifiedGameCount,
        evaluatedBoard: "U19",
        formulaVersionId: formulaVersion?.id ?? null
      })
    );

    const base = {
      playerId: rating.playerId,
      displayName: rating.player.displayName,
      verifiedGameCount: rating.verifiedGameCount,
      launchThreshold: threshold,
      gamesShort: Math.max(0, threshold - rating.verifiedGameCount),
      verdict: verdict.verdict,
      provisionalReason: verdict.provisionalReason,
      precedenceRule: verdict.precedenceRule,
      program: rating.player.currentProgram?.fullName ?? rating.player.rosterSeasons[0]?.team.program?.fullName ?? null,
      team: rating.player.rosterSeasons[0]?.team.name ?? null,
      city: rating.player.city,
      region: rating.player.region,
      position: rating.player.position,
      remediationPriority: verdict.provisionalReason === "UNKNOWN_DOB" ? "T0-DOB" : "T0-GAMES"
    };

    if (verdict.provisionalReason === "UNKNOWN_DOB") worklist.push(base);
    else if (verdict.provisionalReason === "BELOW_THRESHOLD") p7.push(base);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    tier: "T0",
    cohort: "U19 Girls P12 UNKNOWN_DOB",
    threshold,
    totalU19GirlsRatings: ratings.length,
    p12Count: worklist.length,
    p7Count: p7.length,
    worklist,
    p7NearThreshold: p7
  };

  const jsonPath = join(OUT_DIR, "t0-u19-girls-p12-dob-worklist.json");
  const mdPath = join(OUT_DIR, "T0_U19_GIRLS_DOB_REMEDIATION.md");

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  writeFileSync(
    mdPath,
    `# T0 U19 Girls DOB Remediation

**Generated:** ${payload.generatedAt}  
**Cohort:** P12 \`UNKNOWN_DOB\` with verified games ≥ ${threshold}  
**Count:** ${worklist.length} players  
**Companion JSON:** \`t0-u19-girls-p12-dob-worklist.json\`

## Instructions

1. Assign worklist rows to program admins by \`program\` / \`team\`.
2. Enter \`birthDate\` via Admin → Players or Program roster bio editor.
3. Do **not** estimate DOBs — use official roster or school records only.
4. Re-run \`npx tsx scripts/capture-ag4-g1-baseline.ts\` after each remediation batch.
5. Target: **≥15 RANKED U19 Girls** within 30 days (Data Remediation Strategy §4).

## P7 near-threshold (${p7.length})

Secondary cohort after DOB blitz — players below ${threshold} verified games.

| Player | Games | Short | Program |
|---|---:|---:|---|
${p7
  .slice(0, 15)
  .map((row) => `| ${row.displayName} | ${row.verifiedGameCount} | ${row.gamesShort} | ${row.program ?? "—"} |`)
  .join("\n")}

## P12 worklist (first 20)

| Player | Games | Program | Team |
|---|---:|---|---|
${worklist
  .slice(0, 20)
  .map((row) => `| ${row.displayName} | ${row.verifiedGameCount} | ${row.program ?? "—"} | ${row.team ?? "—"} |`)
  .join("\n")}

*Full list in JSON artifact.*
`
  );

  console.log(JSON.stringify({ jsonPath, mdPath, p12Count: worklist.length, p7Count: p7.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
