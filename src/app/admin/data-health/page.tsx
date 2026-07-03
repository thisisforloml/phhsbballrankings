import { AdminPageTemplate } from "@/components/admin/AdminPageTemplate";
import { DataHealthCenter } from "@/components/admin/DataHealthCenter";
import { loadDataHealthCenter } from "@/lib/admin/load-data-health-center";
import { requireAdminUser } from "@/lib/portal-auth";

export const metadata = {
  title: "Data Health Center | Admin",
  description: "Read-only consolidated audit, validation, and integrity signals.",
};

export default async function AdminDataHealthPage() {
  const [, data] = await Promise.all([requireAdminUser(), loadDataHealthCenter()]);

  return (
    <AdminPageTemplate
      title="Data Health Center"
      description="Consolidated read-only integrity workspace. Every signal links to the proper admin page — no edits or automatic fixes from here."
    >
      <DataHealthCenter data={data} />
    </AdminPageTemplate>
  );
}
