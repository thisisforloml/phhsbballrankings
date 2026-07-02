/**
 * Backfill validationSummary.listReview for existing submissions.
 *
 * Usage:
 *   npx tsx scripts/backfill-submission-list-review.ts          # dry-run
 *   npx tsx scripts/backfill-submission-list-review.ts --apply # write updates
 */
import { prisma } from "../src/lib/prisma";
import { buildSubmissionListReview } from "../src/lib/submission-review";
import {
  readSubmissionListReviewFromSummary,
  withListReviewInValidationSummary,
} from "../src/lib/submission-list-review-snapshot";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.submission.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      leagueName: true,
      rawText: true,
      parsedPreview: true,
      validationSummary: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let missing = 0;
  let updated = 0;

  for (const row of rows) {
    if (readSubmissionListReviewFromSummary(row.validationSummary)) continue;
    missing += 1;

    const listReview = buildSubmissionListReview({
      rawText: row.rawText,
      parsedPreview: row.parsedPreview,
      title: row.title,
      leagueName: row.leagueName,
    });

    const existing = asRecord(row.validationSummary) ?? {
      ok: true,
      format: "backfill",
      messages: ["List review snapshot backfilled for admin queue."],
      previewSupported: true,
    };

    const nextSummary = withListReviewInValidationSummary(
      {
        ok: Boolean(existing.ok ?? true),
        format: String(existing.format ?? "backfill"),
        messages: Array.isArray(existing.messages)
          ? existing.messages.filter((message): message is string => typeof message === "string")
          : ["List review snapshot backfilled for admin queue."],
        previewSupported: Boolean(existing.previewSupported ?? true),
        ...(typeof existing.gameCount === "number" ? { gameCount: existing.gameCount } : {}),
        ...(typeof existing.rowCount === "number" ? { rowCount: existing.rowCount } : {}),
      },
      listReview,
    );

    if (apply) {
      await prisma.submission.update({
        where: { id: row.id },
        data: { validationSummary: nextSummary },
        select: { id: true },
      });
      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        missingListReview: missing,
        updated: apply ? updated : 0,
        mode: apply ? "apply" : "dry-run",
      },
      null,
      2,
    ),
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
