import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { activeSubmissionWhere } from "@/lib/submission-lifecycle";
import { loadRecentAuditLogs } from "./actions";
import { OpsAuditLog, OpsRatingsPanel, OpsToolsLinks } from "./OpsPanels";

export const metadata = {
  title: "Ops | Admin",
  description: "Data health, merges, and advanced operations."
};

export default async function AdminOpsPage() {
  await requireAdminUser();

  const [missingBirthDate, missingPhoto, missingPosition, playerCount, submissionOpen, auditLogs] = await Promise.all([
    prisma.player.count({ where: { deletedAt: null, birthDate: null } }),
    prisma.player.count({ where: { deletedAt: null, photoUrl: null } }),
    prisma.player.count({ where: { deletedAt: null, position: null } }),
    prisma.player.count({ where: { deletedAt: null } }),
    prisma.submission.count({
      where: {
        ...activeSubmissionWhere,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] }
      }
    }),
    loadRecentAuditLogs()
  ]);

  const signals = [
    { label: "Open submissions", value: submissionOpen, href: "/admin/submissions" },
    { label: "Missing birthdates", value: missingBirthDate, href: "/admin/players" },
    { label: "Missing photos", value: missingPhoto, href: "/admin/players" },
    { label: "Missing position", value: missingPosition, href: "/admin/players" },
    { label: "Players", value: playerCount, href: "/admin/players" }
  ];

  return (
    <>
      <AdminPageHeader title="Ops" />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {signals.map((signal) => (
          <Link
            key={signal.label}
            href={signal.href}
            className="border border-surface-200 bg-white p-4 shadow-sm transition hover:border-orange-300"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">{signal.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy-900">{signal.value.toLocaleString()}</p>
          </Link>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <OpsRatingsPanel />
        <OpsToolsLinks />
      </div>
      <OpsAuditLog
        rows={auditLogs.map((row) => ({
          id: row.id,
          entityType: row.entityType,
          action: row.action,
          reason: row.reason,
          createdAt: row.createdAt.toISOString().slice(0, 16).replace("T", " "),
          actor: row.user?.name || row.user?.username || "System"
        }))}
      />
    </>
  );
}
