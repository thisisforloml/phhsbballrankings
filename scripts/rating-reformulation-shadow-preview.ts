/**
 * Read-only shadow board preview (Formula vNext).
 * Usage: npx tsx scripts/rating-reformulation-shadow-preview.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeShadowBoard, FORMULA_VNEXT_POLICY_ID, resolveShadowFormulaParams } from "../src/lib/ratings/formula-vnext";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "rating-reformulation-shadow-preview.json");
const mdPath = join(reportsDir, "rating-reformulation-shadow-preview.md");

const BOARDS: Array<{ ageGroup: AgeGroup; gender: PlayerGender; label: string }> = [
  { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS, label: "U19 Boys" },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS, label: "U19 Girls" },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS, label: "U16 Boys" },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.GIRLS, label: "U16 Girls" },
  { ageGroup: AgeGroup.U13, gender: PlayerGender.BOYS, label: "U13 Boys" },
  { ageGroup: AgeGroup.U13, gender: PlayerGender.GIRLS, label: "U13 Girls" }
];

async function main() {
  const asOfDate = new Date();
  const currentRatings = await prisma.playerRating.findMany({
    include: { player: { select: { displayName: true, gender: true } } },
    orderBy: [{ ageGroup: "asc" }, { adjustedRating: "desc" }]
  });

  const currentByBoard = new Map<string, Map<string, { rank: number; rating: number; games: number }>>();
  for (const board of BOARDS) {
    const key = `${board.ageGroup}|${board.gender}`;
    const rows = currentRatings
      .filter((r) => r.ageGroup === board.ageGroup && r.player.gender === board.gender)
      .sort((a, b) => Number(b.adjustedRating) - Number(a.adjustedRating));
    const map = new Map<string, { rank: number; rating: number; games: number }>();
    rows.forEach((r, i) =>
      map.set(r.playerId, {
        rank: i + 1,
        rating: Number(r.adjustedRating),
        games: r.verifiedGameCount
      })
    );
    currentByBoard.set(key, map);
  }

  const boards = [];
  for (const board of BOARDS) {
    const shadow = await computeShadowBoard({
      ageGroup: board.ageGroup,
      gender: board.gender,
      asOfDate,
      params: resolveShadowFormulaParams()
    });

    const currentMap = currentByBoard.get(`${board.ageGroup}|${board.gender}`) ?? new Map();
    const comparisons = shadow.rows.map((row, index) => {
      const current = currentMap.get(row.playerId);
      return {
        shadowRank: index + 1,
        playerId: row.playerId,
        displayName: row.displayName,
        shadowRating: row.adjustedRating,
        shadowGames: row.verifiedGameCount,
        ratingBasis: row.ratingBasis,
        evidenceRoles: row.evidenceRoles,
        avgAgeFactor: row.avgAgeFactor,
        currentRank: current?.rank ?? null,
        currentRating: current?.rating ?? null,
        currentGames: current?.games ?? null,
        rankDelta: current ? current.rank - (index + 1) : null,
        ratingDelta: current ? Number((row.adjustedRating - current.rating).toFixed(2)) : null,
        isNewOnHomeBoard: current === undefined
      };
    });

    boards.push({
      label: board.label,
      ageGroup: board.ageGroup,
      gender: board.gender,
      policyVersionId: shadow.policyVersionId,
      evaluationDate: shadow.evaluationDate,
      shadowRowCount: shadow.rows.length,
      projectedCount: shadow.rows.filter((r) => r.ratingBasis === "PROJECTED").length,
      blendedCount: shadow.rows.filter((r) => r.ratingBasis === "BLENDED").length,
      top15: comparisons.slice(0, 15),
      newOnHomeBoard: comparisons.filter((c) => c.isNewOnHomeBoard).slice(0, 20),
      largestRankMoves: [...comparisons]
        .filter((c) => c.rankDelta !== null && Math.abs(c.rankDelta) >= 3)
        .sort((a, b) => Math.abs(b.rankDelta!) - Math.abs(a.rankDelta!))
        .slice(0, 15)
    });
  }

  const report = {
    generatedAt: asOfDate.toISOString(),
    mode: "read-only-shadow",
    policyVersionId: FORMULA_VNEXT_POLICY_ID,
    boards
  };

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdSections = boards
    .map((board) => {
      const topRows = board.top15
        .map(
          (r) =>
            `| ${r.shadowRank} | ${r.displayName} | ${r.shadowRating} | ${r.ratingBasis} | ${r.currentRank ?? "—"} | ${r.currentRating ?? "—"} | ${r.rankDelta ?? "NEW"} |`
        )
        .join("\n");
      const newRows = board.newOnHomeBoard.length
        ? board.newOnHomeBoard
            .map((r) => `- **${r.displayName}** — shadow ${r.shadowRating} (${r.ratingBasis}, ${r.shadowGames} games)`)
            .join("\n")
        : "None.";
      return `## ${board.label}

- Shadow rows: ${board.shadowRowCount} (projected: ${board.projectedCount}, blended: ${board.blendedCount})

| Shadow# | Player | Shadow | Basis | v1# | v1 | Δ Rank |
|---------|--------|--------|-------|-----|-----|--------|
${topRows}

### New on home board (vNext)

${newRows}`;
    })
    .join("\n\n");

  writeFileSync(
    mdPath,
    `# Rating Reformulation Shadow Preview

Generated: ${report.generatedAt}  
Policy: ${FORMULA_VNEXT_POLICY_ID}

Read-only. No database writes.

${mdSections}
`
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
