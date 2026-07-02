import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/portal-auth";

export const metadata = {
  title: "Admin Portal",
  description: "Internal Peach Basket administration."
};

export default async function AdminPage() {
  await requireAdminUser();
  redirect("/admin/submissions");
}
