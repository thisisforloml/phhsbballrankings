import type { ProgramRole } from "@prisma/client";
import { ProgramRole as ProgramRoleEnum } from "@prisma/client";

import { AdminBadge } from "@/components/admin/AdminBadge";

export function programRoleLabel(role: ProgramRole) {
  return role === ProgramRoleEnum.GROUP ? "Group" : "Operational";
}

export function ProgramRoleBadge({ role, className = "" }: { role: ProgramRole; className?: string }) {
  const isGroup = role === ProgramRoleEnum.GROUP;
  return (
    <AdminBadge
      variant={isGroup ? "readOnly" : "success"}
      shape="tag"
      size="tagSm"
      className={className}
    >
      {programRoleLabel(role)}
    </AdminBadge>
  );
}
