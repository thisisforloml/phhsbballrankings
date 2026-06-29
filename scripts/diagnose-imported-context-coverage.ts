import { SubmissionStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getImportedSubmissionContext } from "../src/lib/submission-post-import-processing";

async function main() {
  const submissions = await prisma.submission.findMany({
    where: { status: SubmissionStatus.IMPORTED, deletedAt: null },
    select: { id: true, title: true }
  });

  const gameIds = new Set<string>();
  const failures: Array<{ id: string; title: string; error: string }> = [];

  for (const submission of submissions) {
    try {
      const context = await getImportedSubmissionContext(submission.id);
      for (const gameId of context.gameIds) gameIds.add(gameId);
    } catch (error) {
      failures.push({
        id: submission.id,
        title: submission.title,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log(JSON.stringify({
    submissions: submissions.length,
    resolvedGameIds: gameIds.size,
    failures: failures.length,
    failureSample: failures.slice(0, 10)
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
