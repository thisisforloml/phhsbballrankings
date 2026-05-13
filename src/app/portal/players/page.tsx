import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/portal-auth";

export default async function LegacyPortalPlayersPage() {
  await requireAdminUser();
  redirect("/admin/players");
}