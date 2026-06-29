/**
 * Dry-run: preview PlayerRating rows that vNext would upsert (no writes).
 * Usage: npx tsx scripts/recompute-player-ratings-vnext-dry-run.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildShadowRatings } from "../src/lib/ratings/formula-vnext/accumulation";
import { loadFormulaVnextEvidence } from "../src/lib/ratings/formula-vnext/load-evidence";
import { resolveShadowFormulaParams } from "../src/lib/ratings/formula-vnext/resolve-params";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "recompute-player-ratings-vnext-dry-run.json");
const mdPath = join(reportsDir, "recompute-player-ratings-vnext-dry-run.md");

const HOME_BRACKETS: Array<"U13" | "U16" | "U19"> = ["U13", "U16", "U19"];

async function main() {
  const asOfDate = new Date();
  const params = resolveShadowFormulaParams();
  const evidence = await loadFormulaVnextEvidence({ asOfDate });

  const targets: Array<{
    playerId: string;
    displayName: string;
    gender: PlayerGender;
    ageGroup: AgeGroup;
    observedRating: number;
    adjustedRating: number;
    verifiedGameCount: number;
    starRating: number;
    ratingBasis: string;
    action: "CREATE" | "UPDATE" | "UNCHANGED";
    currentRating: number | null;
  }> = [];

  const existing = await prisma.playerRating.findMany({
    select: { playerId: true, ageGroup: true, adjustedRating: true, verifiedGameCount: true }
  });
  const existingMap = new Map(existing.map((r) => [`${r.playerId}|${r.ageGroup}`, r]));

  for (const bracket of HOME_BRACKETS) {
    const bracketEvidence = evidence.filter((row) => row.homeBracket === bracket);
    const shadowRows = buildShadowRatings(bracketEvidence, params, asOfDate);
    for (const row of shadowRows) {
      const key = `${row.playerId}|${bracket}`;
      const current = existingMap.get(key);
      let action: "CREATE" | "UPDATE" | "UNCHANGED" = "CREATE";
      if (current) {
        const delta = Math.abs(Number(current.adjustedRating) - row.adjustedRating);
        action = delta < 0.01 && current.verifiedGameCount === row.verifiedGameCount ? "UNCHANGED" : "UPDATE";
      }
      targets.push({
        playerId: row.playerId,
        displayName: row.displayName,
        gender: row.gender,
        ageGroup: bracket as AgeGroup,
        observedRating: row.observedRating,
        adjustedRating: row.adjustedRating,
        verifiedGameCount: row.verifiedGameCount,
        starRating: row.starRating,
        ratingBasis: row.ratingBasis,
        action,
        currentRating: current ? Number(current.adjustedRating) : null
      });
    }
  }

  const summary = {
    total: targets.length,
    create: targets.filter((t) => t.action === "CREATE").length,
    update: targets.filter((t) => t.action === "UPDATE").length,
    unchanged: targets.filter((t) => t.action === "UNCHANGED").length,
    projected: targets.filter((t) => t.ratingBasis === "PROJECTED").length
  };

  const report = {
    generatedAt: asOfDate.toISOString(),
    mode: "dry-run-only",
    policyVersionId: params.policyVersionId,
    warning: "NO DATABASE WRITES — approval required before execute path",
    summary,
    samples: {
      creates: targets.filter((t) => t.action === "CREATE").slice(0, 20),
      updates: targets
        .filter((t) => t.action === "UPDATE")
        .sort((a, b) => Math.abs((b.currentRating ?? 0) - b.adjustedRating) - Math.abs((a.currentRating ?? 0) - a.adjustedRating))
        .slice(0, 20)
    },
    allTargets: targets
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    mdPath,
    `# vNext PlayerRating Recompute Dry-Run

Generated: ${report.generatedAt}

**${report.warning}**

| Action | Count |
|--------|------:|
| CREATE | ${summary.create} |
| UPDATE | ${summary.update} |
| UNCHANGED | ${summary.unchanged} |
| PROJECTED basis | ${summary.projected} |

## Sample creates (home-board rows missing in v1)

${report.samples.creates.map((t) => `- ${t.displayName} (${t.ageGroup}): ${t.adjustedRating} [${t.ratingBasis}]`).join("\n") || "None."}

## Sample updates (largest rating delta)

${report.samples.updates.map((t) => `- ${t.displayName} (${t.ageGroup}): ${t.currentRating} → ${t.adjustedRating}`).join("\n") || "None."}
`
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Dry-run: ${summary.create} creates, ${summary.update} updates, ${summary.unchanged} unchanged`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
