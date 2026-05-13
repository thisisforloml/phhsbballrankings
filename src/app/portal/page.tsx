import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getPortalUser } from "@/lib/portal-auth";

export default async function PortalPage() {
  const user = await getPortalUser();

  if (!user) {
    redirect("/portal/login");
  }

  redirect(user.role === UserRole.ADMIN ? "/admin" : "/organizer");
}