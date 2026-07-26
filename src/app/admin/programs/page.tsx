import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadProgramListRows } from "@/lib/admin/load-program-list";
import { requireAdminUser } from "@/lib/portal-auth";

import { ProgramCreateForm } from "./ProgramCreateForm";
import { ProgramListClient } from "./ProgramListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Organizations & Programs | Admin",
  description: "Manage organizations, schools, clubs, and their Teams.",
};

export default async function AdminProgramsPage() {
  const [, rows] = await Promise.all([requireAdminUser(), loadProgramListRows()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Directory"
        title="Organizations & Programs"
        description="Organizations group related school and club Programs. Programs own Teams and rosters."
        statusBadge={`${rows.length} records`}
      />
      <ProgramCreateForm organizations={rows.filter((row) => row.programRole === "GROUP").map((row) => ({ id: row.id, fullName: row.fullName }))} />
      <Suspense fallback={null}>
        <ProgramListClient programs={rows} />
      </Suspense>
    </>
  );
}
