import type { Prisma } from "@prisma/client";
import type { SubmissionStatus, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const ADMIN_SUBMISSION_QUEUE_LIMIT = 100;

export type AdminSubmissionQueueRow = {
  id: string;
  status: SubmissionStatus;
  title: string;
  leagueName: string | null;
  validationSummary: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  importedAt: Date | null;
  deletedAt: Date | null;
  submittedBy: Pick<User, "id" | "name" | "username" | "email" | "role">;
};

type QueueSqlRow = {
  id: string;
  status: SubmissionStatus;
  title: string;
  leagueName: string | null;
  validationSummary: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  importedAt: Date | null;
  deletedAt: Date | null;
  submittedById: string;
  submittedByName: string | null;
  submittedByUsername: string;
  submittedByEmail: string;
  submittedByRole: User["role"];
  totalCount: number;
};

function mapQueueRow(row: QueueSqlRow): AdminSubmissionQueueRow {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    leagueName: row.leagueName,
    validationSummary: row.validationSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    importedAt: row.importedAt,
    deletedAt: row.deletedAt,
    submittedBy: {
      id: row.submittedById,
      name: row.submittedByName ?? row.submittedByUsername,
      username: row.submittedByUsername,
      email: row.submittedByEmail,
      role: row.submittedByRole,
    },
  };
}

export type AdminSubmissionQueueResult = {
  submissions: AdminSubmissionQueueRow[];
  totalCount: number;
};

const SUBMISSION_QUEUE_CACHE_MS = 5 * 60 * 1000;

let submissionQueueCache: { value: AdminSubmissionQueueResult; loadedAt: number } | null = null;

export function clearAdminSubmissionQueueCache() {
  submissionQueueCache = null;
}

async function loadAdminSubmissionQueueUncached(
  limit = ADMIN_SUBMISSION_QUEUE_LIMIT,
): Promise<AdminSubmissionQueueResult> {
  const rows = await prisma.$queryRaw<QueueSqlRow[]>`
    SELECT
      s.id,
      s.status,
      s.title,
      s."leagueName",
      s."validationSummary",
      s."createdAt",
      s."updatedAt",
      s."publishedAt",
      s."importedAt",
      s."deletedAt",
      u.id AS "submittedById",
      u.name AS "submittedByName",
      u.username AS "submittedByUsername",
      u.email AS "submittedByEmail",
      u.role AS "submittedByRole",
      COUNT(*) OVER()::int AS "totalCount"
    FROM submissions s
    INNER JOIN users u ON u.id = s."submittedByUserId"
    WHERE s."deletedAt" IS NULL
    ORDER BY s."createdAt" DESC
    LIMIT ${limit}
  `;

  const totalCount = rows[0]?.totalCount ?? 0;
  return {
    submissions: rows.map(mapQueueRow),
    totalCount,
  };
}

export async function loadAdminSubmissionQueue(
  limit = ADMIN_SUBMISSION_QUEUE_LIMIT,
  options?: { bypassCache?: boolean },
) {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    limit === ADMIN_SUBMISSION_QUEUE_LIMIT &&
    submissionQueueCache &&
    now - submissionQueueCache.loadedAt < SUBMISSION_QUEUE_CACHE_MS
  ) {
    return submissionQueueCache.value;
  }

  const value = await loadAdminSubmissionQueueUncached(limit);
  if (limit === ADMIN_SUBMISSION_QUEUE_LIMIT) {
    submissionQueueCache = { value, loadedAt: now };
  }
  return value;
}
