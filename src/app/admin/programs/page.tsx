import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadProgramListRows } from "@/lib/admin/load-program-list";
import { requireAdminUser } from "@/lib/portal-auth";

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
        description="Use this as the primary structure for school, club, and team organization. Program Management shows only teams currently used by official games or stats; inactive/internal records stay in Internal Team Records for audit review."
        statusBadge={`${rows.length} records`}
      />
      <Suspense fallback={null}>
        <ProgramListClient programs={rows} />
      </Suspense>
    </>
  );
}
