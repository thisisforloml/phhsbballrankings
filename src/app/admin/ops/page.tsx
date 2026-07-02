import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadAdminOpsPageData } from "@/lib/admin/load-admin-ops-page-data";
import { requireAdminUser } from "@/lib/portal-auth";

import { OpsAuditLog, OpsRatingsPanel, OpsToolsLinks } from "./OpsPanels";

export const metadata = {
  title: "Ops | Admin",
  description: "Data health, merges, and advanced operations."
};

export default async function AdminOpsPage() {
  const [, opsData] = await Promise.all([requireAdminUser(), loadAdminOpsPageData()]);
  const { missingBirthDate, missingPhoto, missingPosition, playerCount, submissionOpen, auditLogs } = opsData;

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
            prefetch={false}
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
          reason: row.reason ?? "",
          createdAt: row.createdAt.toISOString().slice(0, 16).replace("T", " "),
          actor: row.user?.name || row.user?.username || "System"
        }))}
      />
    </>
  );
}
