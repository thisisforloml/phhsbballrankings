import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { loadImportCenterCounts, loadImportCenterRows } from "@/lib/admin/load-import-center";
import { requireAdminUser } from "@/lib/portal-auth";

import { ImportCenterClient } from "./ImportCenterClient";

export const metadata = {
  title: "Import Center | Admin",
  description: "Traceable import history and review queue.",
};

export default async function AdminImportCenterPage() {
  const [, rows, counts] = await Promise.all([
    requireAdminUser(),
    loadImportCenterRows(),
    loadImportCenterCounts(),
  ]);

  return (
    <>
      <AdminPageHeader title="Import Center" statusBadge={`${counts.total} records`} />
      <ImportCenterClient rows={rows} counts={counts} />
    </>
  );
}
