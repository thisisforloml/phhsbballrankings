import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const reportPath = "D:\\OnCourt Rankings PH\\scripts\\reports\\extra-game-stats-report.json";
const expectedDeleteCount = 105;

type ExtraGameStatReport = {
  totalExtraGameStats?: unknown;
  extraGameStats?: Array<{
    gameStatId?: unknown;
  }>;
};

function loadReport() {
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as ExtraGameStatReport;

  if (report.totalExtraGameStats !== expectedDeleteCount) {
    throw new Error(`Expected report.totalExtraGameStats to be ${expectedDeleteCount}, got ${String(report.totalExtraGameStats)}.`);
  }

  if (!Array.isArray(report.extraGameStats)) {
    throw new Error("Expected report.extraGameStats to be an array.");
  }

  if (report.extraGameStats.length !== expectedDeleteCount) {
    throw new Error(`Expected report.extraGameStats length to be ${expectedDeleteCount}, got ${report.extraGameStats.length}.`);
  }

  const ids = report.extraGameStats.map((row, index) => {
    if (typeof row.gameStatId !== "string" || !row.gameStatId.trim()) {
      throw new Error(`Missing or invalid gameStatId at extraGameStats[${index}].`);
    }

    return row.gameStatId.trim();
  });

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== expectedDeleteCount) {
    throw new Error(`Expected ${expectedDeleteCount} unique gameStatIds, got ${uniqueIds.size}.`);
  }

  return ids;
}

async function main() {
  const deletedGameStatIds = loadReport();
  const result = await prisma.gameStat.deleteMany({
    where: {
      id: {
        in: deletedGameStatIds
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        expectedDeleteCount,
        actualDeletedCount: result.count,
        deletedGameStatIds
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
