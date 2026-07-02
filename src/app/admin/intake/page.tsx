import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadIntakeReviewQueues } from "@/lib/admin/intake-review";
import { requireAdminUser } from "@/lib/portal-auth";

import { IntakeReviewClient } from "./IntakeReviewClient";

export const metadata = {
  title: "Public Intake | Admin",
  description: "Review organizer applications and player profile submissions.",
};

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AdminIntakePage() {
  const [, queues] = await Promise.all([requireAdminUser(), loadIntakeReviewQueues()]);

  const playerSubmissions = queues.playerSubmissions.map((row) => ({
    id: row.id,
    status: row.status,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    heightCm: row.heightCm,
    city: row.city,
    region: row.region,
    contact: row.contact,
    message: row.message,
    playerId: row.playerId,
    createdAt: formatDate(row.createdAt),
  }));

  const organizerApplications = queues.organizerApplications.map((row) => ({
    id: row.id,
    status: row.status,
    applicantName: row.applicantName,
    organization: row.organization,
    leagueName: row.leagueName,
    city: row.city,
    region: row.region,
    contact: row.contact,
    experienceNotes: row.experienceNotes,
    createdAt: formatDate(row.createdAt),
  }));

  const pendingCount =
    playerSubmissions.filter((row) => row.status === "PENDING").length +
    organizerApplications.filter((row) => row.status === "PENDING").length;

  return (
    <>
      <AdminPageHeader title="Public Intake" statusBadge={`${pendingCount} pending`} />
      <IntakeReviewClient playerSubmissions={playerSubmissions} organizerApplications={organizerApplications} />
    </>
  );
}
