import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getImportedSubmissionContext } from "@/lib/submission-post-import-processing";

/**
 * Resolves game IDs tied to submissions with status IMPORTED (TEAM-EVIDENCE-v1-official-import).
 * Uses the same season + game-number resolution as post-import processing.
 */
export async function resolveImportedOfficialGameIds(): Promise<Set<string>> {
  const submissions = await prisma.submission.findMany({
    where: { status: SubmissionStatus.IMPORTED, deletedAt: null },
    select: { id: true }
  });

  const gameIds = new Set<string>();

  for (const submission of submissions) {
    try {
      const context = await getImportedSubmissionContext(submission.id);
      for (const gameId of context.gameIds) {
        gameIds.add(gameId);
      }
    } catch {
      // Submission JSON or imported season/game mapping is incomplete — skip.
    }
  }

  return gameIds;
}
