import { SubmissionStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { buildSubmissionReview } from "../src/lib/submission-review";
import { safeParseSubmissionJson } from "../src/lib/submission-json";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function main() {
  const subs = await prisma.submission.findMany({
    where: { status: SubmissionStatus.IMPORTED, deletedAt: null },
    select: { id: true, title: true, leagueName: true },
    orderBy: { importedAt: "desc" },
    take: 20
  });
  console.log(JSON.stringify(subs, null, 2));
}

main().finally(() => prisma.$disconnect());
