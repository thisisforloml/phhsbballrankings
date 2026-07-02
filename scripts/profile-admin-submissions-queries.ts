/**
 * Per-query breakdown for Admin Submissions — run with:
 *   npx tsx scripts/profile-admin-submissions-queries.ts
 */
import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { activeSubmissionWhere } from "../src/lib/submission-lifecycle";
import { loadAdminSubmissionQueue } from "../src/lib/admin/load-admin-submission-queue";
import { buildSubmissionListReview, buildSubmissionReview } from "../src/lib/submission-review";

const QUEUE_LIMIT = 100;

async function time<T>(label: string, fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  const rows = Array.isArray(result) ? result.length : typeof result === "object" && result && "submissions" in result ? (result as { submissions: unknown[] }).submissions.length : 1;
  console.log(`  ${ms.toFixed(1)}ms  ${label} (${rows} rows)`);
  return { ms, result };
}

async function profileLegacy() {
  console.log("\nLEGACY (findMany + count + full review)\n" + "-".repeat(40));

  const findMany = await time("Q1 submissions.findMany + submittedBy", async () =>
    prisma.submission.findMany({
      where: activeSubmissionWhere,
      include: { submittedBy: { select: { id: true, name: true, username: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: QUEUE_LIMIT,
    }),
  );

  await time("Q2 submissions.count", async () => prisma.submission.count({ where: activeSubmissionWhere }));

  await time("Q3 buildSubmissionReview × N (full)", () => {
    findMany.result.map((submission) => buildSubmissionReview(submission));
    return findMany.result;
  });

  return findMany.ms;
}

async function profileOptimized() {
  console.log("\nOPTIMIZED (single SQL + list review)\n" + "-".repeat(40));

  const queue = await time("M1 loadAdminSubmissionQueue (findMany+count merged)", () => loadAdminSubmissionQueue(QUEUE_LIMIT));

  await time("M2 buildSubmissionListReview × N", () => {
    queue.result.submissions.map((submission) => buildSubmissionListReview(submission));
    return queue.result.submissions;
  });

  const fullStart = performance.now();
  const loaded = await loadAdminSubmissionQueue(QUEUE_LIMIT);
  const enriched = loaded.submissions.map((submission) => ({
    submission,
    review: buildSubmissionListReview(submission),
  }));
  const fullMs = performance.now() - fullStart;
  console.log(`  ${fullMs.toFixed(1)}ms  FULL page server work (${enriched.length} rows)`);

  return { queueMs: queue.ms, fullMs };
}

async function main() {
  console.log("Admin Submissions query profiler\n" + "=".repeat(60));
  const legacyFindMs = await profileLegacy();
  const optimized = await profileOptimized();

  console.log("\n" + "=".repeat(60));
  console.log(`Legacy findMany alone:           ~${legacyFindMs.toFixed(0)}ms (+ count + review)`);
  console.log(`Optimized queue SQL:             ~${optimized.queueMs.toFixed(0)}ms`);
  console.log(`Optimized full page (warm):      ~${optimized.fullMs.toFixed(0)}ms`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect().finally(() => process.exit(1));
});
