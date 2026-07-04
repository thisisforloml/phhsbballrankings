import type { ImportRecordStatus, SubmissionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ImportCenterRow = {
  id: string;
  sourceType: string;
  title: string;
  status: ImportRecordStatus;
  competitionName: string | null;
  seasonName: string | null;
  duplicateCount: number;
  aliasSuggestionCount: number;
  errorMessage: string | null;
  submittedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  resolvedAt: string | null;
  submissionId: string | null;
};

function mapSubmissionStatus(status: SubmissionStatus): ImportRecordStatus {
  switch (status) {
    case "DRAFT":
    case "SUBMITTED":
      return "PENDING";
    case "UNDER_REVIEW":
      return "NEEDS_REVIEW";
    case "APPROVED":
      return "NEEDS_REVIEW";
    case "REJECTED":
      return "FAILED";
    case "IMPORTED":
      return "PUBLISHED";
    default:
      return "PENDING";
  }
}

function readDuplicateCount(validationSummary: unknown) {
  if (!validationSummary || typeof validationSummary !== "object") return 0;
  const duplicatePlayers = (validationSummary as { duplicatePlayerNamesWithinGames?: unknown[] })
    .duplicatePlayerNamesWithinGames;
  return Array.isArray(duplicatePlayers) ? duplicatePlayers.length : 0;
}

export async function syncImportRecordsFromSubmissions() {
  const submissions = await prisma.submission.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      leagueName: true,
      validationSummary: true,
      submittedByUserId: true,
      importedAt: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      submittedBy: { select: { name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  for (const submission of submissions) {
    const duplicateCount = readDuplicateCount(submission.validationSummary);
    const status = duplicateCount > 0 ? "DUPLICATES" : mapSubmissionStatus(submission.status);

    await prisma.importRecord.upsert({
      where: { submissionId: submission.id },
      create: {
        sourceType: "SUBMISSION",
        submissionId: submission.id,
        title: submission.title,
        status,
        duplicateCount,
        aliasSuggestionCount: 0,
        submittedByUserId: submission.submittedByUserId,
        publishedAt: submission.publishedAt ?? submission.importedAt,
        summary: {
          leagueName: submission.leagueName,
          submissionStatus: submission.status,
        },
      },
      update: {
        title: submission.title,
        status,
        duplicateCount,
        publishedAt: submission.publishedAt ?? submission.importedAt,
        summary: {
          leagueName: submission.leagueName,
          submissionStatus: submission.status,
        },
        updatedAt: submission.updatedAt,
      },
    });
  }
}

export async function loadImportCenterRows(statusFilter?: ImportRecordStatus | "ALL" | null) {
  await syncImportRecordsFromSubmissions();

  const rows = await prisma.importRecord.findMany({
    where: {
      deletedAt: null,
      ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : {}),
    },
    include: {
      league: { select: { name: true } },
      season: { select: { name: true } },
      submittedBy: { select: { name: true, username: true } },
      submission: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map(
    (row): ImportCenterRow => ({
      id: row.id,
      sourceType: row.sourceType,
      title: row.title,
      status: row.status,
      competitionName: row.league?.name ?? null,
      seasonName: row.season?.name ?? null,
      duplicateCount: row.duplicateCount,
      aliasSuggestionCount: row.aliasSuggestionCount,
      errorMessage: row.errorMessage,
      submittedBy: row.submittedBy?.name ?? row.submittedBy?.username ?? null,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      submissionId: row.submission?.id ?? row.submissionId,
    }),
  );
}

export async function loadImportCenterCounts() {
  await syncImportRecordsFromSubmissions();
  const grouped = await prisma.importRecord.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Record<
    ImportRecordStatus,
    number
  >;

  return {
    pending: counts.PENDING ?? 0,
    needsReview: counts.NEEDS_REVIEW ?? 0,
    duplicates: counts.DUPLICATES ?? 0,
    aliasSuggestions: counts.ALIAS_SUGGESTIONS ?? 0,
    failed: counts.FAILED ?? 0,
    published: counts.PUBLISHED ?? 0,
    resolved: counts.RESOLVED ?? 0,
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
  };
}
