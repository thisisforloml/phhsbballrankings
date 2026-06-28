import { AdminBadge } from "@/components/admin/AdminBadge";

export function PassFailBadge({ pass }: { pass: boolean }) {
  return (
    <AdminBadge variant={pass ? "success" : "error"} size="xs">
      {pass ? "Pass" : "Fail"}
    </AdminBadge>
  );
}

export function HealthCheckBadge({ pass }: { pass: boolean }) {
  return (
    <AdminBadge variant={pass ? "success" : "error"} size="sm">
      {pass ? "Pass" : "Fail"}
    </AdminBadge>
  );
}

export function YesNoBadge({ value }: { value: boolean }) {
  return (
    <AdminBadge variant={value ? "success" : "readOnly"} size="sm">
      {value ? "Yes" : "No"}
    </AdminBadge>
  );
}
