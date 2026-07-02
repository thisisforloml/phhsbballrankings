import { redirect } from "next/navigation";

import { clearPortalSession } from "@/lib/portal-auth";

export function GET() {
  clearPortalSession();
  redirect("/portal/login");
}