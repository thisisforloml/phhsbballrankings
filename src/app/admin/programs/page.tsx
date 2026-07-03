import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadProgramListRows } from "@/lib/admin/load-program-list";
import { requireAdminUser } from "@/lib/portal-auth";

import { ProgramCreateForm } from "./ProgramCreateForm";
import { ProgramListClient } from "./ProgramListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Programs | Admin",
  description: "Edit school and club programs.",
};

export default async function AdminProgramsPage() {
  const [, rows] = await Promise.all([requireAdminUser(), loadProgramListRows()]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Program Management"
        title="Schools, Clubs, and Team Programs"
        description="Create and manage school, club, and team programs. Assign teams explicitly instead of relying on alias inference."
        statusBadge={`${rows.length} records`}
      />
      <ProgramCreateForm />
      <Suspense fallback={null}>
        <ProgramListClient programs={rows} />
      </Suspense>
    </>
  );
}
