"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminContentClassName, getAdminNavKey } from "@/lib/admin/adminNav";

export function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminShell active={getAdminNavKey(pathname)} contentClassName={getAdminContentClassName(pathname)}>
      {children}
    </AdminShell>
  );
}
