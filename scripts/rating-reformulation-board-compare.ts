/**
 * Side-by-side board comparison with movement explanations.
 * Usage: npx tsx scripts/rating-reformulation-board-compare.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgeGroup, PlayerGender } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { computeShadowBoard } from "../src/lib/ratings/formula-vnext";
import { resolveShadowFormulaParams } from "../src/lib/ratings/formula-vnext/resolve-params";

const reportsDir = join(process.cwd(), "scripts", "reports");
const jsonPath = join(reportsDir, "rating-reformulation-board-compare.json");
const mdPath = join(reportsDir, "rating-reformulation-board-compare.md");

const BOARDS = [
  { ageGroup: AgeGroup.U19, gender: PlayerGender.BOYS, label: "U19 Boys" },
  { ageGroup: AgeGroup.U19, gender: PlayerGender.GIRLS, label: "U19 Girls" },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.BOYS, label: "U16 Boys" },
  { ageGroup: AgeGroup.U16, gender: PlayerGender.GIRLS, label: "U16 Girls" }
] as const;

function explainMove(input: {
  rankDelta: number | null;
  ratingDelta: number | null;
  isNew: boolean;
  ratingBasis: string | null;
  avgAgeFactor: number | null;
  avgOpponentFactor: number | null;
}): string {
  if (input.isNew) return "New on home board (cross-bracket projection)";
  if (input.rankDelta === null) return "Not on v1 board";
  if (Math.abs(input.rankDelta) < 2 && (input.ratingDelta === null || Math.abs(input.ratingDelta) < 1.5)) {
    return "Stable";
  }
  const parts: string[] = [];
  if (input.ratingDelta !== null && Math.abs(input.ratingDelta) >= 2) {
    parts.push(`rating ${input.ratingDelta > 0 ? "+" : ""}${input.ratingDelta.toFixed(1)}`);
  }
  if (input.avgAgeFactor !== null && input.avgAgeFactor > 1.02) {
    parts.push("playing-up boost");
  }
  if (input.avgOpponentFactor !== null && input.avgOpponentFactor > 1.03) {
    parts.push("stronger opponents");
  }
  if (input.avgOpponentFactor !== null && input.avgOpponentFactor < 0.97) {
    parts.push("weaker opponents");
  }
  if (input.ratingBasis === "PROJECTED") parts.push("projected basis");
  return parts.length ? parts.join("; ") : `rank ${input.rankDelta > 0 ? "+" : ""}${input.rankDelta}`;
}

async function main() {
  const asOfDate = new Date();
  const params = resolveShadowFormulaParams();
  const currentRatings = await prisma.playerRating.findMany({
    include: { player: { select: { displayName: true, gender: true } } }
  });

  const boards = [];
  for (const board of BOARDS) {
    const shadow = await computeShadowBoard({ ageGroup: board.ageGroup, gender: board.gender, asOfDate, params });
    const current = currentRatings
      .filter((r) => r.ageGroup === board.ageGroup && r.player.gender === board.gender)
      .sort((a, b) => Number(b.adjustedRating) - Number(a.adjustedRating));
    const currentRank = new Map(current.map((r, i) => [r.playerId, { rank: i + 1, rating: Number(r.adjustedRating) }]));

    const movements = shadow.rows.map((row, index) => {
      const cur = currentRank.get(row.playerId);
      const rankDelta = cur ? cur.rank - (index + 1) : null;
      const ratingDelta = cur ? row.adjustedRating - cur.rating : null;
      return {
        shadowRank: index + 1,
        playerId: row.playerId,
        displayName: row.displayName,
        shadowRating: row.adjustedRating,
        ratingBasis: row.ratingBasis,
        avgAgeFactor: row.avgAgeFactor,
        avgOpponentFactor: row.avgOpponentFactor,
        currentRank: cur?.rank ?? null,
        currentRating: cur?.rating ?? null,
        rankDelta,
        ratingDelta: ratingDelta === null ? null : Number(ratingDelta.toFixed(2)),
        explanation: explainMove({
          rankDelta,
          ratingDelta,
          isNew: !cur,
          ratingBasis: row.ratingBasis,
          avgAgeFactor: row.avgAgeFactor,
          avgOpponentFactor: row.avgOpponentFactor
        })
      };
    });

    const topMovers = [...movements]
      .filter((m) => m.rankDelta !== null && Math.abs(m.rankDelta) >= 5)
      .sort((a, b) => Math.abs(b.rankDelta!) - Math.abs(a.rankDelta!))
      .slice(0, 15);

    boards.push({
      label: board.label,
      shadowCount: shadow.rows.length,
      currentCount: current.length,
      newOnHomeBoard: movements.filter((m) => m.currentRank === null).length,
      topMovers,
      top10Compare: movements.slice(0, 10)
    });
  }

  const report = { generatedAt: asOfDate.toISOString(), mode: "read-only", policyVersionId: params.policyVersionId, boards };
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = boards
    .map((board) => {
      const movers = board.topMovers
        .map(
          (m) =>
            `- **${m.displayName}**: ${m.explanation} (v1 #${m.currentRank} → shadow #${m.shadowRank}, ${m.currentRating ?? "—"} → ${m.shadowRating})`
        )
        .join("\n");
      return `## ${board.label}

- v1 rows: ${board.currentCount} | shadow rows: ${board.shadowCount} | new on home board: ${board.newOnHomeBoard}

### Largest rank moves

${movers || "No moves ≥5 ranks."}`;
    })
    .join("\n\n");

  writeFileSync(mdPath, `# Rating Reformulation Board Compare\n\nGenerated: ${report.generatedAt}\n\n${md}\n`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
