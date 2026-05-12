import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const reportPath = "D:\\OnCourt Rankings PH\\scripts\\reports\\extra-game-performance-scores-report.json";

type ExtraGamePerformanceScoreReport = {
  extraGamePerformanceScores?: Array<{
    gamePerformanceScoreId?: unknown;
  }>;
};

function loadExtraGamePerformanceScoreIds() {
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as ExtraGamePerformanceScoreReport;

  if (!Array.isArray(report.extraGamePerformanceScores)) {
    throw new Error("Expected report.extraGamePerformanceScores to be an array.");
  }

  const ids = report.extraGamePerformanceScores.map((row, index) => {
    if (typeof row.gamePerformanceScoreId !== "string" || !row.gamePerformanceScoreId.trim()) {
      throw new Error(`Missing or invalid gamePerformanceScoreId at extraGamePerformanceScores[${index}].`);
    }

    return row.gamePerformanceScoreId.trim();
  });

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new Error(`Expected unique gamePerformanceScoreIds, got ${ids.length} rows and ${uniqueIds.size} unique ids.`);
  }

  return ids;
}

async function main() {
  const ids = loadExtraGamePerformanceScoreIds();
  const result = await prisma.gamePerformanceScore.deleteMany({
    where: {
      id: {
        in: ids
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        expectedDeleteCount: ids.length,
        actualDeletedCount: result.count
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
