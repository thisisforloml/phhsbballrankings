import type { ReactNode } from "react";
import { AdminSidebar, type AdminNavKey } from "@/components/admin/AdminSidebar";
import { DEFAULT_ADMIN_CONTENT_CLASS_NAME } from "@/lib/admin/adminNav";

export function AdminShell({
  active,
  children,
  contentClassName = DEFAULT_ADMIN_CONTENT_CLASS_NAME
}: {
  active: AdminNavKey;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <main className="min-h-screen bg-surface-50 pt-16">
      <div className="grid lg:grid-cols-[16rem_1fr]">
        <AdminSidebar active={active} />
        <section className={contentClassName}>{children}</section>
      </div>
    </main>
  );
}
