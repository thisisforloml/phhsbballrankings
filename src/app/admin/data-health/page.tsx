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
      title="Operations & Data Health"
      description="Review duplicate players, mixed-context Teams, and other integrity issues before running guarded operations."
    >
      <DataHealthCenter data={data} />
    </AdminPageTemplate>
  );
}
