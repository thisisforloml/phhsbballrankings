import type { AdminNavKey } from "@/components/admin/AdminSidebar";

export const DEFAULT_ADMIN_CONTENT_CLASS_NAME = "grid gap-4 px-4 py-5 sm:px-6 lg:px-7";

export function getAdminNavKey(pathname: string): AdminNavKey {
  if (pathname.startsWith("/admin/submissions")) return "submissions";
  if (pathname.startsWith("/admin/tools/submissions") || pathname.startsWith("/admin/tools/live-stats")) return "submissions";
  if (pathname.startsWith("/admin/players")) return "players";
  if (pathname.startsWith("/admin/teams")) return "teams";
  if (pathname.startsWith("/admin/leagues")) return "leagues";
  if (pathname.startsWith("/admin/programs")) return "programs";
  if (pathname.startsWith("/admin/claims")) return "claims";
  if (pathname.startsWith("/admin/intake")) return "intake";
  if (pathname.startsWith("/admin/ops") || pathname.startsWith("/admin/data-health") || pathname.startsWith("/admin/team-ratings")) return "ops";
  if (pathname === "/admin" || pathname === "/admin/") return "submissions";
  return "submissions";
}

export function getAdminContentClassName(pathname: string) {
  if (pathname.startsWith("/admin/submissions") || pathname.startsWith("/admin/tools/live-stats")) return "min-w-0";
  return DEFAULT_ADMIN_CONTENT_CLASS_NAME;
}
