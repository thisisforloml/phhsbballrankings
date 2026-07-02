import { Suspense } from "react";

import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { AdminTopBar } from "@/components/layout/AdminTopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminTopBar />
      <Suspense fallback={null}>
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </Suspense>
    </>
  );
}
