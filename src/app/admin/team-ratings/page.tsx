import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/portal-auth";

export const metadata = {
  title: "Team Ratings | Admin",
  description: "Redirect to ops."
};

export default async function TeamRatingsRedirectPage() {
  await requireAdminUser();
  redirect("/admin/ops");
}
