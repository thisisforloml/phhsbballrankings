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
        title="Programs"
        description="Create a Program, then manage its Teams and roster."
        statusBadge={`${rows.length} records`}
      />
      <ProgramCreateForm />
      <Suspense fallback={null}>
        <ProgramListClient programs={rows} />
      </Suspense>
    </>
  );
}
