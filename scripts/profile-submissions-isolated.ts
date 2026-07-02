import { performance } from "node:perf_hooks";
import { prisma } from "../src/lib/prisma";
import { activeSubmissionWhere } from "../src/lib/submission-lifecycle";
import { loadAdminSubmissionQueue } from "../src/lib/admin/load-admin-submission-queue";
import { buildSubmissionListReview } from "../src/lib/submission-review";

async function main() {
  for (let i = 1; i <= 3; i++) {
    const start = performance.now();
    const { submissions } = await loadAdminSubmissionQueue(100);
    for (const submission of submissions) buildSubmissionListReview(submission);
    console.log(`optimized run ${i}: ${(performance.now() - start).toFixed(1)}ms`);
  }

  for (let i = 1; i <= 3; i++) {
    const start = performance.now();
    const submissions = await prisma.submission.findMany({
      where: activeSubmissionWhere,
      include: { submittedBy: { select: { id: true, name: true, username: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    await prisma.submission.count({ where: activeSubmissionWhere });
    for (const submission of submissions) buildSubmissionListReview(submission);
    console.log(`legacy run ${i}: ${(performance.now() - start).toFixed(1)}ms`);
  }

  await prisma.$disconnect();
}

main();
