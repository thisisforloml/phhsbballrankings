import { UserRole } from "@prisma/client";

import { hashPassword } from "@/lib/password-hash";
import { prisma } from "@/lib/prisma";

export const INTAKE_LIST_LIMIT = 50;
export const ORGANIZER_APPLICATION_DELETE_REASON = "Admin removed organizer application";

export type IntakeReviewAction = "APPROVE" | "REJECT";

const activeOrganizerApplicationFilter = { deletedAt: null } as const;

export function appendOrganizerApplicationAuditNote(existingNotes: string | null, actorLabel: string, note: string) {
  const stamped = `[${new Date().toISOString()}] ${actorLabel}: ${note}`;
  return existingNotes ? `${existingNotes}\n${stamped}` : stamped;
}

export function formatOrganizerApplicationActorLabel(user: { name: string; username: string }) {
  return user.name.trim() || user.username;
}

export function splitSubmissionName(firstName: string, lastName: string) {
  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
  };
}

export async function uniqueOrganizerUsername(applicantName: string, id: string) {
  const base = applicantName.replace(/[^a-z0-9]/gi, "").slice(0, 18) || "Organizer";
  const candidate = `${base}Org`;
  const existing = await prisma.user.findUnique({ where: { username: candidate } });
  return existing ? `${base}${id.slice(0, 4)}` : candidate;
}

export async function loadIntakeReviewQueues() {
  const [playerSubmissions, organizerApplications] = await Promise.all([
    prisma.playerProfileSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: INTAKE_LIST_LIMIT,
    }),
    prisma.organizerApplication.findMany({
      where: activeOrganizerApplicationFilter,
      orderBy: { createdAt: "desc" },
      take: INTAKE_LIST_LIMIT,
    }),
  ]);

  return { playerSubmissions, organizerApplications };
}

export async function rejectPlayerProfileSubmission(submissionId: string) {
  const submission = await prisma.playerProfileSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) {
    throw new Error("Player submission not found.");
  }

  await prisma.playerProfileSubmission.update({
    where: { id: submissionId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });

  return submission;
}

export async function approvePlayerProfileSubmission(submissionId: string) {
  const submission = await prisma.playerProfileSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) {
    throw new Error("Player submission not found.");
  }

  const names = splitSubmissionName(submission.firstName, submission.lastName);

  if (submission.playerId) {
    await prisma.player.update({
      where: { id: submission.playerId },
      data: {
        firstName: names.firstName,
        lastName: names.lastName,
        displayName: names.displayName,
        position: submission.position ?? undefined,
        heightCm: submission.heightCm ?? undefined,
        photoUrl: submission.photoUrl ?? undefined,
        city: submission.city ?? undefined,
        region: submission.region ?? undefined,
      },
    });
  } else {
    await prisma.player.create({
      data: {
        firstName: names.firstName,
        lastName: names.lastName,
        displayName: names.displayName,
        birthDate: new Date("2010-01-01T00:00:00.000Z"),
        position: submission.position?.trim() || "G",
        heightCm: submission.heightCm,
        photoUrl: submission.photoUrl,
        city: submission.city?.trim() || "Pending city",
        region: submission.region?.trim() || "Pending region",
      },
    });
  }

  await prisma.playerProfileSubmission.update({
    where: { id: submissionId },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });

  return submission;
}

export async function getOrganizerApplicationForAudit(applicationId: string) {
  return prisma.organizerApplication.findUnique({
    where: { id: applicationId },
    include: {
      deletedBy: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

export async function softDeleteOrganizerApplication(
  applicationId: string,
  deletedBy: { id: string; name: string; username: string },
) {
  const application = await prisma.organizerApplication.findUnique({ where: { id: applicationId } });
  if (!application) {
    throw new Error("Organizer application not found.");
  }
  if (application.deletedAt) {
    throw new Error("Organizer application was already removed.");
  }

  const actorLabel = formatOrganizerApplicationActorLabel(deletedBy);
  const adminNotes = appendOrganizerApplicationAuditNote(
    application.adminNotes,
    actorLabel,
    ORGANIZER_APPLICATION_DELETE_REASON,
  );

  await prisma.organizerApplication.update({
    where: { id: applicationId },
    data: {
      deletedAt: new Date(),
      deletedById: deletedBy.id,
      adminNotes,
    },
  });

  return application;
}

function assertActiveOrganizerApplication<T extends { deletedAt: Date | null }>(
  application: T | null,
  notFoundMessage: string,
): asserts application is T {
  if (!application) {
    throw new Error(notFoundMessage);
  }
  if (application.deletedAt) {
    throw new Error("Organizer application was removed.");
  }
}

export async function rejectOrganizerApplication(applicationId: string) {
  const application = await prisma.organizerApplication.findUnique({ where: { id: applicationId } });
  assertActiveOrganizerApplication(application, "Organizer application not found.");

  await prisma.organizerApplication.update({
    where: { id: applicationId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });

  return application;
}

export type OrganizerApprovalResult = {
  application: Awaited<ReturnType<typeof rejectOrganizerApplication>>;
  organizerUsername: string;
  initialPassword: "Organizer123";
};

export async function approveOrganizerApplication(applicationId: string): Promise<OrganizerApprovalResult> {
  const application = await prisma.organizerApplication.findUnique({ where: { id: applicationId } });
  assertActiveOrganizerApplication(application, "Organizer application not found.");

  const organizerUsername = await uniqueOrganizerUsername(application.applicantName, application.id);
  const initialPasswordHash = await hashPassword("Organizer123");

  await prisma.$transaction([
    prisma.user.upsert({
      where: { username: organizerUsername },
      update: { deletedAt: null, role: UserRole.ORGANIZER },
      create: {
        name: application.applicantName,
        username: organizerUsername,
        email: `${organizerUsername.toLowerCase()}@oncourtrankings.local`,
        passwordHash: initialPasswordHash,
        role: UserRole.ORGANIZER,
      },
    }),
    prisma.organizerApplication.update({
      where: { id: applicationId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    }),
  ]);

  return {
    application,
    organizerUsername,
    initialPassword: "Organizer123",
  };
}

export function organizerApprovalMessage(result: OrganizerApprovalResult) {
  return `Organizer approved. Login: ${result.organizerUsername} · ${result.initialPassword}`;
}
